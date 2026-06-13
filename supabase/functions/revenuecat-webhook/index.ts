// Supabase Edge Function: revenuecat-webhook
//
// Receives RevenueCat webhook POSTs, verifies the bearer-token Authorization
// header against REVENUECAT_WEBHOOK_SECRET (set via `supabase secrets set`),
// and routes events:
//
//   - INITIAL_PURCHASE / NON_RENEWING_PURCHASE -> entitlement_status='paid'
//   - CANCELLATION                              -> revert paid -> trial/expired
//   - TRANSFER                                  -> demote transferred_from users,
//                                                  promote transferred_to users
//   - everything else                           -> 200 no-op
//
// Idempotency: every row carries last_revenuecat_event_at. The UPDATE
// itself is gated on `last_revenuecat_event_at IS NULL OR < eventAt`, so
// two concurrent deliveries cannot both apply — Postgres serializes the
// row write and the older one's WHERE clause fails to match. The upfront
// SELECT-and-pre-check is just a fast bail to avoid an obvious wasted
// round trip; the atomicity comes from the SQL filter on UPDATE.
//
// Uses the SERVICE ROLE key to write to trial_entitlements, bypassing RLS
// (which has no UPDATE policy for the authenticated role per 0005:137-138).
//
// IMPORTANT: do not log the bearer token or request body verbatim. Both can
// contain identifying info. Log event.type + app_user_id + event_timestamp_ms.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

type RevenueCatEvent = {
  type: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  product_id?: string;
  cancel_reason?: string;
  event_timestamp_ms?: number;
  transferred_from?: string[];
  transferred_to?: string[];
};

type RevenueCatPayload = {
  event: RevenueCatEvent;
};

type HandlerDeps = {
  secret: string;
  supabase: SupabaseClient;
};

const PAID_EVENT_TYPES = new Set([
  "INITIAL_PURCHASE",
  "NON_RENEWING_PURCHASE",
]);

type TrialRow = {
  user_id: string;
  entitlement_status: string;
  trial_ends_at: string;
  last_revenuecat_event_at: string | null;
};

// Look up the trial row by app_user_id first; if missing, fall back to
// original_app_user_id and then aliases (per RC's recommendation for
// handling identity merges). Returns the first non-null match.
async function findTrialRow(
  supabase: SupabaseClient,
  candidates: string[],
): Promise<{ row: TrialRow | null; error: unknown }> {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const { data, error } = await supabase
      .from("trial_entitlements")
      .select(
        "user_id, entitlement_status, trial_ends_at, last_revenuecat_event_at",
      )
      .eq("user_id", candidate)
      .maybeSingle();
    if (error) return { row: null, error };
    if (data) return { row: data as TrialRow, error: null };
  }
  return { row: null, error: null };
}

// Atomic paid-promote. Only applies if no newer event already won the
// row. Returns true if a row was updated.
async function applyPaidPromote(
  supabase: SupabaseClient,
  userId: string,
  eventAt: string,
): Promise<{ applied: boolean; error: unknown }> {
  const { data, error } = await supabase
    .from("trial_entitlements")
    .update({
      entitlement_status: "paid",
      last_validated_at: new Date().toISOString(),
      last_revenuecat_event_at: eventAt,
    })
    .eq("user_id", userId)
    .or(
      `last_revenuecat_event_at.is.null,last_revenuecat_event_at.lt.${eventAt}`,
    )
    .select();
  return { applied: !!data && data.length > 0, error };
}

// Atomic cancel/transfer-from revert. Demote paid → trial (if still
// inside trial window) or expired (otherwise). Atomic against both a
// concurrent flip-off-paid AND a newer event arriving first.
async function applyCancelRevert(
  supabase: SupabaseClient,
  row: TrialRow,
  eventAt: string,
): Promise<{ applied: boolean; error: unknown }> {
  const trialEndsAt = new Date(row.trial_ends_at).getTime();
  const newStatus = trialEndsAt > Date.now() ? "trial" : "expired";
  const { data, error } = await supabase
    .from("trial_entitlements")
    .update({
      entitlement_status: newStatus,
      last_validated_at: new Date().toISOString(),
      last_revenuecat_event_at: eventAt,
    })
    .eq("user_id", row.user_id)
    .eq("entitlement_status", "paid")
    .or(
      `last_revenuecat_event_at.is.null,last_revenuecat_event_at.lt.${eventAt}`,
    )
    .select();
  return { applied: !!data && data.length > 0, error };
}

