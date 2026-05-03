import { Redirect, useLocalSearchParams } from "expo-router";

function normalizeHabitId(habitId: string | string[] | undefined) {
  if (Array.isArray(habitId)) {
    return habitId[0];
  }

  return habitId;
}

export default function DeferredWeeklyReviewRoute() {
  const { habitId } = useLocalSearchParams<{ habitId?: string | string[] }>();
  const normalizedHabitId = normalizeHabitId(habitId);

  if (normalizedHabitId) {
    return <Redirect href={`/(app)/habits/${normalizedHabitId}`} />;
  }

  return <Redirect href="/(app)/(tabs)/today" />;
}
