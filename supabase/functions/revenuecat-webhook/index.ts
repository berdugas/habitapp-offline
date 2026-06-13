// Supabase Edge Function: revenuecat-webhook
//
// Receives RevenueCat webhook POSTs, verifies the bearer-token Authorization
// header against REVENUECAT_WEBHOOK_SECRET (set via `supabase secrets set`),
// and routes events:
//
//   - INITIAL_PURCHASE / NON_RENEWING_PURCHASE -> entitlement_status='paid'
//   - CANCELLATION                              -> revert (Task 7)
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
  product_id?: string;
  cancel_reason?: string;
  event_timestamp_ms?: number;
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
  if (!event.app_user_id || typeof event.app_user_id !== "string") {
    return new Response("missing app_user_id", { status: 400 });
  }
  // 3. Route gate
  const isPaid = PAID_EVENT_TYPES.has(event.type);
  const isCancel = event.type === "CANCELLATION";
  if (!isPaid && !isCancel) {
    return new Response("ok (no-op)", { status: 200 });
  }

  // 3b. event_timestamp_ms required only for events we actually act on.
  if (typeof event.event_timestamp_ms !== "number") {
    return new Response("missing event_timestamp_ms", { status: 400 });
  }
  const eventAt = new Date(event.event_timestamp_ms).toISOString();

  // 4. Read current row for idempotency + (CANCELLATION) revert decision.
  const { data: row, error: readErr } = await deps.supabase
    .from("trial_entitlements")
    .select("entitlement_status, trial_ends_at, last_revenuecat_event_at")
    .eq("user_id", event.app_user_id)
    .maybeSingle();

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
    console.error("trial_entitlements row missing for incoming event", {
      userId: event.app_user_id,
      eventType: event.type,
      eventAt,
    });
    return new Response("user not found", { status: 404 });
  }

  // 5. Idempotency: reject events older-or-equal to last applied.
  if (row.last_revenuecat_event_at) {
    const lastAt = new Date(row.last_revenuecat_event_at as string).getTime();
    if (event.event_timestamp_ms <= lastAt) {
      console.info("revenuecat event ignored (idempotent)", {
        userId: event.app_user_id,
        eventType: event.type,
        eventAt,
        lastAt: row.last_revenuecat_event_at,
      });
      return new Response("ok (idempotent)", { status: 200 });
    }
  }

  // 6. Route.
  if (isPaid) {
    // Atomic update: only apply if no newer event has already won the row.
    // The .or() filter is ANDed with the .eq("user_id", ...) clause.
    const { data: updated, error: updErr } = await deps.supabase
      .from("trial_entitlements")
      .update({
        entitlement_status: "paid",
        last_validated_at: new Date().toISOString(),
        last_revenuecat_event_at: eventAt,
      })
      .eq("user_id", event.app_user_id)
      .or(
        `last_revenuecat_event_at.is.null,last_revenuecat_event_at.lt.${eventAt}`,
      )
      .select();

    if (updErr) {
      console.error("trial_entitlements update failed", {
        userId: event.app_user_id,
        eventType: event.type,
        eventAt,
        error: updErr,
      });
      return new Response("update failed", { status: 500 });
    }
    if (!updated || updated.length === 0) {
      // Lost the race to a concurrent (newer) delivery between our SELECT
      // and our UPDATE. The atomic filter on UPDATE rejected our write.
      console.info("revenuecat paid update raced (no rows applied)", {
        userId: event.app_user_id,
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
        userId: event.app_user_id,
        currentStatus: row.entitlement_status,
        eventAt,
      });
      return new Response("ok (no-op — not paid)", { status: 200 });
    }

    const trialEndsAt = new Date(row.trial_ends_at as string).getTime();
    const newStatus = trialEndsAt > Date.now() ? "trial" : "expired";

    // Atomic revert: gate on (a) still currently paid (so a concurrent
    // writer that flipped the row off paid wins) and (b) no newer event
    // already applied (so an INITIAL_PURCHASE arriving after this
    // CANCELLATION with a newer timestamp keeps the row paid).
    const { data: updated, error: updErr } = await deps.supabase
      .from("trial_entitlements")
      .update({
        entitlement_status: newStatus,
        last_validated_at: new Date().toISOString(),
        last_revenuecat_event_at: eventAt,
      })
      .eq("user_id", event.app_user_id)
      .eq("entitlement_status", "paid")
      .or(
        `last_revenuecat_event_at.is.null,last_revenuecat_event_at.lt.${eventAt}`,
      )
      .select();

    if (updErr) {
      console.error("trial_entitlements revert failed", {
        userId: event.app_user_id,
        eventType: event.type,
        eventAt,
        error: updErr,
      });
      return new Response("update failed", { status: 500 });
    }
    if (!updated || updated.length === 0) {
      // Lost the race to a concurrent writer (paid status flipped off, or
      // a newer event already applied).
      console.info("revenuecat cancellation update raced (no rows applied)", {
        userId: event.app_user_id,
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
