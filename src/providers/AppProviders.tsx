import { useEffect, type PropsWithChildren } from "react";

import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "@/lib/query/queryClient";
import { AuthBootstrap } from "@/providers/AuthBootstrap";
import { TrialValidationBootstrap } from "@/providers/TrialValidationBootstrap";
import { PaywallController } from "@/features/paywall/PaywallController";
import { initDayBoundary } from "@/utils/dayBoundary";

export function AppProviders({ children }: PropsWithChildren) {
  useEffect(() => {
    const cleanup = initDayBoundary();
    return cleanup;
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap>
        <TrialValidationBootstrap>
          <PaywallController>{children}</PaywallController>
        </TrialValidationBootstrap>
      </AuthBootstrap>
    </QueryClientProvider>
  );
}
