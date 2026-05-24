import "@/polyfills";
import "react-native-gesture-handler";

import { useEffect, useState } from "react";
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
import { goalIdFor, initGoalIdRegistry } from "@/services/goalIdRegistry";
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
function ScreenTracker() {
  const pathname = usePathname();
  const params = useGlobalSearchParams<{
    habitId?: string;
    identityPhrase?: string;
  }>();

  useEffect(() => {
    if (!pathname) return;
    const props: Record<string, unknown> = {};
    if (typeof params.habitId === "string" && params.habitId.length > 0) {
      props.habit_id = params.habitId;
    }
    if (
      typeof params.identityPhrase === "string" &&
      params.identityPhrase.length > 0
    ) {
      // Route params are URL-encoded; decode before hashing so the
      // goal_id matches the hash emitted from goal mutations (which
      // hash the raw, in-memory identityPhrase).
      try {
        props.goal_id = goalIdFor(decodeURIComponent(params.identityPhrase));
      } catch {
        // Malformed URL encoding — skip the goal_id rather than throw.
      }
    }
    posthogScreen(pathname, Object.keys(props).length > 0 ? props : undefined);
    // Effect deps are the destructured param values, not the params
    // object itself — useGlobalSearchParams returns a fresh object every
    // render, which would over-fire if used directly as a dep.
  }, [pathname, params.habitId, params.identityPhrase]);

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
