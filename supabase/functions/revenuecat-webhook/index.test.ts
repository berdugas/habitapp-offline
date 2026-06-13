import { assertEquals } from "https://deno.land/std@0.220.0/assert/mod.ts";
import { handleWebhook } from "./index.ts";

// Builds a mock Supabase client that records SELECT and UPDATE calls.
//
// The UPDATE chain supports an arbitrary sequence of `.eq()` and `.or()`
// filters (the production code adds `.eq("entitlement_status", "paid")`
// on CANCELLATION and an `.or(last_revenuecat_event_at...)` filter on
// both paths). The mock records every filter call so tests can assert on
// them, and returns the configured `updatedRows` from `.select()` so
// tests can simulate the race-loser case by setting `updatedRows: []`.
//
// `selectRow` is either a single row (returned for every SELECT, with
// `user_id` auto-injected from the `.eq("user_id", X)` filter so
// production code reading `row.user_id` works), or a map of user_id to
// row for tests (TRANSFER) that exercise multiple users in one
// invocation. Pass `null` (or omit) to simulate the row-missing branch.
type SelectRowShape =
  | { entitlement_status?: string; trial_ends_at?: string; last_revenuecat_event_at?: string | null; user_id?: string }
  | null;
type UpdateCall = {
  table: string;
  values: Record<string, unknown>;
  userId: string;
  filters: Array<{ kind: "eq" | "or"; column?: string; value?: unknown; expr?: string }>;
};
type SelectCall = { table: string; userId: string };
function mockSupabase(opts: {
  selectRow?: SelectRowShape;
  selectRowsByUserId?: Record<string, SelectRowShape>;
  updatedRows?: Array<Record<string, unknown>>;
  updatedRowsByUserId?: Record<string, Array<Record<string, unknown>>>;
} = {}) {
  const calls: UpdateCall[] = [];
  const selectCalls: SelectCall[] = [];
  const updatedRows = opts.updatedRows === undefined ? [{}] : opts.updatedRows;
  function resolveSelect(userId: string): SelectRowShape {
    if (opts.selectRowsByUserId && Object.prototype.hasOwnProperty.call(opts.selectRowsByUserId, userId)) {
      const row = opts.selectRowsByUserId[userId];
      if (!row) return null;
      // Auto-inject user_id so production code can read row.user_id.
      return { ...row, user_id: row.user_id ?? userId };
    }
    if (opts.selectRow === undefined) return null;
    if (opts.selectRow === null) return null;
    return { ...opts.selectRow, user_id: opts.selectRow.user_id ?? userId };
  }
  function resolveUpdated(userId: string) {
    if (opts.updatedRowsByUserId && Object.prototype.hasOwnProperty.call(opts.updatedRowsByUserId, userId)) {
      return opts.updatedRowsByUserId[userId];
    }
    return updatedRows;
  }
  return {
    from: (table: string) => ({
      select: (_cols: string) => ({
        eq: (col: string, val: unknown) => ({
          maybeSingle: () => {
            const userId = col === "user_id" ? (val as string) : "";
            selectCalls.push({ table, userId });
            return Promise.resolve({ data: resolveSelect(userId), error: null });
          },
        }),
      }),
      update: (values: Record<string, unknown>) => {
        let currentCall: UpdateCall | null = null;
        const builder = {
          eq(col: string, val: unknown) {
            if (col === "user_id") {
              currentCall = {
                table,
                values,
                userId: val as string,
                filters: [],
              };
              calls.push(currentCall);
            } else if (currentCall) {
              currentCall.filters.push({ kind: "eq", column: col, value: val });
            } else {
              throw new Error(
                `unexpected eq before user_id: ${col}`,
              );
            }
            return builder;
          },
          or(expr: string) {
            if (currentCall) {
              currentCall.filters.push({ kind: "or", expr });
            }
            return builder;
          },
          select() {
            const data = currentCall ? resolveUpdated(currentCall.userId) : updatedRows;
            return Promise.resolve({ data, error: null });
          },
        };
        return builder;
      },
    }),
    _calls: calls,
    _selectCalls: selectCalls,
  };
}

