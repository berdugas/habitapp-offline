export function getLatestSRHIQueryKey(habitId: string | undefined) {
  return ["srhi", "latest", habitId ?? "unknown"] as const;
}

export function getSRHIHistoryQueryKey(habitId: string | undefined) {
  return ["srhi", "history", habitId ?? "unknown"] as const;
}
