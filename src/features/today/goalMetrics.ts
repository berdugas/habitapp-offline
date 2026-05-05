type HabitForMetrics = {
  consistencyRate: number;
  startDate: string;
  streak: number;
};

export function avgConsistencyRate(habits: HabitForMetrics[]): number {
  if (habits.length === 0) return 0;
  return habits.reduce((sum, h) => sum + h.consistencyRate, 0) / habits.length;
}

export function oldestStreak(habits: HabitForMetrics[]): number {
  const sorted = [...habits].sort((a, b) => a.startDate.localeCompare(b.startDate));
  return sorted[0]?.streak ?? 0;
}
