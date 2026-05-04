import { Redirect, Stack } from "expo-router";

import { LoadingState } from "@/components/feedback/LoadingState";
import { useAuthSession } from "@/features/auth/hooks";

export default function ProtectedLayout() {
  const { isBootstrapping, session } = useAuthSession();

  if (isBootstrapping) {
    return <LoadingState message="Restoring your app..." />;
  }

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="habits/create" options={{ title: "Create Habit" }} />
      <Stack.Screen name="habits/[habitId]" options={{ title: "Habit Detail" }} />
      <Stack.Screen
        name="habits/[habitId]/edit"
        options={{ title: "Edit Habit" }}
      />
      <Stack.Screen
        name="habits/[habitId]/context"
        options={{ title: "Habit Context" }}
      />
      <Stack.Screen
        name="reviews/[habitId]"
        options={{ title: "Weekly Review" }}
      />
    </Stack>
  );
}