export async function handleWebhook(
  req: Request,
  deps: HandlerDeps,
): Promise<Response> {
  // 1. Auth
  const auth = req.headers.get("Authorization") ?? "";
  const expected = `Bearer ${deps.secret}`;
  if (auth !== expected) {
    return new Response("unauthorized", { status: 401 });
  }

  // 2. Parse
  let payload: RevenueCatPayload;
  try {
    payload = (await req.json()) as RevenueCatPayload;
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  const event = payload?.event;
  if (!event || typeof event.type !== "string") {
    return new Response("missing event", { status: 400 });
  }

  // 3. Route gate. NOTE the order: TRANSFER is checked BEFORE the
  // app_user_id requirement because TRANSFER events intentionally omit
  // it (RC sends transferred_from + transferred_to arrays instead).
  const isPaid = PAID_EVENT_TYPES.has(event.type);
  const isCancel = event.type === "CANCELLATION";
  const isTransfer = event.type === "TRANSFER";
  if (!isPaid && !isCancel && !isTransfer) {
    return new Response("ok (no-op)", { status: 200 });
  }

  // 3b. event_timestamp_ms required for every event we act on.
  if (typeof event.event_timestamp_ms !== "number") {
    return new Response("missing event_timestamp_ms", { status: 400 });
  }
  const eventAt = new Date(event.event_timestamp_ms).toISOString();

  // === TRANSFER branch =====================================================
  // Transferred-from users get demoted; transferred-to users get promoted.
  // Each row write is atomic. No 404 if a row is missing — the
  // transferred-from/to identities may be from sessions that never wrote a
  // local trial row (e.g. the app_user_id was a pre-auth anonymous id). RC
  // still expects 200 so it doesn't retry indefinitely.
  if (isTransfer) {
    const transferredFrom = Array.isArray(event.transferred_from)
      ? event.transferred_from.filter((u) => typeof u === "string" && u.length > 0)
      : [];
    const transferredTo = Array.isArray(event.transferred_to)
      ? event.transferred_to.filter((u) => typeof u === "string" && u.length > 0)
      : [];
    if (transferredFrom.length === 0 && transferredTo.length === 0) {
      return new Response(
        "missing transferred_from / transferred_to",
        { status: 400 },
      );
    }

    let demoteApplied = 0;
    for (const userId of transferredFrom) {
      const { row, error: readErr } = await findTrialRow(deps.supabase, [userId]);
      if (readErr) {
        console.error("trial_entitlements read failed (transfer demote)", {
          userId,
          eventType: event.type,
          eventAt,
          error: readErr,
        });
        return new Response("read failed", { status: 500 });
      }
      if (!row) {
        console.info("transfer demote: no row for user_id (ignored)", {
          userId,
          eventType: event.type,
          eventAt,
        });
        continue;
      }
      // Fast bail if this event is already-applied or older.
      if (
        row.last_revenuecat_event_at &&
        new Date(row.last_revenuecat_event_at).getTime() >=
          event.event_timestamp_ms
      ) {
        continue;
      }
      const { applied, error } = await applyCancelRevert(
        deps.supabase,
        row,
        eventAt,
      );
      if (error) {
        console.error("transfer demote update failed", {
          userId,
          eventAt,
          error,
        });
        return new Response("update failed", { status: 500 });
      }
      if (applied) demoteApplied++;
    }

    let promoteApplied = 0;
    for (const userId of transferredTo) {
      const { applied, error } = await applyPaidPromote(
        deps.supabase,
        userId,
        eventAt,
      );
      if (error) {
        console.error("transfer promote update failed", {
          userId,
          eventAt,
          error,
        });
        return new Response("update failed", { status: 500 });
      }
      if (applied) promoteApplied++;
    }
    console.info("transfer applied", {
      eventAt,
      demoteCount: demoteApplied,
      promoteCount: promoteApplied,
      transferredFromCount: transferredFrom.length,
      transferredToCount: transferredTo.length,
    });
    return new Response("ok (transfer)", { status: 200 });
  }

  // === paid + cancel branches ============================================
  // These DO require app_user_id.
  if (!event.app_user_id || typeof event.app_user_id !== "string") {
    return new Response("missing app_user_id", { status: 400 });
  }

  // 4. Read current row for idempotency + (CANCELLATION) revert decision.
  // Falls back to original_app_user_id and aliases so a purchase made
  // under a previous identity is still located correctly.
  const candidates = [
    event.app_user_id,
    event.original_app_user_id ?? "",
    ...(event.aliases ?? []),
  ].filter((c): c is string => typeof c === "string" && c.length > 0);
  const { row, error: readErr } = await findTrialRow(deps.supabase, candidates);

  if (readErr) {
    console.error("trial_entitlements read failed", {
      userId: event.app_user_id,
      eventType: event.type,
      eventAt,
      error: readErr,
    });
    return new Response("read failed", { status: 500 });
  }
  if (!row) {
    console.error(
      "trial_entitlements row missing for incoming event (checked app_user_id + original_app_user_id + aliases)",
      {
        userId: event.app_user_id,
        originalUserId: event.original_app_user_id,
        aliasCount: event.aliases?.length ?? 0,
        eventType: event.type,
        eventAt,
      },
    );
    return new Response("user not found", { status: 404 });
  }

  // 5. Idempotency: fast bail if this event is older-or-equal to the
  // applied anchor. The atomic SQL filter on UPDATE also enforces this;
  // the pre-check just avoids a wasted write attempt when we already know.
  if (row.last_revenuecat_event_at) {
    const lastAt = new Date(row.last_revenuecat_event_at as string).getTime();
    if (event.event_timestamp_ms <= lastAt) {
      console.info("revenuecat event ignored (idempotent)", {
        userId: row.user_id,
        eventType: event.type,
        eventAt,
        lastAt: row.last_revenuecat_event_at,
      });
      return new Response("ok (idempotent)", { status: 200 });
    }
  }

  // 6. Route.
  if (isPaid) {
    const { applied, error: updErr } = await applyPaidPromote(
      deps.supabase,
      row.user_id,
      eventAt,
    );
    if (updErr) {
      console.error("trial_entitlements update failed", {
        userId: row.user_id,
        eventType: event.type,
        eventAt,
        error: updErr,
      });
      return new Response("update failed", { status: 500 });
    }
    if (!applied) {
      console.info("revenuecat paid update raced (no rows applied)", {
        userId: row.user_id,
        eventType: event.type,
        eventAt,
      });
      return new Response("ok (raced)", { status: 200 });
    }
    return new Response("ok", { status: 200 });
  }

  // CANCELLATION — refund or chargeback. Only revert if the row currently
  // shows 'paid'; for anything else this is a duplicate delivery or a
  // refund-before-purchase corner case, both of which we want to ignore.
  if (isCancel) {
    if (row.entitlement_status !== "paid") {
      console.info("CANCELLATION ignored (entitlement not paid)", {
        userId: row.user_id,
        currentStatus: row.entitlement_status,
        eventAt,
      });
      return new Response("ok (no-op — not paid)", { status: 200 });
    }

    const { applied, error: updErr } = await applyCancelRevert(
      deps.supabase,
      row,
      eventAt,
    );

    if (updErr) {
      console.error("trial_entitlements revert failed", {
        userId: row.user_id,
        eventType: event.type,
        eventAt,
        error: updErr,
      });
      return new Response("update failed", { status: 500 });
    }
    if (!applied) {
      console.info("revenuecat cancellation update raced (no rows applied)", {
        userId: row.user_id,
        eventType: event.type,
        eventAt,
      });
      return new Response("ok (raced)", { status: 200 });
    }
    // Habits are deliberately NOT auto-re-archived — see spec E7. The user
    // sees the existing read-only / paywall UI on next sync, and any habits
    // they added while paid stay visible in the picker.
    return new Response("ok (reverted)", { status: 200 });
  }

  // Unreachable; defensive return.
  return new Response("ok", { status: 200 });
}

// Entry point used by the Supabase Edge runtime.
if (import.meta.main) {
  Deno.serve(async (req) => {
    const secret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!secret || !supabaseUrl || !serviceRoleKey) {
      return new Response("server misconfigured", { status: 500 });
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
    return handleWebhook(req, { secret, supabase });
  });
}
