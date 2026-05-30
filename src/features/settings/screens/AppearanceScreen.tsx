import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SvgXml } from "react-native-svg";
import { Check, ChevronLeft } from "lucide-react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useThemeContext } from "@/theme/ThemeProvider";
import { useThemedStyles } from "@/theme/useThemedStyles";
import { useTheme } from "@/theme/useTheme";
import { THEMES } from "@/theme/registry";
import { loadFontsFor } from "@/theme/fonts/loader";
import { areAllFontsCached, clearFontCache } from "@/theme/fonts/cache";
import { trackEvent } from "@/services/analytics";
import { setPreference } from "@/lib/db/repositories/preferences";

import type { Theme, ThemeId } from "@/theme/contract";

type LoadErrorKind = "network" | "storage" | "integrity" | "other";
type LoadError = { themeId: ThemeId; themeName: string; kind: LoadErrorKind };

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    const kb = Math.round(bytes / 1024 / 100) * 100;
    return `${kb} KB`;
  }
  const mb = Math.round((bytes / (1024 * 1024)) * 10) / 10;
  return `${mb} MB`;
}

function classifyError(err: unknown): LoadErrorKind {
  const msg = err instanceof Error ? err.message : String(err);
  if (/integrity/i.test(msg)) return "integrity";
  if (/space|ENOSPC|storage|disk/i.test(msg)) return "storage";
  if (/network|fetch|timeout|connection/i.test(msg)) return "network";
  return "other";
}

export default function AppearanceScreen() {
  const { theme: active, setActiveTheme } = useThemeContext();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const abortRef = useRef<AbortController | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [cachedThemeIds, setCachedThemeIds] = useState<Set<ThemeId>>(new Set());

  useEffect(() => {
    trackEvent("settings_appearance_opened");
  }, []);

  // Register fonts for any non-active theme whose assets are already cached on
  // disk. Lets each theme card render its name in its own typeface without
  // forcing a download just to show the picker correctly.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = new Set<ThemeId>();
      for (const t of Object.values(THEMES) as Theme[]) {
        const isCached = await areAllFontsCached(t);
        if (cancelled) return;
        if (!isCached) continue;
        cached.add(t.id);
        if (t.id === active.id) continue;
        try {
          await loadFontsFor(t, new AbortController().signal);
        } catch {
          // Best-effort preload — labels fall back to system font if this fails.
        }
        if (cancelled) return;
      }
      if (!cancelled && cached.size > 0) setCachedThemeIds(cached);
    })();
    return () => {
      cancelled = true;
    };
  }, [active.id]);

  const applyTheme = useCallback(
    async (target: Theme, isRetry: boolean) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsApplying(true);
      setLoadError(null);

      const requiredDownload = target.fontAssets.kind === "remote";
      const startedAt = Date.now();

      try {
        await loadFontsFor(target, controller.signal);
        if (controller.signal.aborted) return;
        setActiveTheme(target.id);
        await setPreference("theme_id", target.id);
        trackEvent("theme_changed", {
          from_theme_id: active.id,
          to_theme_id: target.id,
          required_download: requiredDownload,
          was_retry: isRetry,
          time_to_apply_ms: Date.now() - startedAt,
        });
      } catch (err) {
        if (controller.signal.aborted) {
          trackEvent("theme_font_download_cancelled", { theme_id: target.id });
          return;
        }
        const kind = classifyError(err);
        setLoadError({ themeId: target.id, themeName: target.name, kind });
        trackEvent("theme_font_download_failed", { theme_id: target.id, error_kind: kind });
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setIsApplying(false);
      }
    },
    [active.id, setActiveTheme],
  );

  const onCardPress = useCallback(
    async (target: Theme) => {
      trackEvent("theme_picker_card_pressed", {
        theme_id: target.id,
        was_active: target.id === active.id,
      });
      if (target.id === active.id) return;

      if (target.fontAssets.kind === "remote") {
        const alreadyCached = await areAllFontsCached(target);
        if (!alreadyCached) {
          const totalBytes = Object.values(target.fontAssets.assets).reduce(
            (sum, a) => sum + a.bytes,
            0,
          );
          const proceed = await new Promise<boolean>((resolve) => {
            Alert.alert(
              `Apply ${target.name} theme?`,
              `This will download about ${formatBytes(totalBytes)} of fonts. Connect to Wi-Fi if you're on cellular.`,
              [
                { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
                { text: "Download", onPress: () => resolve(true) },
              ],
              { cancelable: true, onDismiss: () => resolve(false) },
            );
          });
          if (!proceed) return;
        }
      }

      await applyTheme(target, false);
    },
    [active.id, applyTheme],
  );

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
      errorBanner: {
        backgroundColor: t.colors.dangerSoft,
        borderRadius: t.radius.sm,
        gap: t.spacing.sm,
        padding: t.spacing.md,
      },
      errorText: {
        color: t.colors.danger,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyMd,
      },
      errorRetry: {
        color: t.colors.primary,
        fontFamily: t.fontFamilies.bodySemi,
        fontSize: t.typography.bodyMd,
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
      overlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.4)",
        gap: t.spacing.md,
        justifyContent: "center",
      },
      overlayLabel: {
        color: "#FFFFFF",
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyLg,
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
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>
              Couldn&apos;t load {loadError.themeName} theme. Connect to the internet and try
              again.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void applyTheme(THEMES[loadError.themeId], true);
              }}
            >
              <Text style={styles.errorRetry}>Retry</Text>
            </Pressable>
          </View>
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

      {isApplying ? (
        <View style={styles.overlay}>
          <ActivityIndicator color={active.colors.primary} size="large" />
          <Text style={styles.overlayLabel}>Downloading fonts…</Text>
        </View>
      ) : null}
    </View>
  );
}