function evt(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    event: {
      type: "INITIAL_PURCHASE",
      app_user_id: "u1",
      product_id: "lifetime_unlock",
      event_timestamp_ms: 1_000_000_000_000,
      ...overrides,
    },
  };
}

function req(body: Record<string, unknown>, auth: string | null = "Bearer shhh"): Request {
  const headers: Record<string, string> = {};
  if (auth) headers.Authorization = auth;
  return new Request("https://example.com", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

Deno.test("rejects requests without Authorization header (401)", async () => {
  const sb = mockSupabase();
  const res = await handleWebhook(req(evt(), null), { secret: "shhh", supabase: sb as never });
  assertEquals(res.status, 401);
  assertEquals(sb._calls.length, 0);
});

Deno.test("rejects requests with wrong bearer token (401)", async () => {
  const sb = mockSupabase();
  const res = await handleWebhook(req(evt(), "Bearer wrong"), { secret: "shhh", supabase: sb as never });
  assertEquals(res.status, 401);
});

Deno.test("returns 400 when event.app_user_id is missing", async () => {
  const sb = mockSupabase();
  const res = await handleWebhook(req(evt({ app_user_id: undefined })), { secret: "shhh", supabase: sb as never });
  assertEquals(res.status, 400);
});

Deno.test("returns 400 when event.event_timestamp_ms is missing on a PAID event", async () => {
  const sb = mockSupabase();
  const res = await handleWebhook(req(evt({ event_timestamp_ms: undefined })), { secret: "shhh", supabase: sb as never });
  assertEquals(res.status, 400);
});

Deno.test("no-op event types don't require event_timestamp_ms (runbook curl path)", async () => {
  const sb = mockSupabase();
  const res = await handleWebhook(
    req(evt({ type: "TEST", event_timestamp_ms: undefined })),
    { secret: "shhh", supabase: sb as never },
  );
  assertEquals(res.status, 200);
  assertEquals(sb._calls.length, 0);
});

Deno.test("flips entitlement_status to 'paid' on INITIAL_PURCHASE", async () => {
  const sb = mockSupabase({ selectRow: { entitlement_status: "trial", trial_ends_at: "2099-01-01T00:00:00Z", last_revenuecat_event_at: null } });
  const res = await handleWebhook(req(evt()), { secret: "shhh", supabase: sb as never });
  assertEquals(res.status, 200);
  assertEquals(sb._calls.length, 1);
  assertEquals(sb._calls[0].table, "trial_entitlements");
  assertEquals(sb._calls[0].values.entitlement_status, "paid");
  assertEquals(sb._calls[0].userId, "u1");
});

Deno.test("flips entitlement_status to 'paid' on NON_RENEWING_PURCHASE", async () => {
  const sb = mockSupabase({ selectRow: { entitlement_status: "trial", trial_ends_at: "2099-01-01T00:00:00Z", last_revenuecat_event_at: null } });
  const res = await handleWebhook(req(evt({ type: "NON_RENEWING_PURCHASE" })), { secret: "shhh", supabase: sb as never });
  assertEquals(res.status, 200);
  assertEquals(sb._calls[0].values.entitlement_status, "paid");
});

Deno.test("ignores unknown event types (200 no-op)", async () => {
  const sb = mockSupabase();
  const res = await handleWebhook(req(evt({ type: "TEST_EVENT" })), { secret: "shhh", supabase: sb as never });
  assertEquals(res.status, 200);
  assertEquals(sb._calls.length, 0);
});

Deno.test("returns 404 when no trial_entitlements row exists for app_user_id", async () => {
  const sb = mockSupabase({ selectRow: null });
  const res = await handleWebhook(req(evt()), { secret: "shhh", supabase: sb as never });
  assertEquals(res.status, 404);
  assertEquals(sb._calls.length, 0);
});

Deno.test("idempotency: rejects an event older than last_revenuecat_event_at (200 no-op)", async () => {
  const sb = mockSupabase({
    selectRow: {
      entitlement_status: "expired",
      trial_ends_at: "2026-01-01T00:00:00Z",
      last_revenuecat_event_at: new Date(2_000_000_000_000).toISOString(),
    },
  });
  const res = await handleWebhook(req(evt()), { secret: "shhh", supabase: sb as never });
  assertEquals(res.status, 200);
  assertEquals(sb._calls.length, 0);
});

Deno.test("idempotency: rejects a re-delivery with the same event_timestamp_ms (200 no-op)", async () => {
  const sb = mockSupabase({
    selectRow: {
      entitlement_status: "paid",
      trial_ends_at: "2099-01-01T00:00:00Z",
      last_revenuecat_event_at: new Date(1_000_000_000_000).toISOString(),
    },
  });
  const res = await handleWebhook(req(evt()), { secret: "shhh", supabase: sb as never });
  assertEquals(res.status, 200);
  assertEquals(sb._calls.length, 0);
});

Deno.test("applies the event when last_revenuecat_event_at is older than incoming", async () => {
  const sb = mockSupabase({
    selectRow: {
      entitlement_status: "trial",
      trial_ends_at: "2099-01-01T00:00:00Z",
      last_revenuecat_event_at: new Date(500_000_000_000).toISOString(),
    },
  });
  const res = await handleWebhook(req(evt()), { secret: "shhh", supabase: sb as never });
  assertEquals(res.status, 200);
  assertEquals(sb._calls.length, 1);
  assertEquals(sb._calls[0].values.entitlement_status, "paid");
});

Deno.test("CANCELLATION reverts paid -> 'expired' when trial_ends_at is in the past", async () => {
  const sb = mockSupabase({
    selectRow: {
      entitlement_status: "paid",
      trial_ends_at: new Date(Date.now() - 86_400_000).toISOString(),
      last_revenuecat_event_at: null,
    },
  });
  const res = await handleWebhook(
    req(evt({ type: "CANCELLATION", cancel_reason: "CUSTOMER_SUPPORT" })),
    { secret: "shhh", supabase: sb as never },
  );
  assertEquals(res.status, 200);
  assertEquals(sb._calls.length, 1);
  assertEquals(sb._calls[0].values.entitlement_status, "expired");
});

Deno.test("CANCELLATION reverts paid -> 'trial' when trial_ends_at is in the future", async () => {
  const sb = mockSupabase({
    selectRow: {
      entitlement_status: "paid",
      trial_ends_at: new Date(Date.now() + 86_400_000).toISOString(),
      last_revenuecat_event_at: null,
    },
  });
  const res = await handleWebhook(
    req(evt({ type: "CANCELLATION", cancel_reason: "BILLING_ERROR" })),
    { secret: "shhh", supabase: sb as never },
  );
  assertEquals(res.status, 200);
  assertEquals(sb._calls[0].values.entitlement_status, "trial");
});

Deno.test("CANCELLATION is a no-op when current entitlement is not 'paid'", async () => {
  const sb = mockSupabase({
    selectRow: {
      entitlement_status: "expired",
      trial_ends_at: new Date(Date.now() + 86_400_000).toISOString(),
      last_revenuecat_event_at: null,
    },
  });
  const res = await handleWebhook(
    req(evt({ type: "CANCELLATION" })),
    { secret: "shhh", supabase: sb as never },
  );
  assertEquals(res.status, 200);
  // No UPDATE — the row was already non-paid (probably a duplicate
  // cancellation delivery).
  assertEquals(sb._calls.length, 0);
});

// --- Race-condition coverage: the UPDATE itself is atomic, so even if
// two webhook invocations both pass the upfront SELECT-and-pre-check, the
// SQL filter on UPDATE only lets one apply. Simulate this by configuring
// the mock to return `updatedRows: []` (the conditional WHERE matched no
// row), which is what real Postgres would return when a concurrent newer
// event already advanced last_revenuecat_event_at past ours.

Deno.test("PAID update: lost race to a concurrent newer write returns 200 (raced)", async () => {
  const sb = mockSupabase({
    selectRow: {
      entitlement_status: "trial",
      trial_ends_at: "2099-01-01T00:00:00Z",
      last_revenuecat_event_at: null,
    },
    // SQL-level conditional filter rejected our write (a concurrent newer
    // event landed between our SELECT and UPDATE).
    updatedRows: [],
  });
  const res = await handleWebhook(req(evt()), { secret: "shhh", supabase: sb as never });
  assertEquals(res.status, 200);
  // Update attempt WAS sent (idempotency is enforced server-side, not in
  // application code). The mock recorded the call.
  assertEquals(sb._calls.length, 1);
  // The UPDATE includes the atomic anchor filter as an .or() clause.
  const orFilter = sb._calls[0].filters.find((f) => f.kind === "or");
  assertEquals(orFilter !== undefined, true);
});

Deno.test("PAID update: atomic UPDATE includes the timestamp-anchor or() filter", async () => {
  const sb = mockSupabase({
    selectRow: {
      entitlement_status: "trial",
      trial_ends_at: "2099-01-01T00:00:00Z",
      last_revenuecat_event_at: null,
    },
  });
  await handleWebhook(req(evt()), { secret: "shhh", supabase: sb as never });
  const filters = sb._calls[0].filters;
  const orFilter = filters.find((f) => f.kind === "or");
  assertEquals(orFilter?.kind, "or");
  // The .or() expression names the anchor column and uses both
  // "is.null" and "lt.<eventAt>" branches.
  assertEquals(
    typeof orFilter?.expr === "string" &&
      orFilter.expr.includes("last_revenuecat_event_at.is.null") &&
      orFilter.expr.includes("last_revenuecat_event_at.lt."),
    true,
  );
});

Deno.test("CANCELLATION update: lost race to a concurrent newer write returns 200 (raced)", async () => {
  const sb = mockSupabase({
    selectRow: {
      entitlement_status: "paid",
      trial_ends_at: new Date(Date.now() - 86_400_000).toISOString(),
      last_revenuecat_event_at: null,
    },
    updatedRows: [],
  });
  const res = await handleWebhook(
    req(evt({ type: "CANCELLATION" })),
    { secret: "shhh", supabase: sb as never },
  );
  assertEquals(res.status, 200);
  assertEquals(sb._calls.length, 1);
  // CANCELLATION update gates on both entitlement_status='paid' AND the
  // anchor — verify both filters are present.
  const filters = sb._calls[0].filters;
  const eqPaidFilter = filters.find(
    (f) => f.kind === "eq" && f.column === "entitlement_status" && f.value === "paid",
  );
  const orAnchorFilter = filters.find((f) => f.kind === "or");
  assertEquals(eqPaidFilter !== undefined, true);
  assertEquals(orAnchorFilter !== undefined, true);
});

// === TRANSFER event coverage =================================================
// TRANSFER events have no app_user_id. They carry transferred_from / transferred_to
// arrays. Each transferred_from user is demoted (paid -> trial/expired); each
// transferred_to user is promoted to paid. Both writes are atomic.

Deno.test("TRANSFER: missing both transferred_from and transferred_to returns 400", async () => {
  const sb = mockSupabase();
  const res = await handleWebhook(
    req(evt({ type: "TRANSFER", app_user_id: undefined })),
    { secret: "shhh", supabase: sb as never },
  );
  assertEquals(res.status, 400);
});

Deno.test("TRANSFER: does NOT require app_user_id (regression: old handler 400'd here)", async () => {
  // Before the fix, the handler rejected TRANSFER on missing app_user_id
  // before reaching the route gate. That blocked the retry forever.
  const sb = mockSupabase({
    selectRowsByUserId: {
      "user-old": {
        entitlement_status: "paid",
        trial_ends_at: "2099-01-01T00:00:00Z",
        last_revenuecat_event_at: null,
      },
    },
  });
  const res = await handleWebhook(
    req(
      evt({
        type: "TRANSFER",
        app_user_id: undefined,
        transferred_from: ["user-old"],
        transferred_to: ["user-new"],
      }),
    ),
    { secret: "shhh", supabase: sb as never },
  );
  assertEquals(res.status, 200);
});

Deno.test("TRANSFER: demotes transferred_from user (paid -> trial/expired)", async () => {
  const sb = mockSupabase({
    selectRowsByUserId: {
      "user-old": {
        entitlement_status: "paid",
        trial_ends_at: new Date(Date.now() - 86_400_000).toISOString(),
        last_revenuecat_event_at: null,
      },
    },
  });
  const res = await handleWebhook(
    req(
      evt({
        type: "TRANSFER",
        app_user_id: undefined,
        transferred_from: ["user-old"],
        transferred_to: [],
      }),
    ),
    { secret: "shhh", supabase: sb as never },
  );
  assertEquals(res.status, 200);
  // Exactly one UPDATE call, targeting user-old, demoting to 'expired'.
  assertEquals(sb._calls.length, 1);
  assertEquals(sb._calls[0].userId, "user-old");
  assertEquals(sb._calls[0].values.entitlement_status, "expired");
  // Demote is gated on entitlement_status='paid' (atomic).
  const eqPaid = sb._calls[0].filters.find(
    (f) => f.kind === "eq" && f.column === "entitlement_status" && f.value === "paid",
  );
  assertEquals(eqPaid !== undefined, true);
});

Deno.test("TRANSFER: promotes transferred_to user to 'paid'", async () => {
  const sb = mockSupabase({
    selectRowsByUserId: { "user-new": null }, // no row lookup needed for promote
  });
  const res = await handleWebhook(
    req(
      evt({
        type: "TRANSFER",
        app_user_id: undefined,
        transferred_from: [],
        transferred_to: ["user-new"],
      }),
    ),
    { secret: "shhh", supabase: sb as never },
  );
  assertEquals(res.status, 200);
  assertEquals(sb._calls.length, 1);
  assertEquals(sb._calls[0].userId, "user-new");
  assertEquals(sb._calls[0].values.entitlement_status, "paid");
});

Deno.test("TRANSFER: transferred_from user with missing row is silently skipped", async () => {
  const sb = mockSupabase({
    selectRowsByUserId: { "user-anonymous": null },
  });
  const res = await handleWebhook(
    req(
      evt({
        type: "TRANSFER",
        app_user_id: undefined,
        transferred_from: ["user-anonymous"],
        transferred_to: [],
      }),
    ),
    { secret: "shhh", supabase: sb as never },
  );
  // 200, no UPDATEs.
  assertEquals(res.status, 200);
  assertEquals(sb._calls.length, 0);
});

Deno.test("TRANSFER: applies both demote and promote in one event", async () => {
  const sb = mockSupabase({
    selectRowsByUserId: {
      "user-old": {
        entitlement_status: "paid",
        trial_ends_at: "2099-01-01T00:00:00Z",
        last_revenuecat_event_at: null,
      },
    },
  });
  const res = await handleWebhook(
    req(
      evt({
        type: "TRANSFER",
        app_user_id: undefined,
        transferred_from: ["user-old"],
        transferred_to: ["user-new"],
      }),
    ),
    { secret: "shhh", supabase: sb as never },
  );
  assertEquals(res.status, 200);
  // Two writes: demote user-old + promote user-new.
  assertEquals(sb._calls.length, 2);
  const demoteCall = sb._calls.find((c) => c.userId === "user-old");
  const promoteCall = sb._calls.find((c) => c.userId === "user-new");
  assertEquals(demoteCall?.values.entitlement_status, "trial"); // still in trial window
  assertEquals(promoteCall?.values.entitlement_status, "paid");
});

Deno.test("paid event: falls back to original_app_user_id when app_user_id row is missing", async () => {
  const sb = mockSupabase({
    selectRowsByUserId: {
      "u-current": null,                  // current id has no row
      "u-original": {                      // original id does
        entitlement_status: "trial",
        trial_ends_at: "2099-01-01T00:00:00Z",
        last_revenuecat_event_at: null,
      },
    },
  });
  const res = await handleWebhook(
    req(
      evt({
        app_user_id: "u-current",
        original_app_user_id: "u-original",
      }),
    ),
    { secret: "shhh", supabase: sb as never },
  );
  assertEquals(res.status, 200);
  // UPDATE targets the original id (the row we found via fallback).
  assertEquals(sb._calls.length, 1);
  assertEquals(sb._calls[0].userId, "u-original");
  assertEquals(sb._calls[0].values.entitlement_status, "paid");
});
