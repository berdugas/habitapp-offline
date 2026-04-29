import { Stack } from "expo-router";

import { OnboardingProvider } from "@/features/onboarding/OnboardingProvider";
import { colors } from "@/theme/colors";

export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          gestureEnabled: false,
          headerShown: false,
        }}
      />
    </OnboardingProvider>
  );
}
