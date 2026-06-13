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

// RevenueCat assigns anonymous identities the prefix "$RCAnonymousID:"
// when the SDK is configured before a logIn(supabaseUserId) call. Those
// strings cannot be cast to the uuid type the trial_entitlements.user_id
// column (and the revenuecat_demote RPC's p_user_id arg) require, so any
// SQL touching them errors with Postgres 22P02 BEFORE the destination's
// promote can run. Skip non-UUID source AND destination identities up
// front; for our model real customers always have a Supabase Auth UUID.
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(s: string): boolean {
  return UUID_REGEX.test(s);
}

// PAID promotion fires for the three event types that grant or
// re-grant lifetime entitlement:
//   - INITIAL_PURCHASE        — first non-renewing purchase
//   - NON_RENEWING_PURCHASE   — subsequent non-renewing purchases (rare
//                               for our one-product model but spec'd)
//   - REFUND_REVERSED         — Apple/Google reversed a previous refund;
//                               user regains access. Without this branch
//                               a reversed refund leaves the customer
//                               permanently locked out.
const PAID_EVENT_TYPES = new Set([
  "INITIAL_PURCHASE",
  "NON_RENEWING_PURCHASE",
  "REFUND_REVERSED",
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
//
// Non-UUID candidates (e.g. $RCAnonymousID:...) are skipped because
// trial_entitlements.user_id is a uuid column — passing one would
// trigger Postgres 22P02 and propagate as a 500 to the caller. Those
// identities cannot have a row anyway in our model.
async function findTrialRow(
  supabase: SupabaseClient,
  candidates: string[],
): Promise<{ row: TrialRow | null; error: unknown }> {
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (!isUuid(candidate)) continue;
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

// Atomic demote via the revenuecat_demote SQL RPC. ONE statement that:
//   - if current status='paid' (at SQL eval time, not at the application's
//     earlier SELECT) → demote to 'trial' (still in trial window) or
//     'expired' (otherwise), AND advance anchor
//   - else → just advance anchor
//   - in either case, only if anchor is null or older than eventAt
// Collapses the previous SELECT-decide-UPDATE-or-UPDATE two-step into a
// single Postgres-serialized write. Closes the race where a concurrent
// INITIAL_PURCHASE flips status='paid' between our application SELECT
// and a separate anchor-only UPDATE. See migration
// 20260613130000_revenuecat_demote_rpc.sql for full rationale.
async function applyDemoteAtomic(
  supabase: SupabaseClient,
  userId: string,
  eventAt: string,
): Promise<{
  applied: boolean;
  finalStatus: string | null;
  error: unknown;
}> {
  const { data, error } = await supabase.rpc("revenuecat_demote", {
    p_user_id: userId,
    p_event_at: eventAt,
  });
  if (error) return { applied: false, finalStatus: null, error };
  // RPCs returning TABLE come back as an array of objects.
  const row = Array.isArray(data) ? data[0] : data;
  return {
    applied: !!row?.applied,
    finalStatus: (row?.final_status as string | null) ?? null,
    error: null,
  };
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
    let demoteSkippedNonUuid = 0;
    for (const userId of transferredFrom) {
      // RC anonymous IDs ($RCAnonymousID:...) cannot cast to uuid and
      // would 500 the RPC, blocking the destination promotion below.
      // Skip them silently — they have no trial_entitlements row to
      // demote anyway.
      if (!isUuid(userId)) {
        demoteSkippedNonUuid++;
        console.info("transfer demote: skipping non-UUID source id", {
          userId,
          eventAt,
        });
        continue;
      }
      // Atomic demote — single SQL RPC. Either reverts paid→trial/expired
      // OR advances anchor only, based on the current row state at SQL
      // eval time (not at any earlier SELECT). Race-safe against a
      // concurrent INITIAL_PURCHASE for the same user. Returns
      // applied=false when no row exists OR the anchor has already
      // advanced past eventAt — both are correct silent no-ops here
      // (anonymous source, or duplicate delivery).
      const { applied, error } = await applyDemoteAtomic(
        deps.supabase,
        userId,
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
    let promoteIdempotent = 0;
    let promoteSkippedNonUuid = 0;
    const missingDestRows: string[] = [];
    for (const userId of transferredTo) {
      // Same UUID guard as the demote loop — non-UUID destinations
      // would error the SELECT (Postgres 22P02 on the uuid cast) and
      // poison the rest of the loop. In our model destinations are
      // always Supabase Auth UUIDs; an anonymous destination wouldn't
      // correspond to a purchasable account anyway.
      if (!isUuid(userId)) {
        promoteSkippedNonUuid++;
        console.info("transfer promote: skipping non-UUID destination id", {
          userId,
          eventAt,
        });
        continue;
      }
      // SELECT first so we can distinguish "row missing entirely" from
      // "row exists but anchor already advanced" — the atomic UPDATE
      // collapses both to data: [] otherwise. Returning 200 on a missing
      // destination row would mark RC's TRANSFER as delivered without
      // crediting the entitlement, permanently losing the purchase.
      const { row: destRow, error: readErr } = await findTrialRow(
        deps.supabase,
        [userId],
      );
      if (readErr) {
        console.error("transfer promote read failed", {
          userId,
          eventAt,
          error: readErr,
        });
        return new Response("read failed", { status: 500 });
      }
      if (!destRow) {
        // Anomalous: a TRANSFER destination identity should map to a
        // Supabase user (the app calls Purchases.logIn(supabaseUserId)
        // before any purchase). If the row is missing the signup trigger
        // may have raced TRANSFER delivery, or a deletion happened, or
        // the destination identity is unknown. Surface the failure so RC
        // retries (up to 5 attempts) and emit a clear log line.
        missingDestRows.push(userId);
        console.error("transfer promote: destination row missing", {
          userId,
          eventAt,
        });
        continue;
      }
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
      if (applied) {
        promoteApplied++;
      } else {
        // Row exists but anchor already at-or-past eventAt — known
        // idempotent. Acknowledge as success.
        promoteIdempotent++;
      }
    }
    if (missingDestRows.length > 0) {
      console.error("transfer rejected: missing destination rows", {
        eventAt,
        missingDestRows,
        demoteApplied,
        promoteApplied,
        promoteIdempotent,
      });
      // 503 invites RC's retry (it retries non-200 up to 5 times). By
      // then the destination row may exist (handle_new_user trigger
      // finishes after signup); if it never appears we accept the
      // permanent failure with logs visible in Supabase function logs.
      return new Response(
        "transfer destination row missing — retry expected",
        { status: 503 },
      );
    }
    console.info("transfer applied", {
      eventAt,
      demoteCount: demoteApplied,
      demoteSkippedNonUuid,
      promoteCount: promoteApplied,
      promoteIdempotent,
      promoteSkippedNonUuid,
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

  // CANCELLATION — refund or chargeback. ONE atomic RPC call handles
  // both the revert-when-paid AND advance-anchor-when-not-paid paths in
  // a single SQL statement. Previously this branched in application
  // code: if our SELECT saw status='paid' we did a revert-UPDATE, else
  // an anchor-only UPDATE. A concurrent INITIAL_PURCHASE could land in
  // the WINDOW between our SELECT and our anchor-only UPDATE, flipping
  // status='paid' and leaving the row permanently paid with anchor=T2.
  // The RPC's CASE expression evaluates at SQL time, eliminating that
  // window — see migration 20260613130000_revenuecat_demote_rpc.sql.
  if (isCancel) {
    const { applied, finalStatus, error: updErr } = await applyDemoteAtomic(
      deps.supabase,
      row.user_id,
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
    // Note: row.entitlement_status is the value at our pre-SELECT and may
    // be stale relative to finalStatus when a concurrent INITIAL_PURCHASE
    // raced between SELECT and the RPC. The RPC's CASE handled either
    // case atomically — finalStatus is authoritative.
    console.info("CANCELLATION applied", {
      userId: row.user_id,
      preStatus: row.entitlement_status,
      finalStatus,
      eventAt,
    });
    return new Response("ok (applied)", { status: 200 });
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
