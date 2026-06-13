import { assertEquals } from "https://deno.land/std@0.220.0/assert/mod.ts";
import { handleWebhook } from "./index.ts";

// Builds a mock Supabase client that records SELECT and UPDATE calls.
type UpdateCall = { table: string; values: Record<string, unknown>; userId: string };
function mockSupabase(opts: {
  selectRow?: { entitlement_status?: string; trial_ends_at?: string; last_revenuecat_event_at?: string | null } | null;
  updatedRows?: Array<Record<string, unknown>>;
} = {}) {
  const calls: UpdateCall[] = [];
  const selectRow = opts.selectRow === undefined ? null : opts.selectRow;
  const updatedRows = opts.updatedRows === undefined ? [{}] : opts.updatedRows;
  return {
    from: (table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _val: unknown) => ({
          maybeSingle: () => Promise.resolve({ data: selectRow, error: null }),
        }),
      }),
      update: (values: Record<string, unknown>) => ({
        eq: (col: string, val: unknown) => {
          if (col !== "user_id") throw new Error(`unexpected eq column: ${col}`);
          calls.push({ table, values, userId: val as string });
          return { select: () => Promise.resolve({ data: updatedRows, error: null }) };
        },
      }),
    }),
    _calls: calls,
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
