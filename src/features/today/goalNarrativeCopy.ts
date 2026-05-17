const EARLY_HIGH = [
  "Day one done. Come back tomorrow.",
  "Perfect so far. The real test is next week.",
  "Strong start. The pattern will tell the story.",
];

const EARLY_MID = [
  "Finding your rhythm. Give it a week to settle.",
  "A few days in. The consistency picture is still forming.",
];

const EARLY_LOW = [
  "Still early. One good day changes the number.",
  "The first week is the hardest. Keep showing up.",
];

const LOW = [
  "Some weeks are harder. What matters is you're still here.",
  "A rough stretch — but not a reason to stop.",
  "This is a slow start. That's allowed.",
];

const BUILDING = [
  "Building momentum. The rhythm is starting to form.",
  "About half the time so far. Every week makes it easier.",
  "Not every day, but more days than not. That's progress.",
];

const SOLID = [
  "Three out of four days, consistently. A real rhythm.",
  "Showing up most days. This is what consistency looks like.",
  "A strong pattern is forming here.",
];

const STRONG = [
  "Near-perfect. This is becoming part of who you are.",
  "Almost every single day. The habit is taking root.",
  "Consistency like this is rare. You've earned it.",
];

const NOT_STARTED = ["This goal hasn't started yet."];

function pick(pool: string[], seed: number): string {
  const index = ((seed % pool.length) + pool.length) % pool.length;
  return pool[index];
}

export function getGoalNarrative(
  consistencyRate: number | null,
  activeDaysElapsed: number,
): string {
  if (consistencyRate === null) {
    return pick(NOT_STARTED, activeDaysElapsed);
  }

  if (activeDaysElapsed < 7) {
    if (consistencyRate >= 0.7) return pick(EARLY_HIGH, activeDaysElapsed);
    if (consistencyRate >= 0.4) return pick(EARLY_MID, activeDaysElapsed);
    return pick(EARLY_LOW, activeDaysElapsed);
  }

  if (consistencyRate < 0.4) return pick(LOW, activeDaysElapsed);
  if (consistencyRate < 0.7) return pick(BUILDING, activeDaysElapsed);
  if (consistencyRate < 0.9) return pick(SOLID, activeDaysElapsed);
  return pick(STRONG, activeDaysElapsed);
}
