import { Redirect, Slot } from "expo-router";

import { LoadingState } from "@/components/feedback/LoadingState";
import { useAuthSession } from "@/features/auth/hooks";

export default function AuthLayout() {
  const { isBootstrapping, session } = useAuthSession();

  if (isBootstrapping) {
    return <LoadingState message="Checking your session..." />;
  }

  if (session) {
    return <Redirect href="/" />;
  }

  return <Slot />;
}
