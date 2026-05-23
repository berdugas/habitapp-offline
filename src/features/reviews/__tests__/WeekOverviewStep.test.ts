import {
  getAgendaLine,
  getHeadline,
  getInterpretationLine,
} from "@/features/reviews/components/WeekOverviewStep";

import type {
  GoalWeekSummary,
  HabitWeekSummary,
} from "@/features/reviews/buildGoalWeekSummary";

function makeHabit(
  title: string,
  flags: { isStrong?: boolean; needsAttention?: boolean } = {},
): HabitWeekSummary {
  return {
    habitId: title,
    title,
    icon: null,
    formula: `${title}-formula`,
    cue: `${title}-cue`,
    tinyAction: `${title}-action`,
    identityPhrase: "Becoming a reviewer",
    activeDays: [1, 2, 3, 4, 5, 6, 7],
    weekLogs: [],
    doneCount: 0,
    missCount: 0,
    skipCount: 0,
    activeDayCount: 7,
    weekConsistency: 0,
    isStrong: flags.isStrong ?? false,
    needsAttention: flags.needsAttention ?? false,
  };
}

function makeSummary(habits: HabitWeekSummary[]): GoalWeekSummary {
  const strongHabits = habits.filter((h) => h.isStrong);
  const attentionHabits = habits.filter((h) => h.needsAttention);
  return {
    identityPhrase: "Becoming a reviewer",
    habits,
    overallDoneCount: 0,
    overallActiveDayCount: habits.length * 7,
    overallConsistency: 0,
    strongHabits,
    attentionHabits,
    totalActiveDaysInWeek: 7,
    totalDaysShowedUp: 0,
    oldestActiveDaysCount: 30,
  };
}

describe("WeekOverviewStep pure helpers", () => {
  describe("getHeadline", () => {
    it("'Steady all week.' when every habit is strong", () => {
      const summary = makeSummary([
        makeHabit("Drink water", { isStrong: true }),
        makeHabit("Stretch", { isStrong: true }),
      ]);
      expect(getHeadline(summary)).toBe("Steady all week.");
    });

    it("'A reset week.' when every habit needs attention", () => {
      const summary = makeSummary([
        makeHabit("Run", { needsAttention: true }),
        makeHabit("Read", { needsAttention: true }),
      ]);
      expect(getHeadline(summary)).toBe("A reset week.");
    });

    it("'Mostly steady.' when strong outnumber attention", () => {
      const summary = makeSummary([
        makeHabit("A", { isStrong: true }),
        makeHabit("B", { isStrong: true }),
        makeHabit("C", { needsAttention: true }),
      ]);
      expect(getHeadline(summary)).toBe("Mostly steady.");
    });

    it("'A few to tune up.' when attention outnumber strong (with at least one strong)", () => {
      const summary = makeSummary([
        makeHabit("A", { isStrong: true }),
        makeHabit("B", { needsAttention: true }),
        makeHabit("C", { needsAttention: true }),
      ]);
      expect(getHeadline(summary)).toBe("A few to tune up.");
    });

    it("'A mixed week.' on an even strong/attention split", () => {
      const summary = makeSummary([
        makeHabit("A", { isStrong: true }),
        makeHabit("B", { needsAttention: true }),
      ]);
      expect(getHeadline(summary)).toBe("A mixed week.");
    });
  });

  describe("getInterpretationLine", () => {
    it("names strong habits when none need attention", () => {
      const summary = makeSummary([
        makeHabit("Drink water", { isStrong: true }),
        makeHabit("Stretch", { isStrong: true }),
      ]);
      expect(getInterpretationLine(summary)).toBe(
        "You held Drink water and Stretch.",
      );
    });

    it("names attention habits when none are strong (singular 'needs')", () => {
      const summary = makeSummary([makeHabit("Run", { needsAttention: true })]);
      expect(getInterpretationLine(summary)).toBe("Run needs a tweak.");
    });

    it("uses plural 'need' for multiple attention habits", () => {
      const summary = makeSummary([
        makeHabit("Run", { needsAttention: true }),
        makeHabit("Stretch", { needsAttention: true }),
      ]);
      expect(getInterpretationLine(summary)).toBe(
        "Run and Stretch need a tweak.",
      );
    });

    it("names both buckets in a mixed week", () => {
      const summary = makeSummary([
        makeHabit("Drink water", { isStrong: true }),
        makeHabit("Stretch", { needsAttention: true }),
      ]);
      expect(getInterpretationLine(summary)).toBe(
        "You held Drink water. Stretch needs a tweak.",
      );
    });

    it("uses count fallback when more than 3 habits are in a bucket", () => {
      const summary = makeSummary([
        makeHabit("A", { isStrong: true }),
        makeHabit("B", { isStrong: true }),
        makeHabit("C", { isStrong: true }),
        makeHabit("D", { isStrong: true }),
        makeHabit("E", { needsAttention: true }),
      ]);
      expect(getInterpretationLine(summary)).toBe(
        "You held 4 habits. E needs a tweak.",
      );
    });

    it("falls back to 'Everything held this week.' when nothing is flagged", () => {
      const summary = makeSummary([makeHabit("A")]);
      expect(getInterpretationLine(summary)).toBe("Everything held this week.");
    });
  });

  describe("getAgendaLine", () => {
    it("'Everything's in good shape this week.' when no attention", () => {
      const summary = makeSummary([
        makeHabit("A", { isStrong: true }),
        makeHabit("B", { isStrong: true }),
      ]);
      expect(getAgendaLine(summary)).toBe(
        "Everything's in good shape this week.",
      );
    });

    it("singular 'habit' for one attention habit", () => {
      const summary = makeSummary([
        makeHabit("A", { isStrong: true }),
        makeHabit("B", { needsAttention: true }),
      ]);
      expect(getAgendaLine(summary)).toBe(
        "Next: see what worked, then adjust 1 habit.",
      );
    });

    it("plural 'habits' for multiple attention habits", () => {
      const summary = makeSummary([
        makeHabit("A", { isStrong: true }),
        makeHabit("B", { needsAttention: true }),
        makeHabit("C", { needsAttention: true }),
      ]);
      expect(getAgendaLine(summary)).toBe(
        "Next: see what worked, then adjust 2 habits.",
      );
    });

    it("uses 'together' framing when no strong habits", () => {
      const summary = makeSummary([
        makeHabit("A", { needsAttention: true }),
        makeHabit("B", { needsAttention: true }),
      ]);
      expect(getAgendaLine(summary)).toBe(
        "Next: let's adjust 2 habits together.",
      );
    });
  });
});
