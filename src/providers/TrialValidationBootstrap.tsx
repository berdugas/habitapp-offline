import type { PropsWithChildren } from "react";

import { useAuthSession } from "@/features/auth/hooks";
import {
  buildTrialContextValue,
  TrialValidationProvider,
  useTrialValidationLifecycle,
} from "@/features/trial/hooks";

export function TrialValidationBootstrap({ children }: PropsWithChildren) {
  const { user, isBootstrapping: isAuthBootstrapping } = useAuthSession();
  const { state, refresh } = useTrialValidationLifecycle(
    user?.id ?? null,
    isAuthBootstrapping,
  );

  const contextValue = buildTrialContextValue(state, refresh);

  return (
    <TrialValidationProvider value={contextValue}>
      {children}
    </TrialValidationProvider>
  );
}
