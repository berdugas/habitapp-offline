import { fetchTrialEntitlement, TrialEntitlementFetchError } from "@/features/trial/api";
import { supabase } from "@/lib/supabase/client";
import { resetClockForTesting, setNowForTesting } from "@/utils/clock";

jest.mock("@/lib/supabase/client", () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

jest.mock("@/services/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const mockedRpc = supabase.rpc as jest.Mock;

function mockRpcResponse(data: unknown, error: unknown = null) {
  mockedRpc.mockReturnValue({
    single: jest.fn().mockResolvedValue({ data, error }),
  });
}

describe("fetchTrialEntitlement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setNowForTesting(new Date("2026-05-01T12:00:00.000Z"));
  });

  afterEach(() => {
    resetClockForTesting();
  });

  it("calls ensure_trial_entitlement RPC and returns the entitlement with device-recorded last_validated_at", async () => {
    mockRpcResponse({
      user_id: "user-1",
      trial_started_at: "2026-04-15T00:00:00.000Z",
      trial_ends_at: "2026-04-29T00:00:00.000Z",
      entitlement_status: "trial",
      last_validated_at: null,
    });

    const result = await fetchTrialEntitlement("user-1");

    expect(mockedRpc).toHaveBeenCalledWith("ensure_trial_entitlement");
    expect(result).toEqual({
      user_id: "user-1",
      trial_started_at: "2026-04-15T00:00:00.000Z",
      trial_ends_at: "2026-04-29T00:00:00.000Z",
      entitlement_status: "trial",
      last_validated_at: "2026-05-01T12:00:00.000Z",
    });
  });

  it("returns the row with status='expired' when the server flipped it on read", async () => {
    mockRpcResponse({
      user_id: "user-1",
      trial_started_at: "2026-05-01T00:00:00.000Z",
      trial_ends_at: "2026-05-15T00:00:00.000Z",
      entitlement_status: "expired",
      last_validated_at: "2026-06-01T00:00:00.000Z",
    });

    const result = await fetchTrialEntitlement("user-1");
    expect(result.entitlement_status).toBe("expired");
  });

  it("throws TrialEntitlementFetchError(network) when the RPC errors", async () => {
    mockRpcResponse(null, { message: "rpc failed" });

    await expect(fetchTrialEntitlement("user-1")).rejects.toBeInstanceOf(
      TrialEntitlementFetchError,
    );
    await expect(fetchTrialEntitlement("user-1")).rejects.toMatchObject({
      reason: "network",
    });
  });

  it("throws TrialEntitlementFetchError(missing_row) when the RPC returns no row", async () => {
    mockRpcResponse(null);

    await expect(fetchTrialEntitlement("user-1")).rejects.toMatchObject({
      reason: "missing_row",
    });
  });

  it("throws TrialEntitlementFetchError(invalid_status) on unknown status value", async () => {
    mockRpcResponse({
      user_id: "user-1",
      trial_started_at: "2026-04-15T00:00:00.000Z",
      trial_ends_at: "2026-04-29T00:00:00.000Z",
      entitlement_status: "future_unknown_status",
      last_validated_at: null,
    });

    await expect(fetchTrialEntitlement("user-1")).rejects.toMatchObject({
      reason: "invalid_status",
    });
  });
});
