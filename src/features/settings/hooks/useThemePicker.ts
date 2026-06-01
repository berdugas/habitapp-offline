import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";

import { THEMES } from "@/theme/registry";
import { useThemeContext } from "@/theme/ThemeProvider";
import { loadFontsFor } from "@/theme/fonts/loader";
import { areAllFontsCached } from "@/theme/fonts/cache";
import { trackEvent } from "@/services/analytics";
import { setPreference } from "@/lib/db/repositories/preferences";
import { formatBytes } from "@/features/settings/components/ThemeCard";

import type { Theme, ThemeId } from "@/theme/contract";

export type LoadErrorKind = "network" | "storage" | "integrity" | "other";
export type LoadError = { themeId: ThemeId; themeName: string; kind: LoadErrorKind };

function classifyError(err: unknown): LoadErrorKind {
  const msg = err instanceof Error ? err.message : String(err);
  if (/integrity/i.test(msg)) return "integrity";
  if (/space|ENOSPC|storage|disk/i.test(msg)) return "storage";
  if (/network|fetch|timeout|connection/i.test(msg)) return "network";
  return "other";
}

export type ThemePicker = {
  active: Theme;
  cachedThemeIds: Set<ThemeId>;
  isApplying: boolean;
  loadError: LoadError | null;
  onCardPress: (target: Theme) => Promise<void>;
  retry: () => void;
};

export function useThemePicker(): ThemePicker {
  const { theme: active, setActiveTheme } = useThemeContext();
  const abortRef = useRef<AbortController | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [cachedThemeIds, setCachedThemeIds] = useState<Set<ThemeId>>(new Set());

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
          // Best-effort preload — labels fall back to active theme's font if this fails.
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

  const retry = useCallback(() => {
    if (loadError == null) return;
    void applyTheme(THEMES[loadError.themeId], true);
  }, [applyTheme, loadError]);

  return {
    active,
    cachedThemeIds,
    isApplying,
    loadError,
    onCardPress,
    retry,
  };
}
