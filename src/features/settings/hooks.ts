import { useMutation } from "@tanstack/react-query";

import { exportForUser } from "@/features/settings/api";
import { useAuthSession } from "@/features/auth/hooks";

export function useExportData() {
  const { user } = useAuthSession();

  return useMutation({
    mutationFn: () => exportForUser(user),
  });
}
