const VARIANTS = [
  (n: number) => `You've been at it for ${n} days straight.`,
  (n: number) => `${n} days in a row. Keep showing up.`,
  (n: number) => `${n}-day streak. One day at a time.`,
  (n: number) => `Going strong for ${n} days.`,
  (n: number) => `${n} days of consistency. That's the work.`,
];

export function getStreakCopy(streak: number): string {
  if (streak === 0) return "Today is a fresh start.";
  if (streak === 1) return "Day one done. Come back tomorrow.";
  return VARIANTS[streak % VARIANTS.length](streak);
}