function ThemeCard({
  theme,
  isActive,
  isFontReady,
  onPress,
}: {
  theme: Theme;
  isActive: boolean;
  isFontReady: boolean;
  onPress: () => void;
}) {
  // Each card's label uses its own theme's display font (when available) so
  // the picker shows the theme's actual typography. Falls back to the active
  // theme's font for remote themes that haven't been downloaded yet — at that
  // point we don't know what the font looks like to render it anyway.
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      card: {
        backgroundColor: t.colors.surfaceCard,
        borderColor: isActive ? t.colors.primary : "transparent",
        borderRadius: t.radius.md,
        borderWidth: 2,
        gap: t.spacing.md,
        padding: t.spacing.lg,
      },
      preview: { borderRadius: t.radius.sm, overflow: "hidden" },
      row: { alignItems: "center", flexDirection: "row", gap: t.spacing.lg },
      swatches: { flexDirection: "row", gap: 4 },
      swatch: { borderRadius: 6, height: 12, width: 12 },
      label: {
        color: t.colors.text,
        flex: 1,
        fontFamily: isFontReady ? theme.fontFamilies.displaySemi : t.fontFamilies.displaySemi,
        fontSize: t.typography.titleLg,
      },
    }),
  );

  return (
    <Pressable
      accessibilityHint={
        theme.fontAssets.kind === "remote"
          ? `Applies the ${theme.name} theme. May need to download fonts.`
          : `Applies the ${theme.name} theme.`
      }
      accessibilityRole="radio"
      accessibilityState={{ selected: isActive }}
      onPress={onPress}
      style={styles.card}
      testID={`theme-card-${theme.id}`}
    >
      <View style={styles.preview}>
        <SvgXml height={80} width="100%" xml={theme.previewSvg} />
      </View>
      <View style={styles.row}>
        <View style={styles.swatches}>
          <View style={[styles.swatch, { backgroundColor: theme.colors.primary }]} />
          <View style={[styles.swatch, { backgroundColor: theme.colors.surfaceHigh }]} />
          <View style={[styles.swatch, { backgroundColor: theme.colors.graduatedBadge }]} />
        </View>
        <Text style={styles.label}>{theme.name}</Text>
        {isActive ? (
          <Check
            color={theme.colors.primary}
            size={20}
            strokeWidth={2.5}
            testID={`active-checkmark-${theme.id}`}
          />
        ) : null}
      </View>
    </Pressable>
  );
}
