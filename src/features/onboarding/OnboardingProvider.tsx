import { createContext, use, type ReactNode } from "react";

import { useOnboardingDraft } from "./hooks";

type OnboardingContextValue = ReturnType<typeof useOnboardingDraft>;

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const value = useOnboardingDraft();
  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = use(OnboardingContext);
  if (!ctx) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }
  return ctx;
}
