import "@/polyfills";
import "react-native-gesture-handler";

import { useEffect, useRef, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack, useGlobalSearchParams, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { useFonts } from "expo-font";
import {
  PlusJakartaSans_700Bold,
  PlusJakartaSans_700Bold_Italic,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";

import { initDb } from "@/lib/db/client";
import { AppProviders } from "@/providers/AppProviders";
import { handleForegroundNotification } from "@/features/reminders/notifications";
import { checkAndTrackVersionUpgrade } from "@/services/appVersionTracking";
import {
  goalIdFor,
  initGoalIdRegistry,
  isGoalIdRegistryHydrated,
  whenGoalIdRegistryHydrated,
} from "@/services/goalIdRegistry";
import { logger } from "@/services/logger";
import { ErrorBoundary, initSentry, wrap } from "@/services/sentry";
import {
  TelemetryProvider,
  initPostHog,
  screen as posthogScreen,
} from "@/services/posthog";
import { colors } from "@/theme/colors";
import { useAuthSession } from "@/features/auth/hooks";

// Telemetry init at module load — Sentry first so it can catch any PostHog
// init errors, then PostHog. Both no-op without DSN/key in app.json extra,
// and both no-op in __DEV__ unless extra.telemetryInDev is set.
initSentry();
initPostHog();

// Hydrate the persisted goal_id ↔ identityPhrase map BEFORE anything in
// the UI can trigger a goal mutation. goalIdFor() falls back to a
// session-only id if init hasn't completed, so the race window only
// affects the very first launch's pre-init events — see
// src/services/goalIdRegistry.ts for the merge semantics.
void initGoalIdRegistry();

// Version-upgrade detection. Best-effort: fires once per launch, awaits
// internally, and never throws. PostHog client doesn't need to be ready
// (trackEvent breadcrumbs + posthogCapture both handle null clients).
void checkAndTrackVersionUpgrade();

// Suppress notifications that fire while the app is in the foreground — the
// handler decides per-notification (backup type: suppress if already logged).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

void SplashScreen.preventAutoHideAsync();

function NotificationHandler() {
  const { user } = useAuthSession();

  useEffect(() => {
    if (!user?.id) return;

    const subscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        void handleForegroundNotification(notification, user.id).catch((err) => {
          logger.warn("Foreground notification handler error", { err });
        });
      },
    );

    return () => subscription.remove();
  }, [user?.id]);

  return null;
}

// Manual screen tracking for PostHog. Expo Router can't be auto-captured by
// PostHog's RN SDK (per posthog-react-native v4 docs); we watch usePathname()
// + useGlobalSearchParams() and emit a screen event with route-param context
// when either changes. Entity-context keys (habit_id / goal_id) let funnels
// segment by what the user was actually looking at without reconstructing
// from subsequent events.
//
// Hydration handling: goal_id requires the goalIdRegistry to have read its
// persisted map from AsyncStorage. On cold-start deep links into a goal
// route (`/goals/[identityPhrase]`, `/reviews/goal/[identityPhrase]`), the
// ScreenTracker effect can run before hydration completes. Without
// reactivity, the event would ship without goal_id and never re-fire.
// We mirror hydration into React state so the effect re-runs when it
// flips; we defer (don't emit at all) for goal routes until hydrated, so
// the first screen event for that route includes goal_id from the start.
function ScreenTracker() {
  const pathname = usePathname();
  const params = useGlobalSearchParams<{
    habitId?: string;
    identityPhrase?: string;
  }>();
  // Mirror the registry's hydration status into React state so the effect
  // below participates in normal reactivity. Initial value covers the
  // case where hydration completed before this component mounted (warm
  // navigation between sessions where the runtime is reused).
  const [hydrated, setHydrated] = useState(isGoalIdRegistryHydrated());
  useEffect(() => {
    if (hydrated) return;
    let cancelled = false;
    void whenGoalIdRegistryHydrated().then(() => {
      if (!cancelled) setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  // Dedupe by signature so the hydration-driven re-run only emits when
  // it would change the event payload. Without this, scenario "deep-link
  // to goal route, user navigates away to Today, then hydration flips"
  // would emit Today's screen event twice (once on navigation, once
  // when hydrated flips re-running the effect).
  const lastEmittedSigRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    const hasIdentityPhrase =
      typeof params.identityPhrase === "string" &&
      params.identityPhrase.length > 0;

    // Defer goal-route screen events until hydrated so the first event
    // ships with goal_id. lastEmittedSigRef is intentionally NOT updated
    // here — when hydration flips, we want the effect to re-enter and
    // emit. Non-goal routes don't need this wait and emit immediately
    // with whatever entity context is available.
    if (hasIdentityPhrase && !hydrated) return;

    // Signature includes whether goal_id resolution succeeded, so the
    // deferred → hydrated transition is treated as a meaningful change
    // (different signature → emit). For routes without identityPhrase
    // the signature is independent of `hydrated`, so the hydration
    // re-run is a no-op via the equality check below.
    const signature = `${pathname}|${params.habitId ?? ""}|${params.identityPhrase ?? ""}|${hasIdentityPhrase ? "g" : "n"}`;
    if (lastEmittedSigRef.current === signature) return;
    lastEmittedSigRef.current = signature;

    const props: Record<string, unknown> = {};
    if (typeof params.habitId === "string" && params.habitId.length > 0) {
      props.habit_id = params.habitId;
    }
    if (hasIdentityPhrase) {
      // Route params are URL-encoded; decode before lookup so the
      // goal_id matches the one emitted from goal mutations (which
      // pass the raw, in-memory identityPhrase).
      try {
        props.goal_id = goalIdFor(decodeURIComponent(params.identityPhrase!));
      } catch {
        // Malformed URL encoding — skip the goal_id rather than throw.
      }
    }
    posthogScreen(pathname, Object.keys(props).length > 0 ? props : undefined);
    // Effect deps are the destructured param values, not the params
    // object itself — useGlobalSearchParams returns a fresh object every
    // render, which would over-fire if used directly as a dep.
  }, [pathname, params.habitId, params.identityPhrase, hydrated]);

  return null;
}

function ErrorFallback() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backgroundColor: colors.bg,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 16, textAlign: "center" }}>
        Something went wrong. Reopen the app.
      </Text>
    </View>
  );
}

function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_700Bold,
    PlusJakartaSans_700Bold_Italic,
    PlusJakartaSans_800ExtraBold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    initDb()
      .then(() => {
        if (!cancelled) setDbReady(true);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          logger.error("DB init failed at app launch", { error });
          // Splash stays up; user sees no UI. Acceptable failure mode for
          // S1 — recovery UX is out of scope until we see this in practice.
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (fontsLoaded && dbReady) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, dbReady]);

  if (!fontsLoaded || !dbReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <TelemetryProvider>
          <AppProviders>
            <NotificationHandler />
            <ScreenTracker />
            <StatusBar
              backgroundColor={colors.surface}
              style="dark"
              translucent={false}
            />
            <ErrorBoundary fallback={<ErrorFallback />}>
              <View style={{ flex: 1 }}>
                <Stack
                  screenOptions={{
                    contentStyle: { backgroundColor: colors.bg },
                    headerBackButtonDisplayMode: "minimal",
                  }}
                >
                  <Stack.Screen name="index" options={{ headerShown: false }} />
                  <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                  <Stack.Screen name="(app)" options={{ headerShown: false }} />
                  <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
                </Stack>
              </View>
            </ErrorBoundary>
          </AppProviders>
        </TelemetryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default wrap(RootLayout);
