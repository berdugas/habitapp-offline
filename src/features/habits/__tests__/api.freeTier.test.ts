import {
  createHabit,
  FreeTierCapError,
} from "@/features/habits/api";
import { createHabit as createHabitRow } from "@/lib/db/repositories/habits";
import { assertCanCreateHabitOnFreeTier } from "@/features/habits/validators";

// Mock notifications module — archive/delete/restore touch it via api.ts.
const mockCancelReminder = jest.fn().mockResolvedValue(undefined);
const mockMaterializePendingReminder = jest.fn().mockResolvedValue(true);

jest.mock("@/features/reminders/notifications", () => ({
  cancelReminder: (...args: unknown[]) => mockCancelReminder(...args),
  materializePendingReminder: (...args: unknown[]) =>
    mockMaterializePendingReminder(...args),
  persistReminderIntent: jest.fn(),
  scheduleReminder: jest.fn(),
}));

jest.mock("@/lib/db/repositories/habits", () => ({
  createHabit: jest.fn(),
  archiveHabit: jest.fn(),
  deleteHabit: jest.fn(),
  restoreHabit: jest.fn(),
  updateHabit: jest.fn(),
  getHabit: jest.fn(),
  listHabits: jest.fn(),
}));

// Mock validators directly to drive the cap result without going through the
// api ↔ validators ↔ api circular import (the self-mock-on-api pattern hits a
// recursive-factory issue where validators.ts captures the unmocked
// listActiveHabits before the mock factory finishes returning).
jest.mock("@/features/habits/validators", () => ({
  assertCanCreateHabitOnFreeTier: jest.fn(),
}));

const mockAssertCanCreate = assertCanCreateHabitOnFreeTier as jest.Mock;
const mockCreateHabitRow = createHabitRow as jest.Mock;

const basePayload = {
  title: "Read 10 pages",
  identityPhrase: "I am a reader",
  cue: "After morning coffee",
  tinyAction: "open book",
  minimumViableAction: "",
  preferredTimeWindow: "",
  icon: "",
  activeDays: [1, 2, 3, 4, 5, 6, 7],
  habitState: "active" as const,
};

describe("createHabit — free-tier guard", () => {
  beforeEach(() => {
    mockAssertCanCreate.mockReset();
    mockCreateHabitRow.mockReset();
    mockCreateHabitRow.mockImplementation(async (input) => ({
      ...input,
      id: "new-habit-id",
      created_at: "2026-06-09T00:00:00.000Z",
      updated_at: "2026-06-09T00:00:00.000Z",
      archived_at: null,
      archived_reason: null,
      automated_at: null,
    }));
  });

  it("allows creation when accessMode is 'full' (paid OR in-window trial)", async () => {
    mockAssertCanCreate.mockResolvedValue({ ok: true });
    const result = await createHabit("user-1", basePayload, "full");
    expect(result.id).toBe("new-habit-id");
    expect(mockCreateHabitRow).toHaveBeenCalledTimes(1);
    expect(mockAssertCanCreate).toHaveBeenCalledWith("user-1", "full");
  });

  it("allows creation when accessMode is 'expired_no_purchase' but user has 0 active habits", async () => {
    mockAssertCanCreate.mockResolvedValue({ ok: true });
    const result = await createHabit("user-1", basePayload, "expired_no_purchase");
    expect(result.id).toBe("new-habit-id");
    expect(mockAssertCanCreate).toHaveBeenCalledWith("user-1", "expired_no_purchase");
  });

  it("throws FreeTierCapError when accessMode is 'expired_no_purchase' and 1 active habit exists", async () => {
    mockAssertCanCreate.mockResolvedValue({
      ok: false,
      reason: "free_tier_cap",
      activeCount: 1,
    });
    await expect(
      createHabit("user-1", basePayload, "expired_no_purchase"),
    ).rejects.toThrow(FreeTierCapError);
    expect(mockCreateHabitRow).not.toHaveBeenCalled();
  });

  it("throws FreeTierCapError when accessMode is 'read_only' and 1 active habit exists", async () => {
    mockAssertCanCreate.mockResolvedValue({
      ok: false,
      reason: "free_tier_cap",
      activeCount: 1,
    });
    await expect(
      createHabit("user-1", basePayload, "read_only"),
    ).rejects.toThrow(FreeTierCapError);
  });

  it("skips the cap when accessMode arg is omitted (back-compat — transient between Task 5 and Task 7.5)", async () => {
    const result = await createHabit("user-1", basePayload);
    expect(result.id).toBe("new-habit-id");
    expect(mockCreateHabitRow).toHaveBeenCalledTimes(1);
    expect(mockAssertCanCreate).not.toHaveBeenCalled();
  });
});
