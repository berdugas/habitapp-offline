// Approved notification copy templates.
// Rules: no streak-loss language, no guilt, no urgency pressure.

const BACKUP_TEMPLATES = [
  (name: string) => `Time for ${name} — you've got this.`,
  (name: string) => `Gentle nudge: ${name} is waiting.`,
  (name: string) => `${name} — a small step today keeps the habit alive.`,
  (name: string) => `Your habit is ready when you are: ${name}.`,
  (name: string) => `Just a reminder: ${name}. No pressure, just a nudge.`,
];

const DAILY_TEMPLATES = [
  (name: string) => `Time for ${name}.`,
  (name: string) => `${name} — ready when you are.`,
  (name: string) => `Your daily habit is calling: ${name}.`,
  (name: string) => `One small step: ${name}.`,
  (name: string) => `${name} — keep the momentum going.`,
];

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

export function getBackupNotificationBody(
  habitName: string,
  seed = Date.now(),
): string {
  return pick(BACKUP_TEMPLATES, seed)(habitName);
}

export function getDailyNotificationBody(
  habitName: string,
  seed = Date.now(),
): string {
  return pick(DAILY_TEMPLATES, seed)(habitName);
}
