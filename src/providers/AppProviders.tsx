import type { PropsWithChildren } from "react";

import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "@/lib/query/queryClient";
import { AuthBootstrap } from "@/providers/AuthBootstrap";
import { TrialValidationBootstrap } from "@/providers/TrialValidationBootstrap";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap>
        <TrialValidationBootstrap>{children}</TrialValidationBootstrap>
      </AuthBootstrap>
    </QueryClientProvider>
  );
}
