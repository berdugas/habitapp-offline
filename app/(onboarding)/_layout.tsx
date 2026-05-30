import { useEffect } from "react";
import { Stack, usePathname } from "expo-router";

import { OnboardingProvider } from "@/features/onboarding/OnboardingProvider";
import { trackEvent } from "@/services/analytics";
import { useTheme } from "@/theme/useTheme";

// Pathname-driven onboarding step view tracking. We mount this once at the
// onboarding layout level rather than wiring 12 useEffects across each screen
// — usePathname() changes on every route transition inside (onboarding), and
// the derived step is the kebab→snake-case form of the leaf segment. The
// index.tsx redirect-only route emits pathname "/" which we skip.
function OnboardingStepTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const segment = pathname.replace(/^\//, "");
    if (!segment) return;
    const step = segment.replace(/-/g, "_");
    trackEvent("onboarding_step_viewed", { step });
  }, [pathname]);

  return null;
}

export default function OnboardingLayout() {
  const theme = useTheme();
  return (
    <OnboardingProvider>
      <OnboardingStepTracker />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: theme.colors.bg },
          gestureEnabled: false,
          headerShown: false,
        }}
      />
    </OnboardingProvider>
  );
}
