export type StreakBreakResult =
  | { broken: false }
  | { broken: true; breakRunStartDate: string }; // YYYY-MM-DD of oldest miss in current run

export type SingleMissResult =
  | { isSingleMiss: false }
  | { isSingleMiss: true; missDate: string }; // YYYY-MM-DD
