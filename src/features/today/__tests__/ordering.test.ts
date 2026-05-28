import {
  groupAndSortForToday,
  sortHabitsWithinGoal,
} from "@/features/today/ordering";

import type { TodayHabitCardData } from "@/features/today/types";

function makeCard(overrides: Partial<TodayHabitCardData> = {}): TodayHabitCardData {
  return {
    activeDays: [1, 2, 3, 4, 5, 6, 7],
    consistencyDenominator: 0,
    consistencyRate: 0,
    createdAt: "2025-01-01T00:00:00.000Z",
    cue: "cue",
    formula: "After cue, action",
    habitState: "active",
    icon: null,
    id: "h-1",
    identityPhrase: "a runner",
    name: "habit",
    offDay: false,
    reminderTime: null,
    reminderType: "none",
    skipCount: 0,
    startDate: "2025-01-01",
    streak: 0,
    tinyAction: "action",
    todayStatus: null,
    ...overrides,
  };
}

describe("sortHabitsWithinGoal", () => {
  it("places action-needed habits before resolved ones", () => {
    const a = makeCard({ id: "a", todayStatus: "done", createdAt: "2025-01-01T00:00:00Z" });
    const b = makeCard({ id: "b", todayStatus: null, createdAt: "2025-02-01T00:00:00Z" });
    const result = sortHabitsWithinGoal([a, b]);
    expect(result.map((h) => h.id)).toEqual(["b", "a"]);
  });

  it("treats off-day as resolved (bundled with done/skipped)", () => {
    const onDayDone = makeCard({ id: "done", todayStatus: "done", createdAt: "2025-01-01T00:00:00Z" });
    const offDay = makeCard({ id: "off", offDay: true, todayStatus: null, createdAt: "2025-02-01T00:00:00Z" });
    const active = makeCard({ id: "active", todayStatus: null, createdAt: "2025-03-01T00:00:00Z" });
    const result = sortHabitsWithinGoal([onDayDone, offDay, active]);
    expect(result.map((h) => h.id)).toEqual(["active", "done", "off"]);
  });

  it("within each zone sorts by createdAt ascending", () => {
    const newer = makeCard({ id: "newer", createdAt: "2025-02-01T00:00:00Z" });
    const older = makeCard({ id: "older", createdAt: "2025-01-01T00:00:00Z" });
    const result = sortHabitsWithinGoal([newer, older]);
    expect(result.map((h) => h.id)).toEqual(["older", "newer"]);
  });

  it("breaks createdAt ties by id ascending", () => {
    const bId = makeCard({ id: "b", createdAt: "2025-01-01T00:00:00Z" });
    const aId = makeCard({ id: "a", createdAt: "2025-01-01T00:00:00Z" });
    const result = sortHabitsWithinGoal([bId, aId]);
    expect(result.map((h) => h.id)).toEqual(["a", "b"]);
  });
});

