type HabitForMetrics = {
  consistencyDenominator: number;
  consistencyRate: number;
  startDate: string;
  streak: number;
};

export function avgConsistencyRate(habits: HabitForMetrics[]): number | null {
  const habitsWithData = habits.filter((h) => h.consistencyDenominator > 0);
  if (habitsWithData.length === 0) return null;
  return habitsWithData.reduce((sum, h) => sum + h.consistencyRate, 0) / habitsWithData.length;
}

export function oldestStreak(habits: HabitForMetrics[]): number {
  const sorted = [...habits].sort((a, b) => a.startDate.localeCompare(b.startDate));
  return sorted[0]?.streak ?? 0;
}
