import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useThemedStyles } from "@/theme/useThemedStyles";
import { useTheme } from "@/theme/useTheme";
import { THEMES } from "@/theme/registry";
import { clearFontCache } from "@/theme/fonts/cache";
import { trackEvent } from "@/services/analytics";
import { ThemeCard } from "@/features/settings/components/ThemeCard";
import { ThemeLoadErrorBanner } from "@/features/settings/components/ThemeLoadErrorBanner";
import { ThemePickerOverlay } from "@/features/settings/components/ThemePickerOverlay";
import { useThemePicker } from "@/features/settings/hooks/useThemePicker";

import type { Theme } from "@/theme/contract";

export default function AppearanceScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { active, cachedThemeIds, isApplying, loadError, onCardPress, retry } =
    useThemePicker();

  useEffect(() => {
    trackEvent("settings_appearance_opened");
  }, []);

  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      screen: { flex: 1, backgroundColor: t.colors.bg },
      content: { padding: t.spacing.xl, gap: t.spacing.lg },
      headerRow: {
        alignItems: "center",
        flexDirection: "row",
        gap: t.spacing.sm,
        marginBottom: t.spacing.sm,
      },
      backButton: {
        alignItems: "center",
        height: 36,
        justifyContent: "center",
        width: 36,
      },
      title: {
        color: t.colors.text,
        fontFamily: t.fontFamilies.displayBold,
        fontSize: t.typography.headlineLg,
      },
      footer: {
        color: t.colors.textMuted,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyMd,
        paddingTop: t.spacing.lg,
        textAlign: "center",
      },
      devButton: { alignItems: "center", marginTop: t.spacing.lg, padding: t.spacing.sm },
      devButtonText: {
        color: t.colors.textFaint,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyMd,
      },
    }),
  );

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + theme.spacing.lg }]}
      >
        <View style={styles.headerRow}>
          <Pressable
            accessibilityLabel="Go back"
            hitSlop={12}
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <ChevronLeft color={theme.colors.textMuted} size={22} strokeWidth={1.75} />
          </Pressable>
          <Text style={styles.title}>Appearance</Text>
        </View>

        {loadError ? (
          <ThemeLoadErrorBanner themeName={loadError.themeName} onRetry={retry} />
        ) : null}

        {(Object.values(THEMES) as Theme[]).map((t) => (
          <ThemeCard
            key={t.id}
            theme={t}
            isActive={t.id === active.id}
            isFontReady={t.fontAssets.kind === "bundled" || t.id === active.id || cachedThemeIds.has(t.id)}
            onPress={() => {
              void onCardPress(t);
            }}
          />
        ))}

        <Text style={styles.footer}>
          Non-default themes need internet to download fonts the first time they&apos;re used.
          After that, they work offline.
        </Text>

        {__DEV__ ? (
          <Pressable
            onPress={() => {
              void clearFontCache();
            }}
            style={styles.devButton}
          >
            <Text style={styles.devButtonText}>[DEV] Clear font cache</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {isApplying ? <ThemePickerOverlay /> : null}
    </View>
  );
}
