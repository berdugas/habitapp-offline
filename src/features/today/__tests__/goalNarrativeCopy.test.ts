import { getGoalNarrative } from "@/features/today/goalNarrativeCopy";

const SUPPRESSED_POOL = [
  "Day one done. Keep showing up — a picture will form after a week.",
  "Just getting started. Give it a week before the numbers mean anything.",
  "Too early to measure. What matters now is showing up.",
];

const LOW_POOL = [
  "Some weeks are harder. What matters is you're still here.",
  "A rough stretch — but not a reason to stop.",
  "This is a slow start. That's allowed.",
];

const BUILDING_POOL = [
  "Building momentum. The rhythm is starting to form.",
  "About half the time so far. Every week makes it easier.",
  "Not every day, but more days than not. That's progress.",
];

const SOLID_POOL = [
  "Three out of four days, consistently. A real rhythm.",
  "Showing up most days. This is what consistency looks like.",
  "A strong pattern is forming here.",
];

const STRONG_POOL = [
  "Near-perfect. This is becoming part of who you are.",
  "Almost every single day. The habit is taking root.",
  "Consistency like this is rare. You've earned it.",
];

describe("getGoalNarrative", () => {
  it("activeDaysElapsed < 7 returns a suppressed variant", () => {
    expect(SUPPRESSED_POOL).toContain(getGoalNarrative(0.8, 3));
  });

  it("null consistencyRate returns a suppressed variant", () => {
    expect(SUPPRESSED_POOL).toContain(getGoalNarrative(null, 30));
  });

  it("rate < 0.40 with >=7 days returns a LOW variant", () => {
    expect(LOW_POOL).toContain(getGoalNarrative(0.3, 14));
  });

  it("0.40 <= rate < 0.70 returns a BUILDING variant", () => {
    expect(BUILDING_POOL).toContain(getGoalNarrative(0.55, 21));
  });

  it("0.70 <= rate < 0.90 returns a SOLID variant", () => {
    expect(SOLID_POOL).toContain(getGoalNarrative(0.78, 30));
  });

  it("rate >= 0.90 returns a STRONG variant", () => {
    expect(STRONG_POOL).toContain(getGoalNarrative(0.95, 40));
  });

  it("is deterministic for the same inputs", () => {
    const a = getGoalNarrative(0.78, 30);
    const b = getGoalNarrative(0.78, 30);
    expect(a).toBe(b);
  });

  it("respects band boundaries (0.40 BUILDING, 0.70 SOLID, 0.90 STRONG)", () => {
    expect(BUILDING_POOL).toContain(getGoalNarrative(0.4, 14));
    expect(LOW_POOL).toContain(getGoalNarrative(0.399, 14));
    expect(SOLID_POOL).toContain(getGoalNarrative(0.7, 14));
    expect(BUILDING_POOL).toContain(getGoalNarrative(0.699, 14));
    expect(STRONG_POOL).toContain(getGoalNarrative(0.9, 14));
    expect(SOLID_POOL).toContain(getGoalNarrative(0.899, 14));
  });
});
