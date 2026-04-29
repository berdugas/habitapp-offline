import type { PropsWithChildren } from "react";
import { useEffect, useState } from "react";

import { AuthSessionProvider } from "@/features/auth/hooks";
import { getSession } from "@/features/auth/api";
import { onSupabaseAuthStateChange } from "@/lib/supabase/auth";
import { logger } from "@/services/logger";

import type { AuthSessionState } from "@/features/auth/types";

const initialState: AuthSessionState = {
  isBootstrapping: true,
  session: null,
  user: null,
};

export function AuthBootstrap({ children }: PropsWithChildren) {
  const [authState, setAuthState] = useState<AuthSessionState>(initialState);

  useEffect(() => {
    let isMounted = true;

    void getSession()
      .then(({ data, error }) => {
        if (!isMounted) {
          return;
        }

        if (error) {
          logger.error("Failed to hydrate auth session", { error });
        }

        setAuthState({
          isBootstrapping: false,
          session: data.session,
          user: data.session?.user ?? null,
        });
      })
      .catch((error) => {
        logger.error("Unexpected auth hydration error", { error });

        if (!isMounted) {
          return;
        }

        setAuthState({
          isBootstrapping: false,
          session: null,
          user: null,
        });
      });

    const subscription = onSupabaseAuthStateChange(async (_event, session) => {
      setAuthState({
        isBootstrapping: false,
        session,
        user: session?.user ?? null,
      });
    });

    return () => {
      isMounted = false;
      subscription.data.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthSessionProvider value={authState}>{children}</AuthSessionProvider>
  );
}
