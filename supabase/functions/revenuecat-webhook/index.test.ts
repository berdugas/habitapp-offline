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
type RpcCall = { name: string; args: Record<string, unknown> };
type RpcResultShape = { applied?: boolean; final_status?: string | null; final_anchor?: string | null };
function mockSupabase(opts: {
  selectRow?: SelectRowShape;
  selectRowsByUserId?: Record<string, SelectRowShape>;
  updatedRows?: Array<Record<string, unknown>>;
  updatedRowsByUserId?: Record<string, Array<Record<string, unknown>>>;
  // RPC results. Pass a single result for all calls, or a function that
  // decides per-call (e.g. simulating race: first call returns
  // applied=true, second returns applied=false). Defaults to a fresh
  // applied=true row reflecting an idle non-paid state.
  rpcResult?: RpcResultShape | ((args: Record<string, unknown>, idx: number) => RpcResultShape);
} = {}) {
  const calls: UpdateCall[] = [];
  const selectCalls: SelectCall[] = [];
  const rpcCalls: RpcCall[] = [];
  const updatedRows = opts.updatedRows === undefined ? [{}] : opts.updatedRows;
  function resolveRpc(args: Record<string, unknown>): RpcResultShape {
    if (typeof opts.rpcResult === "function") {
      return opts.rpcResult(args, rpcCalls.length - 1);
    }
    if (opts.rpcResult) return opts.rpcResult;
    // Default: simulate "applied=true, final_status='trial'" so the
    // happy-path tests don't all need to spell it out.
    return {
      applied: true,
      final_status: "trial",
      final_anchor: (args.p_event_at as string) ?? null,
    };
  }
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
    rpc(name: string, args: Record<string, unknown>) {
      rpcCalls.push({ name, args });
      const result = resolveRpc(args);
      return Promise.resolve({ data: [result], error: null });
    },
    _calls: calls,
    _selectCalls: selectCalls,
    _rpcCalls: rpcCalls,
  };
}

