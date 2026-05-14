const SUPPRESSED = [
  "Day one done. Keep showing up — a picture will form after a week.",
  "Just getting started. Give it a week before the numbers mean anything.",
  "Too early to measure. What matters now is showing up.",
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

function pick(pool: string[], seed: number): string {
  const index = ((seed % pool.length) + pool.length) % pool.length;
  return pool[index];
}

export function getGoalNarrative(
  consistencyRate: number | null,
  activeDaysElapsed: number,
): string {
  if (activeDaysElapsed < 7 || consistencyRate === null) {
    return pick(SUPPRESSED, activeDaysElapsed);
  }

  if (consistencyRate < 0.4) return pick(LOW, activeDaysElapsed);
  if (consistencyRate < 0.7) return pick(BUILDING, activeDaysElapsed);
  if (consistencyRate < 0.9) return pick(SOLID, activeDaysElapsed);
  return pick(STRONG, activeDaysElapsed);
}
