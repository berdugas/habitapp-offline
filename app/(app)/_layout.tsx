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
      <Stack.Screen name="habits/create" options={{ headerShown: false }} />
      <Stack.Screen name="habits/backlog" options={{ headerShown: false }} />
      <Stack.Screen name="habits/[habitId]" options={{ headerShown: false }} />
      <Stack.Screen
        name="habits/[habitId]/edit"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="habits/[habitId]/context"
        options={{ title: "Habit Context" }}
      />
      <Stack.Screen
        name="goals/[identityPhrase]"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="reviews/[habitId]"
        options={{ title: "Weekly Review" }}
      />
      <Stack.Screen
        name="reviews/goal/[identityPhrase]"
        options={{ gestureEnabled: false, headerShown: false }}
      />
      <Stack.Screen
        name="graduation/[habitId]"
        options={{ headerShown: false }}
      />
    </Stack>
  );
}