function evt(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    event: {
      type: "INITIAL_PURCHASE",
      app_user_id: "00000000-0000-0000-0000-000000000001",
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
  assertEquals(sb._calls[0].userId, "00000000-0000-0000-0000-000000000001");
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

Deno.test("CANCELLATION calls the revenuecat_demote RPC with the correct args (paid revert path)", async () => {
  const sb = mockSupabase({
    selectRow: {
      entitlement_status: "paid",
      trial_ends_at: new Date(Date.now() - 86_400_000).toISOString(),
      last_revenuecat_event_at: null,
    },
    rpcResult: { applied: true, final_status: "expired", final_anchor: new Date(1_000_000_000_000).toISOString() },
  });
  const res = await handleWebhook(
    req(evt({ type: "CANCELLATION", cancel_reason: "CUSTOMER_SUPPORT" })),
    { secret: "shhh", supabase: sb as never },
  );
  assertEquals(res.status, 200);
  // No direct .update() — all writes go through the RPC.
  assertEquals(sb._calls.length, 0);
  assertEquals(sb._rpcCalls.length, 1);
  assertEquals(sb._rpcCalls[0].name, "revenuecat_demote");
  assertEquals(sb._rpcCalls[0].args.p_user_id, "00000000-0000-0000-0000-000000000001");
  assertEquals(
    sb._rpcCalls[0].args.p_event_at,
    new Date(1_000_000_000_000).toISOString(),
  );
});

Deno.test("CANCELLATION returns 200 when the RPC reports applied=true (revert succeeded)", async () => {
  const sb = mockSupabase({
    selectRow: {
      entitlement_status: "paid",
      trial_ends_at: new Date(Date.now() + 86_400_000).toISOString(),
      last_revenuecat_event_at: null,
    },
    rpcResult: { applied: true, final_status: "trial", final_anchor: new Date(1_000_000_000_000).toISOString() },
  });
  const res = await handleWebhook(
    req(evt({ type: "CANCELLATION", cancel_reason: "BILLING_ERROR" })),
    { secret: "shhh", supabase: sb as never },
  );
  assertEquals(res.status, 200);
});

Deno.test("CANCELLATION on already-non-paid row delegates to RPC (which is responsible for atomic anchor advance + race protection)", async () => {
  // The RPC handles both "demote if paid" and "advance anchor if not"
  // in a single SQL statement. Application code no longer branches on
  // row.entitlement_status — it just calls the RPC.
  const sb = mockSupabase({
    selectRow: {
      entitlement_status: "expired",
      trial_ends_at: new Date(Date.now() + 86_400_000).toISOString(),
      last_revenuecat_event_at: null,
    },
    rpcResult: { applied: true, final_status: "expired", final_anchor: new Date(1_000_000_000_000).toISOString() },
  });
  const res = await handleWebhook(
    req(evt({ type: "CANCELLATION" })),
    { secret: "shhh", supabase: sb as never },
  );
  assertEquals(res.status, 200);
  assertEquals(sb._rpcCalls.length, 1);
  assertEquals(sb._rpcCalls[0].name, "revenuecat_demote");
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

Deno.test("CANCELLATION RPC returning applied=false (lost race / idempotent) returns 200", async () => {
  // RPC returns applied=false when no row matched the WHERE (no row, or
  // anchor already at-or-past eventAt). Either way RC retries would
  // not produce a different result, so respond 200.
  const sb = mockSupabase({
    selectRow: {
      entitlement_status: "paid",
      trial_ends_at: new Date(Date.now() - 86_400_000).toISOString(),
      last_revenuecat_event_at: null,
    },
    rpcResult: { applied: false, final_status: null, final_anchor: null },
  });
  const res = await handleWebhook(
    req(evt({ type: "CANCELLATION" })),
    { secret: "shhh", supabase: sb as never },
  );
  assertEquals(res.status, 200);
  assertEquals(sb._rpcCalls.length, 1);
  assertEquals(sb._calls.length, 0);
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
      "00000000-0000-0000-0000-00000000aaaa": {
        entitlement_status: "paid",
        trial_ends_at: "2099-01-01T00:00:00Z",
        last_revenuecat_event_at: null,
      },
      "00000000-0000-0000-0000-00000000bbbb": {
        entitlement_status: "trial",
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
        transferred_from: ["00000000-0000-0000-0000-00000000aaaa"],
        transferred_to: ["00000000-0000-0000-0000-00000000bbbb"],
      }),
    ),
    { secret: "shhh", supabase: sb as never },
  );
  assertEquals(res.status, 200);
});

Deno.test("TRANSFER: demotes transferred_from user (paid -> trial/expired)", async () => {
  const sb = mockSupabase({
    selectRowsByUserId: {
      "00000000-0000-0000-0000-00000000aaaa": {
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
        transferred_from: ["00000000-0000-0000-0000-00000000aaaa"],
        transferred_to: [],
      }),
    ),
    { secret: "shhh", supabase: sb as never },
  );
  assertEquals(res.status, 200);
  // Demote goes through the revenuecat_demote RPC — no direct UPDATE.
  assertEquals(sb._calls.length, 0);
  assertEquals(sb._rpcCalls.length, 1);
  assertEquals(sb._rpcCalls[0].name, "revenuecat_demote");
  assertEquals(sb._rpcCalls[0].args.p_user_id, "00000000-0000-0000-0000-00000000aaaa");
});

Deno.test("TRANSFER: promotes transferred_to user to 'paid'", async () => {
  const sb = mockSupabase({
    selectRowsByUserId: {
      "00000000-0000-0000-0000-00000000bbbb": {
        entitlement_status: "trial",
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
        transferred_from: [],
        transferred_to: ["00000000-0000-0000-0000-00000000bbbb"],
      }),
    ),
    { secret: "shhh", supabase: sb as never },
  );
  assertEquals(res.status, 200);
  assertEquals(sb._calls.length, 1);
  assertEquals(sb._calls[0].userId, "00000000-0000-0000-0000-00000000bbbb");
  assertEquals(sb._calls[0].values.entitlement_status, "paid");
});

Deno.test("TRANSFER: transferred_from user with missing row is silently skipped (RPC returns applied=false)", async () => {
  // The demote RPC returns applied=false when no row matches user_id.
  // The application code reads that as a no-op for transfer-away (the
  // source identity may have been anonymous / pre-auth).
  const sb = mockSupabase({
    rpcResult: { applied: false, final_status: null, final_anchor: null },
  });
  const res = await handleWebhook(
    req(
      evt({
        type: "TRANSFER",
        app_user_id: undefined,
        transferred_from: ["00000000-0000-0000-0000-00000000ffff"],
        transferred_to: [],
      }),
    ),
    { secret: "shhh", supabase: sb as never },
  );
  assertEquals(res.status, 200);
  // RPC was called (and returned applied=false), no direct UPDATEs.
  assertEquals(sb._rpcCalls.length, 1);
  assertEquals(sb._calls.length, 0);
});

Deno.test("TRANSFER: applies both demote (RPC) and promote (direct UPDATE) in one event", async () => {
  const sb = mockSupabase({
    selectRowsByUserId: {
      "00000000-0000-0000-0000-00000000bbbb": {
        entitlement_status: "trial",
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
        transferred_from: ["00000000-0000-0000-0000-00000000aaaa"],
        transferred_to: ["00000000-0000-0000-0000-00000000bbbb"],
      }),
    ),
    { secret: "shhh", supabase: sb as never },
  );
  assertEquals(res.status, 200);
  // Demote went through the RPC.
  assertEquals(sb._rpcCalls.length, 1);
  assertEquals(sb._rpcCalls[0].args.p_user_id, "00000000-0000-0000-0000-00000000aaaa");
  // Promote went through a direct UPDATE.
  assertEquals(sb._calls.length, 1);
  assertEquals(sb._calls[0].userId, "00000000-0000-0000-0000-00000000bbbb");
  assertEquals(sb._calls[0].values.entitlement_status, "paid");
});

Deno.test("paid event: falls back to original_app_user_id when app_user_id row is missing", async () => {
  const sb = mockSupabase({
    selectRowsByUserId: {
      "00000000-0000-0000-0000-00000000c001": null,                  // current id has no row
      "00000000-0000-0000-0000-00000000a001": {                      // original id does
        entitlement_status: "trial",
        trial_ends_at: "2099-01-01T00:00:00Z",
        last_revenuecat_event_at: null,
      },
    },
  });
  const res = await handleWebhook(
    req(
      evt({
        app_user_id: "00000000-0000-0000-0000-00000000c001",
        original_app_user_id: "00000000-0000-0000-0000-00000000a001",
      }),
    ),
    { secret: "shhh", supabase: sb as never },
  );
  assertEquals(res.status, 200);
  // UPDATE targets the original id (the row we found via fallback).
  assertEquals(sb._calls.length, 1);
  assertEquals(sb._calls[0].userId, "00000000-0000-0000-0000-00000000a001");
  assertEquals(sb._calls[0].values.entitlement_status, "paid");
});

// === TRANSFER destination-row regression coverage =============================
// Reviewer pointed out that the atomic UPDATE returns data: [] when no row
// matches user_id, which is indistinguishable at the supabase-js layer from
// "row matched but anchor advanced". Previously the handler returned 200 in
// both cases, so RC marked TRANSFER delivered and permanently lost the
// entitlement when a destination row didn't exist. The handler now SELECTs
// the dest row first: if missing → 503 (RC retries up to 5 times); if
// present but UPDATE returns 0 rows → 200 (known idempotent).

Deno.test("TRANSFER: missing destination row returns 503 so RC retries", async () => {
  const sb = mockSupabase({
    selectRowsByUserId: {
      "00000000-0000-0000-0000-00000000bbbb": null, // dest row doesn't exist yet (signup trigger race?)
    },
    // updatedRows: [] would also be returned by Postgres in this case; the
    // SELECT-first guard catches it before the UPDATE attempt anyway.
    updatedRows: [],
  });
  const res = await handleWebhook(
    req(
      evt({
        type: "TRANSFER",
        app_user_id: undefined,
        transferred_from: [],
        transferred_to: ["00000000-0000-0000-0000-00000000bbbb"],
      }),
    ),
    { secret: "shhh", supabase: sb as never },
  );
  assertEquals(res.status, 503);
  // No UPDATE attempted — the SELECT-first guard short-circuited.
  assertEquals(sb._calls.length, 0);
});

Deno.test("TRANSFER: dest row exists but UPDATE returns empty (anchor advanced) → 200 idempotent", async () => {
  // Row exists, dest user has already received a NEWER event so the
  // atomic UPDATE's WHERE filter rejects ours. That's known-idempotent
  // success, not a missing-row 503.
  const sb = mockSupabase({
    selectRowsByUserId: {
      "00000000-0000-0000-0000-00000000bbbb": {
        entitlement_status: "paid",
        trial_ends_at: "2099-01-01T00:00:00Z",
        last_revenuecat_event_at: new Date(2_000_000_000_000).toISOString(),
      },
    },
    // Atomic WHERE rejected our older write.
    updatedRows: [],
  });
  const res = await handleWebhook(
    req(
      evt({
        type: "TRANSFER",
        app_user_id: undefined,
        transferred_from: [],
        transferred_to: ["00000000-0000-0000-0000-00000000bbbb"],
      }),
    ),
    { secret: "shhh", supabase: sb as never },
  );
  assertEquals(res.status, 200);
  // UPDATE was still attempted (the SELECT-first guard let us through).
  assertEquals(sb._calls.length, 1);
});

Deno.test("TRANSFER: mixed missing + present dest rows still 503 (one missing is enough)", async () => {
  const sb = mockSupabase({
    selectRowsByUserId: {
      "00000000-0000-0000-0000-00000000dddd": {
        entitlement_status: "trial",
        trial_ends_at: "2099-01-01T00:00:00Z",
        last_revenuecat_event_at: null,
      },
      "00000000-0000-0000-0000-00000000eeee": null,
    },
  });
  const res = await handleWebhook(
    req(
      evt({
        type: "TRANSFER",
        app_user_id: undefined,
        transferred_from: [],
        transferred_to: ["00000000-0000-0000-0000-00000000dddd", "00000000-0000-0000-0000-00000000eeee"],
      }),
    ),
    { secret: "shhh", supabase: sb as never },
  );
  assertEquals(res.status, 503);
  // user-good's UPDATE was attempted (and committed) before user-bad
  // was discovered missing. On retry the user-good row will be idempotent
  // (its anchor now matches eventAt) and user-bad will either succeed
  // (if its row appeared) or 503 again.
  assertEquals(sb._calls.length, 1);
  assertEquals(sb._calls[0].userId, "00000000-0000-0000-0000-00000000dddd");
});

// === REFUND_REVERSED coverage ================================================

Deno.test("REFUND_REVERSED promotes entitlement_status to 'paid'", async () => {
  // Apple/Google reversed a previous refund — restore access.
  const sb = mockSupabase({
    selectRow: {
      entitlement_status: "expired",
      trial_ends_at: "2026-01-01T00:00:00Z",
      last_revenuecat_event_at: null,
    },
  });
  const res = await handleWebhook(
    req(evt({ type: "REFUND_REVERSED" })),
    { secret: "shhh", supabase: sb as never },
  );
  assertEquals(res.status, 200);
  assertEquals(sb._calls.length, 1);
  assertEquals(sb._calls[0].values.entitlement_status, "paid");
});

// === Out-of-order regression coverage ========================================
// The reviewer noted that CANCELLATION-on-non-paid and TRANSFER-demote-on-
// non-paid previously returned 200 without advancing last_revenuecat_event_at,
// leaving the anchor null. A later DELAYED INITIAL_PURCHASE (with an OLDER
// event_timestamp_ms) could then pass the anchor check and grant access.
// The fix advances the anchor on those no-op acknowledgements so the
// atomic filter on a subsequent stale paid event rejects.

Deno.test("CANCELLATION on non-paid row dispatches to revenuecat_demote RPC (which atomically advances the anchor)", async () => {
  // The RPC's CASE expression handles both "demote if paid" and "advance
  // anchor if not" in one SQL statement. Application code unconditionally
  // calls the RPC and trusts it to do the right thing — the row's
  // pre-SELECT status (here 'trial') doesn't gate the dispatch.
  const sb = mockSupabase({
    selectRow: {
      entitlement_status: "trial",
      trial_ends_at: "2099-01-01T00:00:00Z",
      last_revenuecat_event_at: null,
    },
    rpcResult: {
      applied: true,
      final_status: "trial",
      final_anchor: new Date(1_000_000_000_000).toISOString(),
    },
  });
  const res = await handleWebhook(
    req(evt({ type: "CANCELLATION" })),
    { secret: "shhh", supabase: sb as never },
  );
  assertEquals(res.status, 200);
  assertEquals(sb._rpcCalls.length, 1);
  assertEquals(sb._rpcCalls[0].name, "revenuecat_demote");
  // No direct UPDATE — the RPC owns the write.
  assertEquals(sb._calls.length, 0);
});

Deno.test("out-of-order: CANCELLATION advances anchor via RPC then older INITIAL_PURCHASE is idempotency-rejected", async () => {
  // Two-step sequence: CANCELLATION(t=2000) goes through RPC, advancing
  // anchor in real Postgres. Then a delayed INITIAL_PURCHASE(t=1000)
  // arrives — its pre-check sees anchor=t=2000 and idempotency-rejects.
  //
  // The mock here doesn't propagate state between SELECTs so we simulate
  // post-RPC state for the second call.
  const sbCancel = mockSupabase({
    selectRow: {
      entitlement_status: "trial",
      trial_ends_at: "2099-01-01T00:00:00Z",
      last_revenuecat_event_at: null,
    },
    rpcResult: {
      applied: true,
      final_status: "trial",
      final_anchor: new Date(2_000_000_000_000).toISOString(),
    },
  });
  const res1 = await handleWebhook(
    req(evt({ type: "CANCELLATION", event_timestamp_ms: 2_000_000_000_000 })),
    { secret: "shhh", supabase: sbCancel as never },
  );
  assertEquals(res1.status, 200);
  assertEquals(sbCancel._rpcCalls.length, 1);
  assertEquals(
    sbCancel._rpcCalls[0].args.p_event_at,
    new Date(2_000_000_000_000).toISOString(),
  );

  // Second mock simulates the row AFTER the RPC advanced the anchor.
  const sbPaid = mockSupabase({
    selectRow: {
      entitlement_status: "trial",
      trial_ends_at: "2099-01-01T00:00:00Z",
      last_revenuecat_event_at: new Date(2_000_000_000_000).toISOString(),
    },
  });
  const res2 = await handleWebhook(
    req(evt({ event_timestamp_ms: 1_000_000_000_000 })),
    { secret: "shhh", supabase: sbPaid as never },
  );
  assertEquals(res2.status, 200);
  // No UPDATE attempted — the pre-check fast-bailed on idempotent.
  assertEquals(sbPaid._calls.length, 0);
});

Deno.test("TRANSFER demote on non-paid row dispatches to RPC (anchor advanced atomically)", async () => {
  const sb = mockSupabase({
    rpcResult: {
      applied: true,
      final_status: "trial",
      final_anchor: new Date(1_000_000_000_000).toISOString(),
    },
  });
  const res = await handleWebhook(
    req(
      evt({
        type: "TRANSFER",
        app_user_id: undefined,
        transferred_from: ["00000000-0000-0000-0000-00000000cccc"],
        transferred_to: [],
      }),
    ),
    { secret: "shhh", supabase: sb as never },
  );
  assertEquals(res.status, 200);
  // Demote went through RPC, NOT a direct UPDATE.
  assertEquals(sb._rpcCalls.length, 1);
  assertEquals(sb._rpcCalls[0].args.p_user_id, "00000000-0000-0000-0000-00000000cccc");
  assertEquals(sb._calls.length, 0);
});

// === Round-5 regression: concurrent paid+cancel race =========================
// This is the bug the reviewer flagged. The two-step (SELECT→branch→UPDATE)
// approach failed to atomically demote when a concurrent paid event flipped
// status='paid' BETWEEN the application's SELECT and a separate anchor-only
// UPDATE. With the RPC in place, the demote-or-anchor-advance decision is
// made AT SQL EVALUATION TIME — Postgres serializes the write, so whichever
// concurrent operation runs second sees the other's effect and the CASE
// expression picks the right outcome.

Deno.test("race-safe: CANCELLATION calls RPC even when the application SELECT saw non-paid (the RPC's CASE handles the concurrent paid flip)", async () => {
  // Pre-SELECT shows non-paid (concurrent INITIAL_PURCHASE hasn't run yet
  // from our perspective). The application code MUST still dispatch the
  // demote — if status flipped to paid by the time the RPC's UPDATE runs,
  // the CASE WHEN demotes it; if not, the UPDATE advances the anchor only.
  // Either way the row state is consistent after the call.
  const sb = mockSupabase({
    selectRow: {
      entitlement_status: "trial",
      trial_ends_at: "2099-01-01T00:00:00Z",
      last_revenuecat_event_at: null,
    },
    // Simulate the race: by the time the RPC runs, a concurrent paid event
    // flipped status. The RPC's CASE WHEN sees status='paid' AND demotes.
    rpcResult: {
      applied: true,
      final_status: "trial", // CASE WHEN: was paid → trial (still in window)
      final_anchor: new Date(1_000_000_000_000).toISOString(),
    },
  });
  const res = await handleWebhook(
    req(evt({ type: "CANCELLATION" })),
    { secret: "shhh", supabase: sb as never },
  );
  assertEquals(res.status, 200);
  assertEquals(sb._rpcCalls.length, 1);
  // The dispatch happens regardless of the pre-SELECT status, because the
  // app cannot tell whether status changed in the WINDOW after SELECT.
  // The RPC is authoritative.
});

// === Round-6 regression: anonymous RC identities ============================
// RevenueCat assigns anonymous identities the prefix "$RCAnonymousID:"
// when the SDK is configured before logIn. Those strings cannot cast to
// the uuid type the demote RPC and SELECT both require — without a guard
// the call would 22P02 (invalid uuid syntax) and 500, skipping the rest
// of the loop including any real destination promote.

Deno.test("TRANSFER: anonymous transferred_from is skipped; real destination still promoted", async () => {
  // The bug: $RCAnonymousID:... in transferred_from caused the demote
  // RPC to error -> handler 500 -> destination 'user-real' never received
  // 'paid' -> RC eventually gave up -> entitlement permanently lost.
  const sb = mockSupabase({
    selectRowsByUserId: {
      "00000000-0000-0000-0000-000000000abc": {
        entitlement_status: "trial",
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
        transferred_from: ["$RCAnonymousID:abcdef0123456789"],
        transferred_to: ["00000000-0000-0000-0000-000000000abc"],
      }),
    ),
    { secret: "shhh", supabase: sb as never },
  );
  assertEquals(res.status, 200);
  // Anonymous source: NO RPC call (would have 500'd otherwise).
  assertEquals(sb._rpcCalls.length, 0);
  // Real destination: promote went through as a direct UPDATE.
  assertEquals(sb._calls.length, 1);
  assertEquals(
    sb._calls[0].userId,
    "00000000-0000-0000-0000-000000000abc",
  );
  assertEquals(sb._calls[0].values.entitlement_status, "paid");
});

Deno.test("TRANSFER: anonymous transferred_to is skipped (no SELECT attempt for non-UUID)", async () => {
  const sb = mockSupabase();
  const res = await handleWebhook(
    req(
      evt({
        type: "TRANSFER",
        app_user_id: undefined,
        transferred_from: [],
        transferred_to: ["$RCAnonymousID:def987654321"],
      }),
    ),
    { secret: "shhh", supabase: sb as never },
  );
  assertEquals(res.status, 200);
  // No SELECT, no UPDATE — the guard short-circuits before the row lookup.
  assertEquals(sb._selectCalls.length, 0);
  assertEquals(sb._calls.length, 0);
});

Deno.test("TRANSFER: mixed anonymous + real on both sides processes only the UUIDs", async () => {
  const sb = mockSupabase({
    selectRowsByUserId: {
      "11111111-1111-1111-1111-111111111111": {
        entitlement_status: "trial",
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
        transferred_from: [
          "$RCAnonymousID:aaa",
          "22222222-2222-2222-2222-222222222222",
        ],
        transferred_to: [
          "$RCAnonymousID:bbb",
          "11111111-1111-1111-1111-111111111111",
        ],
      }),
    ),
    { secret: "shhh", supabase: sb as never },
  );
  assertEquals(res.status, 200);
  // Demote: only the real source -> RPC.
  assertEquals(sb._rpcCalls.length, 1);
  assertEquals(
    sb._rpcCalls[0].args.p_user_id,
    "22222222-2222-2222-2222-222222222222",
  );
  // Promote: only the real destination -> direct UPDATE.
  assertEquals(sb._calls.length, 1);
  assertEquals(
    sb._calls[0].userId,
    "11111111-1111-1111-1111-111111111111",
  );
});
