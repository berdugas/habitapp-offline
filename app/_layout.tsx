import "@/polyfills";
import "react-native-gesture-handler";

import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { useFonts } from "expo-font";
import {
  PlusJakartaSans_700Bold,
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
import { logger } from "@/services/logger";
import { colors } from "@/theme/colors";
import { useAuthSession } from "@/features/auth/hooks";

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

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_700Bold,
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
        <AppProviders>
          <NotificationHandler />
          <StatusBar
            backgroundColor={colors.surface}
            style="dark"
            translucent={false}
          />
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
        </AppProviders>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