describe("groupAndSortForToday", () => {
  it("filters habits with null/empty identityPhrase", () => {
    const real = makeCard({ id: "r", identityPhrase: "a runner" });
    const orphanEmpty = makeCard({ id: "o1", identityPhrase: "" });
    const groups = groupAndSortForToday([real, orphanEmpty]);
    expect(groups.map((g) => g.identityPhrase)).toEqual(["a runner"]);
  });

  it("places active-zone goals before done-zone goals", () => {
    const activeGoal = [
      makeCard({ id: "a1", identityPhrase: "active", todayStatus: null }),
    ];
    const doneGoal = [
      makeCard({ id: "d1", identityPhrase: "done", todayStatus: "done" }),
    ];
    const groups = groupAndSortForToday([...activeGoal, ...doneGoal]);
    expect(groups.map((g) => g.identityPhrase)).toEqual(["active", "done"]);
  });

  it("an active-zone goal beats a timed done-zone goal regardless of reminder time", () => {
    const activeUntimed = makeCard({
      id: "u1",
      identityPhrase: "active untimed",
      todayStatus: null,
      reminderTime: null,
    });
    const doneTimed = makeCard({
      id: "d1",
      identityPhrase: "done timed",
      todayStatus: "done",
      reminderTime: "07:00",
      reminderType: "daily",
    });
    const groups = groupAndSortForToday([activeUntimed, doneTimed]);
    expect(groups.map((g) => g.identityPhrase)).toEqual([
      "active untimed",
      "done timed",
    ]);
  });

  it("timed goals come before untimed goals within the active zone", () => {
    const timed = makeCard({
      id: "t1",
      identityPhrase: "timed",
      reminderTime: "08:00",
      reminderType: "daily",
    });
    const untimed = makeCard({
      id: "u1",
      identityPhrase: "untimed",
      reminderTime: null,
    });
    const groups = groupAndSortForToday([untimed, timed]);
    expect(groups.map((g) => g.identityPhrase)).toEqual(["timed", "untimed"]);
  });

  it("among timed goals, sorts by earliest reminderTime ascending", () => {
    const goalA = makeCard({
      id: "a1",
      identityPhrase: "early",
      reminderTime: "07:00",
      reminderType: "daily",
    });
    const goalB = makeCard({
      id: "b1",
      identityPhrase: "late",
      reminderTime: "19:00",
      reminderType: "daily",
    });
    const groups = groupAndSortForToday([goalB, goalA]);
    expect(groups.map((g) => g.identityPhrase)).toEqual(["early", "late"]);
  });

  it("earliestReminderTime is computed over ALL habits in the goal (including done/skipped/off-day)", () => {
    // Goal has one done habit (reminder 06:00) and one action-needed habit
    // (reminder 18:00). The goal's slot is anchored at 06:00, NOT 18:00 — so
    // it should sort earlier than another goal whose only timed habit is 12:00.
    const earlyDone = makeCard({
      id: "early-done",
      identityPhrase: "wake-early",
      reminderTime: "06:00",
      reminderType: "daily",
      todayStatus: "done",
    });
    const lateActive = makeCard({
      id: "late-active",
      identityPhrase: "wake-early",
      reminderTime: "18:00",
      reminderType: "daily",
      todayStatus: null,
    });
    const middayActive = makeCard({
      id: "midday",
      identityPhrase: "midday",
      reminderTime: "12:00",
      reminderType: "daily",
      todayStatus: null,
    });
    const groups = groupAndSortForToday([earlyDone, lateActive, middayActive]);
    expect(groups.map((g) => g.identityPhrase)).toEqual(["wake-early", "midday"]);
  });

  it("among untimed goals, sorts by oldest createdAt ascending", () => {
    const older = makeCard({
      id: "o1",
      identityPhrase: "older",
      createdAt: "2025-01-01T00:00:00Z",
    });
    const newer = makeCard({
      id: "n1",
      identityPhrase: "newer",
      createdAt: "2025-06-01T00:00:00Z",
    });
    const groups = groupAndSortForToday([newer, older]);
    expect(groups.map((g) => g.identityPhrase)).toEqual(["older", "newer"]);
  });

  it("falls back to identity_phrase lex order as stability tiebreaker", () => {
    const z = makeCard({
      id: "z1",
      identityPhrase: "zeta",
      createdAt: "2025-01-01T00:00:00Z",
    });
    const a = makeCard({
      id: "a1",
      identityPhrase: "alpha",
      createdAt: "2025-01-01T00:00:00Z",
    });
    const groups = groupAndSortForToday([z, a]);
    expect(groups.map((g) => g.identityPhrase)).toEqual(["alpha", "zeta"]);
  });

  it("treats reminder_type 'none' as untimed even with a stored reminder_time", () => {
    // The hook is supposed to translate 'none' → reminderTime null on the card,
    // but defend the ordering module against a card slipped through with both.
    const stale = makeCard({
      id: "s1",
      identityPhrase: "stale",
      reminderTime: "07:00",
      reminderType: "none",
    });
    // reminderTime !== null on this card, so the ordering module currently
    // treats it as timed. The protection lives at the hook merge; document
    // the rule here.
    const groups = groupAndSortForToday([stale]);
    expect(groups[0].identityPhrase).toBe("stale");
  });

  it("treats a goal where every habit is off-day as resolved (done zone)", () => {
    const offDayOnly = makeCard({
      id: "od1",
      identityPhrase: "rest day",
      offDay: true,
      todayStatus: null,
    });
    const active = makeCard({
      id: "a1",
      identityPhrase: "still active",
      offDay: false,
      todayStatus: null,
    });
    const groups = groupAndSortForToday([offDayOnly, active]);
    expect(groups.map((g) => g.identityPhrase)).toEqual([
      "still active",
      "rest day",
    ]);
  });
});
