import { fetchTrialEntitlement, TrialEntitlementFetchError } from "@/features/trial/api";
import { supabase } from "@/lib/supabase/client";
import { resetClockForTesting, setNowForTesting } from "@/utils/clock";

jest.mock("@/lib/supabase/client", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock("@/services/logger", () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

const mockedFrom = supabase.from as jest.Mock;

function mockMaybeSingleResponse(data: unknown, error: unknown = null) {
  mockedFrom.mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        maybeSingle: jest.fn().mockResolvedValue({ data, error }),
      }),
    }),
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

  it("returns the cached entitlement with device-recorded last_validated_at on success", async () => {
    mockMaybeSingleResponse({
      user_id: "user-1",
      trial_started_at: "2026-04-15T00:00:00.000Z",
      trial_ends_at: "2026-04-29T00:00:00.000Z",
      entitlement_status: "trial",
      last_validated_at: null,
    });

    const result = await fetchTrialEntitlement("user-1");

    expect(result).toEqual({
      user_id: "user-1",
      trial_started_at: "2026-04-15T00:00:00.000Z",
      trial_ends_at: "2026-04-29T00:00:00.000Z",
      entitlement_status: "trial",
      last_validated_at: "2026-05-01T12:00:00.000Z",
    });
  });

  it("throws TrialEntitlementFetchError(network) on Supabase error", async () => {
    mockMaybeSingleResponse(null, { message: "network error" });

    await expect(fetchTrialEntitlement("user-1")).rejects.toBeInstanceOf(
      TrialEntitlementFetchError,
    );
    await expect(fetchTrialEntitlement("user-1")).rejects.toMatchObject({
      reason: "network",
    });
  });

  it("throws TrialEntitlementFetchError(missing_row) when no row exists", async () => {
    mockMaybeSingleResponse(null);

    await expect(fetchTrialEntitlement("user-1")).rejects.toMatchObject({
      reason: "missing_row",
    });
  });

  it("throws TrialEntitlementFetchError(invalid_status) on unknown status value", async () => {
    mockMaybeSingleResponse({
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
