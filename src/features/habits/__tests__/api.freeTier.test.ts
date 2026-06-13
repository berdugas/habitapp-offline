import {
  archiveHabit,
  archiveHabitsForPaywallKeepOne,
  createHabit,
  deleteHabit,
  FreeTierCapError,
  restoreHabit,
  updateHabit,
} from "@/features/habits/api";
import {
  archiveHabit as archiveRow,
  createHabit as createHabitRow,
  deleteHabit as deleteRow,
  getHabit,
  listHabits,
  restoreHabit as restoreRow,
  updateHabit as updateRow,
} from "@/lib/db/repositories/habits";
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
const mockArchiveRow = archiveRow as jest.Mock;
const mockDeleteRow = deleteRow as jest.Mock;
const mockRestoreRow = restoreRow as jest.Mock;
const mockUpdateRow = updateRow as jest.Mock;
const mockGetHabit = getHabit as jest.Mock;
const mockListHabits = listHabits as jest.Mock;

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

});

describe("updateHabit — free-tier guard", () => {
  beforeEach(() => {
    [mockAssertCanCreate, mockUpdateRow, mockGetHabit].forEach((m) => m.mockReset());
    mockGetHabit.mockResolvedValue({ id: "h1", user_id: "user-1", status: "active", habit_state: "active" });
  });

  it("allows edit when accessMode is 'full'", async () => {
    mockAssertCanCreate.mockResolvedValue({ ok: true });
    mockUpdateRow.mockResolvedValue({ id: "h1" });
    await expect(
      updateHabit("user-1", "h1", { ...basePayload } as never, "full"),
    ).resolves.toEqual({ id: "h1" });
  });

  it("rejects edit when accessMode is 'expired_no_purchase' and at the 1-habit cap", async () => {
    mockAssertCanCreate.mockResolvedValue({
      ok: false,
      reason: "free_tier_cap",
      activeCount: 1,
    });
    await expect(
      updateHabit("user-1", "h1", { ...basePayload } as never, "expired_no_purchase"),
    ).rejects.toThrow(FreeTierCapError);
    expect(mockUpdateRow).not.toHaveBeenCalled();
  });
});

describe("archiveHabit — free-tier guard", () => {
  beforeEach(() => {
    [mockAssertCanCreate, mockArchiveRow, mockGetHabit].forEach((m) => m.mockReset());
    mockGetHabit.mockResolvedValue({ id: "h1", user_id: "user-1", status: "active", habit_state: "active" });
  });

  it("allows archive when accessMode is 'full'", async () => {
    mockAssertCanCreate.mockResolvedValue({ ok: true });
    mockArchiveRow.mockResolvedValue(undefined);
    await archiveHabit("user-1", "h1", "full");
    expect(mockArchiveRow).toHaveBeenCalledTimes(1);
  });

  it("rejects archive when accessMode is 'expired_no_purchase' and at cap", async () => {
    mockAssertCanCreate.mockResolvedValue({
      ok: false,
      reason: "free_tier_cap",
      activeCount: 1,
    });
    await expect(archiveHabit("user-1", "h1", "expired_no_purchase")).rejects.toThrow(FreeTierCapError);
    expect(mockArchiveRow).not.toHaveBeenCalled();
  });

  it("allows archive when accessMode is 'expired_no_purchase' and activeCount is 0 (pass-through edge case)", async () => {
    mockAssertCanCreate.mockResolvedValue({ ok: true });
    mockArchiveRow.mockResolvedValue(undefined);
    await archiveHabit("user-1", "h1", "expired_no_purchase");
    expect(mockArchiveRow).toHaveBeenCalledTimes(1);
  });
});

describe("deleteHabit — free-tier guard", () => {
  beforeEach(() => {
    [mockAssertCanCreate, mockDeleteRow, mockGetHabit].forEach((m) => m.mockReset());
    mockGetHabit.mockResolvedValue({ id: "h1", user_id: "user-1", status: "active", habit_state: "active" });
  });

  it("allows delete when accessMode is 'full'", async () => {
    mockAssertCanCreate.mockResolvedValue({ ok: true });
    mockDeleteRow.mockResolvedValue(true);
    await deleteHabit("user-1", "h1", "full");
    expect(mockDeleteRow).toHaveBeenCalledTimes(1);
  });

  it("rejects delete when accessMode is 'expired_no_purchase' and at cap", async () => {
    mockAssertCanCreate.mockResolvedValue({
      ok: false,
      reason: "free_tier_cap",
      activeCount: 1,
    });
    await expect(deleteHabit("user-1", "h1", "expired_no_purchase")).rejects.toThrow(FreeTierCapError);
    expect(mockDeleteRow).not.toHaveBeenCalled();
  });

  it("allows delete when accessMode is 'expired_no_purchase' and activeCount is 0 (pass-through edge case)", async () => {
    mockAssertCanCreate.mockResolvedValue({ ok: true });
    mockDeleteRow.mockResolvedValue(true);
    await deleteHabit("user-1", "h1", "expired_no_purchase");
    expect(mockDeleteRow).toHaveBeenCalledTimes(1);
  });
});

