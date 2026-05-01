import { Stack } from "expo-router";

import { OnboardingProvider } from "@/features/onboarding/OnboardingProvider";
import { colors } from "@/theme/colors";

export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.bg },
          gestureEnabled: false,
          headerShown: false,
        }}
      />
    </OnboardingProvider>
  );
}
