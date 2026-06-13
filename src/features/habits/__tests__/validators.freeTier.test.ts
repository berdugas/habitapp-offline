import { assertCanCreateHabitOnFreeTier } from "@/features/habits/validators";
import { listHabits } from "@/lib/db/repositories/habits";

jest.mock("@/lib/db/repositories/habits", () => ({
  listHabits: jest.fn(),
}));

const mockListHabits = listHabits as jest.Mock;

describe("assertCanCreateHabitOnFreeTier", () => {
  beforeEach(() => {
    mockListHabits.mockReset();
  });

  it("returns ok=true when accessMode is 'full' (paid or in-window trial)", async () => {
    // No call to listHabits required — full access bypasses the count check.
    mockListHabits.mockResolvedValue([
      { id: "h1", habit_state: "active" },
      { id: "h2", habit_state: "active" },
      { id: "h3", habit_state: "active" },
    ]);
    const result = await assertCanCreateHabitOnFreeTier("user-1", "full");
    expect(result).toEqual({ ok: true });
    expect(mockListHabits).not.toHaveBeenCalled();
  });

  it("returns ok=true when accessMode is 'expired_no_purchase' and user has 0 active habits", async () => {
    mockListHabits.mockResolvedValue([]);
    const result = await assertCanCreateHabitOnFreeTier("user-1", "expired_no_purchase");
    expect(result).toEqual({ ok: true });
  });

  it("returns free_tier_cap blocked when accessMode is 'expired_no_purchase' and user has 1 active habit", async () => {
    mockListHabits.mockResolvedValue([
      { id: "h1", habit_state: "active", status: "active" },
    ]);
    const result = await assertCanCreateHabitOnFreeTier("user-1", "expired_no_purchase");
    expect(result).toEqual({
      ok: false,
      reason: "free_tier_cap",
      activeCount: 1,
    });
    expect(mockListHabits).toHaveBeenCalledWith({
      user_id: "user-1",
      status: ["active", "backlog"],
    });
  });

  it("returns free_tier_cap blocked when accessMode is 'read_only' and user has 1 active habit", async () => {
    mockListHabits.mockResolvedValue([
      { id: "h1", habit_state: "active", status: "active" },
    ]);
    const result = await assertCanCreateHabitOnFreeTier("user-1", "read_only");
    expect(result).toEqual({
      ok: false,
      reason: "free_tier_cap",
      activeCount: 1,
    });
  });

  it("counts only habit_state='active' rows (excludes 'automatic' graduated habits)", async () => {
    mockListHabits.mockResolvedValue([
      { id: "h1", habit_state: "automatic" },
      { id: "h2", habit_state: "automatic" },
    ]);
    const result = await assertCanCreateHabitOnFreeTier("user-1", "expired_no_purchase");
    expect(result).toEqual({ ok: true });
  });

  it("counts backlog habits toward the cap (paywall picker treats both as slots)", async () => {
    mockListHabits.mockResolvedValue([
      { id: "h1", habit_state: "active", status: "backlog" },
    ]);
    const result = await assertCanCreateHabitOnFreeTier("user-1", "expired_no_purchase");
    expect(result).toEqual({
      ok: false,
      reason: "free_tier_cap",
      activeCount: 1,
    });
  });

  it("counts both active and backlog habits toward the cap", async () => {
    mockListHabits.mockResolvedValue([
      { id: "h1", habit_state: "active", status: "active" },
      { id: "h2", habit_state: "active", status: "backlog" },
    ]);
    const result = await assertCanCreateHabitOnFreeTier("user-1", "expired_no_purchase");
    expect(result).toEqual({
      ok: false,
      reason: "free_tier_cap",
      activeCount: 2,
    });
  });
});
