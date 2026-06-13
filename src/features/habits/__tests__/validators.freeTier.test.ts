import { assertCanCreateHabitOnFreeTier } from "@/features/habits/validators";
import { listActiveHabits } from "@/features/habits/api";

jest.mock("@/features/habits/api", () => ({
  listActiveHabits: jest.fn(),
}));

const mockListActiveHabits = listActiveHabits as jest.Mock;

describe("assertCanCreateHabitOnFreeTier", () => {
  beforeEach(() => {
    mockListActiveHabits.mockReset();
  });

  it("returns ok=true when accessMode is 'full' (paid or in-window trial)", async () => {
    // No call to listActiveHabits required — full access bypasses the count check.
    mockListActiveHabits.mockResolvedValue([
      { id: "h1", habit_state: "active" },
      { id: "h2", habit_state: "active" },
      { id: "h3", habit_state: "active" },
    ]);
    const result = await assertCanCreateHabitOnFreeTier("user-1", "full");
    expect(result).toEqual({ ok: true });
    expect(mockListActiveHabits).not.toHaveBeenCalled();
  });

  it("returns ok=true when accessMode is 'expired_no_purchase' and user has 0 active habits", async () => {
    mockListActiveHabits.mockResolvedValue([]);
    const result = await assertCanCreateHabitOnFreeTier("user-1", "expired_no_purchase");
    expect(result).toEqual({ ok: true });
  });

  it("returns free_tier_cap blocked when accessMode is 'expired_no_purchase' and user has 1 active habit", async () => {
    mockListActiveHabits.mockResolvedValue([
      { id: "h1", habit_state: "active" },
    ]);
    const result = await assertCanCreateHabitOnFreeTier("user-1", "expired_no_purchase");
    expect(result).toEqual({
      ok: false,
      reason: "free_tier_cap",
      activeCount: 1,
    });
  });

  it("returns free_tier_cap blocked when accessMode is 'read_only' and user has 1 active habit", async () => {
    mockListActiveHabits.mockResolvedValue([
      { id: "h1", habit_state: "active" },
    ]);
    const result = await assertCanCreateHabitOnFreeTier("user-1", "read_only");
    expect(result).toEqual({
      ok: false,
      reason: "free_tier_cap",
      activeCount: 1,
    });
  });

  it("counts only habit_state='active' rows (excludes 'automatic' graduated habits)", async () => {
    mockListActiveHabits.mockResolvedValue([
      { id: "h1", habit_state: "automatic" },
      { id: "h2", habit_state: "automatic" },
    ]);
    const result = await assertCanCreateHabitOnFreeTier("user-1", "expired_no_purchase");
    expect(result).toEqual({ ok: true });
  });
});
