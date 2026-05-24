import { useMutation } from "@tanstack/react-query";

import { exportForUser } from "@/features/settings/api";
import { useAuthSession } from "@/features/auth/hooks";
import { trackEvent } from "@/services/analytics";

export function useExportData() {
  const { user } = useAuthSession();

  return useMutation({
    mutationFn: () => exportForUser(user),
    onSuccess: () => {
      trackEvent("settings_export_completed", { success: true });
    },
    onError: (error) => {
      // Coarse-grained reason: surface the error name so we can buck
      // failures by class (e.g. permissions, IO, share-cancel). The
      // allowlist passes both `success` and `reason` un-redacted.
      trackEvent("settings_export_completed", {
        success: false,
        reason: error instanceof Error ? error.name : "unknown",
      });
    },
  });
}