describe("restoreHabit — free-tier guard", () => {
  beforeEach(() => {
    [mockRestoreRow, mockGetHabit, mockListHabits].forEach((m) => m.mockReset());
    mockGetHabit.mockResolvedValue({ id: "h1", user_id: "user-1", status: "archived", habit_state: "active" });
  });

  it("allows restore when accessMode is 'full'", async () => {
    mockRestoreRow.mockResolvedValue({ restored: true, habit: null, wasExBacklog: false });
    await restoreHabit("user-1", "h1", "full");
    expect(mockRestoreRow).toHaveBeenCalledTimes(1);
  });

  it("rejects restore with reason='restore_blocked' for any non-full accessMode", async () => {
    mockListHabits.mockResolvedValue([]);
    await expect(
      restoreHabit("user-1", "h1", "expired_no_purchase"),
    ).rejects.toMatchObject({
      name: "FreeTierCapError",
      reason: "restore_blocked",
    });
    expect(mockRestoreRow).not.toHaveBeenCalled();
  });
});

describe("archiveHabitsForPaywallKeepOne", () => {
  beforeEach(() => {
    // mockListHabits, mockArchiveRow, mockUpdateRow, mockCancelReminder
    // are already defined at module scope from earlier tasks.
    [mockListHabits, mockArchiveRow, mockUpdateRow, mockCancelReminder].forEach(
      (m) => m.mockReset(),
    );
    mockArchiveRow.mockResolvedValue(undefined);
    mockUpdateRow.mockResolvedValue({ id: "ignored" });
    mockCancelReminder.mockResolvedValue(undefined);
  });

  it("archives all active+backlog habits except the kept one", async () => {
    mockListHabits.mockImplementation(async (filter: { status?: string }) => {
      if (filter.status === "active") {
        return [
          { id: "h1", status: "active", habit_state: "active" },
          { id: "h2", status: "active", habit_state: "active" },
        ];
      }
      if (filter.status === "backlog") {
        return [{ id: "h3", status: "backlog", habit_state: "active" }];
      }
      return [];
    });

    const result = await archiveHabitsForPaywallKeepOne("user-1", "h2");
    expect(result).toEqual({ archivedCount: 2 });

    // h1 and h3 archived; h2 untouched.
    expect(mockArchiveRow).toHaveBeenCalledWith("h1");
    expect(mockArchiveRow).toHaveBeenCalledWith("h3");
    expect(mockArchiveRow).not.toHaveBeenCalledWith("h2");

    // archived_reason tag applied to both.
    expect(mockUpdateRow).toHaveBeenCalledWith("h1", {
      archived_reason: "paywall_keep_one",
    });
    expect(mockUpdateRow).toHaveBeenCalledWith("h3", {
      archived_reason: "paywall_keep_one",
    });

    // Reminder cancel only for the active row (h1), not the backlog row (h3).
    expect(mockCancelReminder).toHaveBeenCalledWith("h1");
    expect(mockCancelReminder).not.toHaveBeenCalledWith("h3");
  });

  it("archives all habits when keptHabitId is null", async () => {
    mockListHabits.mockImplementation(async (filter: { status?: string }) => {
      if (filter.status === "active") {
        return [{ id: "h1", status: "active", habit_state: "active" }];
      }
      if (filter.status === "backlog") {
        return [{ id: "h2", status: "backlog", habit_state: "active" }];
      }
      return [];
    });

    const result = await archiveHabitsForPaywallKeepOne("user-1", null);
    expect(result).toEqual({ archivedCount: 2 });
  });

  it("returns archivedCount=0 when user has no active+backlog habits", async () => {
    mockListHabits.mockResolvedValue([]);
    const result = await archiveHabitsForPaywallKeepOne("user-1", null);
    expect(result).toEqual({ archivedCount: 0 });
    expect(mockArchiveRow).not.toHaveBeenCalled();
  });

  it("does not abort when cancelReminder rejects (best-effort)", async () => {
    mockListHabits.mockImplementation(async (filter: { status?: string }) => {
      if (filter.status === "active") {
        return [{ id: "h1", status: "active", habit_state: "active" }];
      }
      return [];
    });
    mockCancelReminder.mockRejectedValue(new Error("no permission"));

    const result = await archiveHabitsForPaywallKeepOne("user-1", null);
    expect(result).toEqual({ archivedCount: 1 });
    expect(mockArchiveRow).toHaveBeenCalledWith("h1");
  });
});
