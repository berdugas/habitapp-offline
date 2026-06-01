# Theme picker in onboarding — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Insert a new "Make it yours" theme-picker step between `personalize` and `confirmation` in the onboarding flow, sharing 100% of picker logic with Settings → Appearance via an extracted hook + components.

**Architecture:** Extract the picker behaviour from `AppearanceScreen` into a shared hook `useThemePicker` plus three presentational components (`ThemeCard`, `ThemeLoadErrorBanner`, `ThemePickerOverlay`). Refactor `AppearanceScreen` to compose them (no behaviour change — existing tests still pass). Add a new `MakeItYoursScreen` that composes the same pieces inside onboarding chrome. Theme is persisted via the existing `setPreference("theme_id", id)` path — no new draft field. Add `showBack?: boolean` to `OnboardingHeader` so the new screen can hide its back affordance without stranding the user.

**Tech Stack:** React Native + Expo, TypeScript, Jest, React Native Testing Library, expo-router file-based routing, lucide-react-native icons.

**Spec:** [`docs/superpowers/specs/2026-06-01-theme-in-onboarding-design.md`](../specs/2026-06-01-theme-in-onboarding-design.md)

---

## Task 1: Add `"make-it-yours"` to `OnboardingStep` and `STEP_TO_HREF`

**Files:**
- Modify: `src/features/onboarding/types.ts`
- Modify: `app/(onboarding)/index.tsx`

This task is type-only plumbing. The route doesn't exist yet, so we must add both the union member AND the `STEP_TO_HREF` entry in the same commit — otherwise TypeScript will flag `STEP_TO_HREF` as non-exhaustive on `Record<OnboardingStep, string>`. No runtime behaviour changes; no user has a persisted draft with `step: "make-it-yours"` yet.

- [ ] **Step 1: Add the union member**

Edit `src/features/onboarding/types.ts` lines 1–13:

```ts
export type OnboardingStep =
  | "welcome"
  | "insight"
  | "becoming"
  | "action-insight"
  | "daily-action"
  | "shrink-insight"
  | "shrink"
  | "cue-insight"
  | "cue"
  | "schedule"
  | "personalize"
  | "make-it-yours"
  | "confirmation";
```

- [ ] **Step 2: Add the matching `STEP_TO_HREF` entry**

Edit `app/(onboarding)/index.tsx` lines 7–20 — insert one line between `personalize` and `confirmation`:

```ts
const STEP_TO_HREF: Record<OnboardingStep, string> = {
  "welcome": "/(onboarding)/welcome",
  "insight": "/(onboarding)/insight",
  "becoming": "/(onboarding)/becoming",
  "action-insight": "/(onboarding)/action-insight",
  "daily-action": "/(onboarding)/daily-action",
  "shrink-insight": "/(onboarding)/shrink-insight",
  "shrink": "/(onboarding)/shrink",
  "cue-insight": "/(onboarding)/cue-insight",
  "cue": "/(onboarding)/cue",
  "schedule": "/(onboarding)/schedule",
  "personalize": "/(onboarding)/personalize",
  "make-it-yours": "/(onboarding)/make-it-yours",
  "confirmation": "/(onboarding)/confirmation",
};
```

- [ ] **Step 3: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 4: Run the existing onboarding tests**

Run: `npx jest src/features/onboarding --runInBand`
Expected: PASS (no behaviour-affecting change).

- [ ] **Step 5: Commit**

```bash
git add src/features/onboarding/types.ts "app/(onboarding)/index.tsx"
git commit -m "feat(onboarding): reserve make-it-yours step + route entry"
```

---

## Task 2: Add `showBack` prop to `OnboardingHeader` and bump default `totalSteps` to 7

**Files:**
- Modify: `src/components/navigation/OnboardingHeader.tsx`

The current header at [`OnboardingHeader.tsx:19`](../../../src/components/navigation/OnboardingHeader.tsx#L19) unconditionally renders `<BackButton>`. `BackButton` defaults its `onPress` to `router.back()` if undefined, so just omitting `onBack` does NOT hide the button. We add a `showBack?: boolean` prop (default `true`, preserving every existing screen) and render a 40×40 spacer `View` in the BackButton's slot when `false`, so the progress bar stays at the same horizontal position as every other screen. We also bump the default `totalSteps` from 6 to 7 since we're adding a step.

- [ ] **Step 1: Edit the component**

Replace `src/components/navigation/OnboardingHeader.tsx` entirely:

```tsx
import { StyleSheet, View } from 'react-native';

import { BackButton } from './BackButton';
import { ProgressBar } from './ProgressBar';

type OnboardingHeaderProps = {
  currentStep: number;
  totalSteps?: number;
  onBack?: () => void;
  showBack?: boolean;
};

export function OnboardingHeader({
  currentStep,
  totalSteps = 7,
  onBack,
  showBack = true,
}: OnboardingHeaderProps) {
  return (
    <View style={styles.container}>
      {showBack ? (
        <BackButton onPress={onBack} />
      ) : (
        <View accessibilityElementsHidden style={styles.backSpacer} />
      )}
      <ProgressBar currentStep={currentStep} totalSteps={totalSteps} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 44,
  },
  backSpacer: {
    width: 40,
    height: 40,
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Run the existing onboarding screen tests**

Run: `npx jest src/features/onboarding/__tests__/screens --runInBand`
Expected: PASS. The default-bump from 6 → 7 changes only the rendered progress bar's filled-segment ratio, not any assertion these tests make.

- [ ] **Step 4: Commit**

```bash
git add src/components/navigation/OnboardingHeader.tsx
git commit -m "feat(onboarding-header): add showBack prop + bump default totalSteps to 7"
```

---

## Task 3: Extract `<ThemeCard>` to its own file (with optional `downloadSizeBytes` prop)

**Files:**
- Create: `src/features/settings/components/ThemeCard.tsx`

Move the inline `ThemeCard` component declared at [`AppearanceScreen.tsx:299–371`](../../../src/features/settings/screens/AppearanceScreen.tsx#L299) into its own file. Add a new optional `downloadSizeBytes?: number | null` prop. When non-null and the theme isn't yet cached, render a small caption under the swatches with the formatted size. Settings keeps the caption off by omitting the prop. `formatBytes` is co-located here so we don't have to import it from the hook (it stays internal-to-this-module-only for now).

- [ ] **Step 1: Create the file**

Create `src/features/settings/components/ThemeCard.tsx`:

```tsx
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { Check } from "lucide-react-native";

import { useThemedStyles } from "@/theme/useThemedStyles";

import type { Theme } from "@/theme/contract";

type ThemeCardProps = {
  theme: Theme;
  isActive: boolean;
  isFontReady: boolean;
  /**
   * If provided AND the theme is not already cached on disk (i.e. !isFontReady),
   * render a small caption with the download size under the swatches. Settings
   * omits this; Onboarding passes the computed total bytes.
   */
  downloadSizeBytes?: number | null;
  onPress: () => void;
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    const kb = Math.round(bytes / 1024 / 100) * 100;
    return `${kb} KB`;
  }
  const mb = Math.round((bytes / (1024 * 1024)) * 10) / 10;
  return `${mb} MB`;
}

export function ThemeCard({
  theme,
  isActive,
  isFontReady,
  downloadSizeBytes,
  onPress,
}: ThemeCardProps) {
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
        fontFamily: isFontReady ? theme.fontFamilies.displaySemi : t.fontFamilies.displaySemi,
        fontSize: t.typography.titleLg,
      },
      downloadCaption: {
        color: t.colors.textFaint,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.micro,
        marginTop: 4,
      },
    }),
  );

  const showDownloadCaption =
    downloadSizeBytes != null && downloadSizeBytes > 0 && !isFontReady;

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
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>{theme.name}</Text>
          {showDownloadCaption ? (
            <Text style={styles.downloadCaption}>
              {formatBytes(downloadSizeBytes!)} · first time
            </Text>
          ) : null}
        </View>
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS. The file is currently unused; nothing else has changed.

- [ ] **Step 3: Commit**

```bash
git add src/features/settings/components/ThemeCard.tsx
git commit -m "refactor(settings): extract ThemeCard into its own component"
```

---

## Task 4: Extract `<ThemeLoadErrorBanner>` and `<ThemePickerOverlay>`

**Files:**
- Create: `src/features/settings/components/ThemeLoadErrorBanner.tsx`
- Create: `src/features/settings/components/ThemePickerOverlay.tsx`

The error banner at [`AppearanceScreen.tsx:243–258`](../../../src/features/settings/screens/AppearanceScreen.tsx#L243) and the "Downloading fonts…" overlay at [`AppearanceScreen.tsx:289–294`](../../../src/features/settings/screens/AppearanceScreen.tsx#L289) become their own files so both screens render identical UI from the same source.

- [ ] **Step 1: Create the error banner**

Create `src/features/settings/components/ThemeLoadErrorBanner.tsx`:

```tsx
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useThemedStyles } from "@/theme/useThemedStyles";

type ThemeLoadErrorBannerProps = {
  themeName: string;
  onRetry: () => void;
};

export function ThemeLoadErrorBanner({ themeName, onRetry }: ThemeLoadErrorBannerProps) {
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      banner: {
        backgroundColor: t.colors.dangerSoft,
        borderRadius: t.radius.sm,
        gap: t.spacing.sm,
        padding: t.spacing.md,
      },
      text: {
        color: t.colors.danger,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyMd,
      },
      retry: {
        color: t.colors.primary,
        fontFamily: t.fontFamilies.bodySemi,
        fontSize: t.typography.bodyMd,
      },
    }),
  );

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        Couldn&apos;t load {themeName} theme. Connect to the internet and try again.
      </Text>
      <Pressable accessibilityRole="button" onPress={onRetry}>
        <Text style={styles.retry}>Retry</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2: Create the overlay**

Create `src/features/settings/components/ThemePickerOverlay.tsx`:

```tsx
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/useTheme";
import { useThemedStyles } from "@/theme/useThemedStyles";

export function ThemePickerOverlay() {
  const theme = useTheme();
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      overlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.4)",
        gap: t.spacing.md,
        justifyContent: "center",
      },
      label: {
        color: "#FFFFFF",
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyLg,
      },
    }),
  );

  return (
    <View style={styles.overlay}>
      <ActivityIndicator color={theme.colors.primary} size="large" />
      <Text style={styles.label}>Downloading fonts…</Text>
    </View>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/settings/components/ThemeLoadErrorBanner.tsx src/features/settings/components/ThemePickerOverlay.tsx
git commit -m "refactor(settings): extract ThemeLoadErrorBanner + ThemePickerOverlay"
```

---

## Task 5: Extract `useThemePicker` hook

**Files:**
- Create: `src/features/settings/hooks/useThemePicker.ts`

Owns all the orchestration: `cachedThemeIds` preload, `applyTheme` with abort controller, `isApplying` + `loadError` state, the `onCardPress` flow (including the download-size Alert), `formatBytes`, and `classifyError`. Returns the shape pinned in the spec.

`settings_appearance_opened` and the `[DEV] Clear font cache` button stay in `AppearanceScreen` — moving them in would pollute the Settings-discovery funnel.

- [ ] **Step 1: Create the hook file**

Create `src/features/settings/hooks/useThemePicker.ts`:

```ts
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS. The hook isn't imported anywhere yet.

- [ ] **Step 3: Commit**

```bash
git add src/features/settings/hooks/useThemePicker.ts
git commit -m "refactor(settings): extract useThemePicker hook"
```

---

## Task 6: Refactor `AppearanceScreen` to compose the extracted pieces

**Files:**
- Modify: `src/features/settings/screens/AppearanceScreen.tsx`

Replace the inline `ThemeCard`, `applyTheme`/`onCardPress` logic, error banner, and overlay with imports of the extracted hook + components. `settings_appearance_opened` and the `[DEV] Clear font cache` button stay here. Behaviour must be unchanged — the existing 8 tests in [`AppearanceScreen.test.tsx`](../../../src/features/settings/screens/__tests__/AppearanceScreen.test.tsx) verify this.

- [ ] **Step 1: Replace the screen with a thin composition**

Replace `src/features/settings/screens/AppearanceScreen.tsx` entirely:

```tsx
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Run the existing `AppearanceScreen` test suite**

Run: `npx jest src/features/settings/screens/__tests__/AppearanceScreen.test.tsx --runInBand`
Expected: PASS — all 8 existing cases still green:
1. renders one card per theme + fires opened telemetry
2. no-ops when tapping the already-active theme
3. applies a bundled theme instantly without a modal
4. shows a confirm modal then applies a remote theme on Download
5. skips the modal and applies instantly when fonts are already cached
6. does NOT apply when the user cancels the modal
7. surfaces an inline error + telemetry when font load fails
8. [DEV] clear font cache button calls clearFontCache

If any case fails, this is the moment to diagnose — the refactor must be behaviour-preserving.

- [ ] **Step 4: Commit**

```bash
git add src/features/settings/screens/AppearanceScreen.tsx
git commit -m "refactor(settings): AppearanceScreen composes extracted picker pieces"
```

---

## Task 7: Add tests for `useThemePicker`

**Files:**
- Create: `src/features/settings/hooks/__tests__/useThemePicker.test.tsx`

Cover hook orchestration directly so future changes to the hook don't have to ripple through both `AppearanceScreen.test.tsx` and `MakeItYoursScreen.test.tsx`.

- [ ] **Step 1: Create the test file**

Create `src/features/settings/hooks/__tests__/useThemePicker.test.tsx`:

```tsx
import { Alert } from "react-native";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { ThemeProvider } from "@/theme/ThemeProvider";
import { useThemePicker } from "@/features/settings/hooks/useThemePicker";
import { THEMES } from "@/theme/registry";

import type { ThemeId } from "@/theme/contract";

jest.mock("@/theme/fonts/loader", () => ({ loadFontsFor: jest.fn(() => Promise.resolve()) }));
jest.mock("@/services/analytics", () => ({ trackEvent: jest.fn() }));
jest.mock("@/lib/db/repositories/preferences", () => ({ setPreference: jest.fn(() => Promise.resolve()) }));
jest.mock("@/theme/fonts/cache", () => ({
  clearFontCache: jest.fn(() => Promise.resolve()),
  areAllFontsCached: jest.fn(() => Promise.resolve(false)),
}));

import { loadFontsFor } from "@/theme/fonts/loader";
import { trackEvent } from "@/services/analytics";
import { setPreference } from "@/lib/db/repositories/preferences";
import { areAllFontsCached } from "@/theme/fonts/cache";

const mockedLoad = loadFontsFor as jest.Mock;
const mockedCached = areAllFontsCached as jest.Mock;

function wrap(themeId: ThemeId) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <ThemeProvider initialThemeId={themeId} intendedThemeId={themeId}>
        {children}
      </ThemeProvider>
    );
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedLoad.mockResolvedValue(undefined);
  mockedCached.mockResolvedValue(false);
});

describe("useThemePicker", () => {
  it("no-ops onCardPress when target is already active", async () => {
    const { result } = renderHook(() => useThemePicker(), { wrapper: wrap("zen") });
    await act(async () => {
      await result.current.onCardPress(THEMES.zen);
    });
    expect(setPreference).not.toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith(
      "theme_picker_card_pressed",
      expect.objectContaining({ theme_id: "zen", was_active: true }),
    );
  });

  it("applies a bundled theme without showing the Alert", async () => {
    const alertSpy = jest.spyOn(Alert, "alert");
    const { result } = renderHook(() => useThemePicker(), { wrapper: wrap("cafe") });
    await act(async () => {
      await result.current.onCardPress(THEMES.zen);
    });
    await waitFor(() => {
      expect(setPreference).toHaveBeenCalledWith("theme_id", "zen");
    });
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("Alert → Download path applies a remote theme and emits theme_changed", async () => {
    const alertSpy = jest
      .spyOn(Alert, "alert")
      .mockImplementation((_t, _m, btns: any) => {
        btns?.find((b: any) => b.text === "Download")?.onPress?.();
      });
    const { result } = renderHook(() => useThemePicker(), { wrapper: wrap("zen") });
    await act(async () => {
      await result.current.onCardPress(THEMES.cafe);
    });
    await waitFor(() => {
      expect(setPreference).toHaveBeenCalledWith("theme_id", "cafe");
    });
    expect(trackEvent).toHaveBeenCalledWith(
      "theme_changed",
      expect.objectContaining({ from_theme_id: "zen", to_theme_id: "cafe", required_download: true, was_retry: false }),
    );
    alertSpy.mockRestore();
  });

  it("skips the Alert when remote-theme fonts are already cached", async () => {
    mockedCached.mockResolvedValue(true);
    const alertSpy = jest.spyOn(Alert, "alert");
    const { result } = renderHook(() => useThemePicker(), { wrapper: wrap("zen") });
    await act(async () => {
      await result.current.onCardPress(THEMES.cafe);
    });
    await waitFor(() => {
      expect(setPreference).toHaveBeenCalledWith("theme_id", "cafe");
    });
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("Cancel on the Alert leaves nothing applied", async () => {
    const alertSpy = jest
      .spyOn(Alert, "alert")
      .mockImplementation((_t, _m, btns: any) => {
        btns?.find((b: any) => b.text === "Cancel")?.onPress?.();
      });
    const { result } = renderHook(() => useThemePicker(), { wrapper: wrap("zen") });
    await act(async () => {
      await result.current.onCardPress(THEMES.cafe);
    });
    expect(setPreference).not.toHaveBeenCalled();
    expect(mockedLoad).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("classifies network failures and exposes loadError", async () => {
    mockedLoad.mockRejectedValueOnce(new Error("Network request failed"));
    const alertSpy = jest
      .spyOn(Alert, "alert")
      .mockImplementation((_t, _m, btns: any) => {
        btns?.find((b: any) => b.text === "Download")?.onPress?.();
      });
    const { result } = renderHook(() => useThemePicker(), { wrapper: wrap("zen") });
    await act(async () => {
      await result.current.onCardPress(THEMES.cafe);
    });
    await waitFor(() => {
      expect(result.current.loadError).toEqual(
        expect.objectContaining({ themeId: "cafe", themeName: "Cafe", kind: "network" }),
      );
    });
    expect(trackEvent).toHaveBeenCalledWith(
      "theme_font_download_failed",
      expect.objectContaining({ theme_id: "cafe", error_kind: "network" }),
    );
    expect(setPreference).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("retry() re-applies the theme stored in loadError with was_retry=true", async () => {
    mockedLoad.mockRejectedValueOnce(new Error("Network request failed"));
    const alertSpy = jest
      .spyOn(Alert, "alert")
      .mockImplementation((_t, _m, btns: any) => {
        btns?.find((b: any) => b.text === "Download")?.onPress?.();
      });
    const { result } = renderHook(() => useThemePicker(), { wrapper: wrap("zen") });
    await act(async () => {
      await result.current.onCardPress(THEMES.cafe);
    });
    await waitFor(() => {
      expect(result.current.loadError).not.toBeNull();
    });
    mockedLoad.mockResolvedValueOnce(undefined);
    await act(async () => {
      result.current.retry();
    });
    await waitFor(() => {
      expect(setPreference).toHaveBeenCalledWith("theme_id", "cafe");
    });
    expect(trackEvent).toHaveBeenCalledWith(
      "theme_changed",
      expect.objectContaining({ to_theme_id: "cafe", was_retry: true }),
    );
    alertSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run the new test file**

Run: `npx jest src/features/settings/hooks/__tests__/useThemePicker.test.tsx --runInBand`
Expected: PASS (all seven cases).

- [ ] **Step 3: Commit**

```bash
git add src/features/settings/hooks/__tests__/useThemePicker.test.tsx
git commit -m "test(settings): cover useThemePicker hook orchestration directly"
```

---

## Task 8: Write the failing `MakeItYoursScreen` test

**Files:**
- Create: `src/features/onboarding/screens/__tests__/MakeItYoursScreen.test.tsx`

Establish red before green. The screen doesn't exist yet, so the import resolves to nothing and the test crashes — that's the expected failing state.

- [ ] **Step 1: Create the test file**

Create `src/features/onboarding/screens/__tests__/MakeItYoursScreen.test.tsx`:

```tsx
import { Alert } from "react-native";

import { renderWithTheme, screen, fireEvent, act, waitFor } from "@/tests/setup/renderWithTheme";

import MakeItYoursScreen from "@/features/onboarding/screens/MakeItYoursScreen";

jest.mock("react-native-svg", () => ({
  ...jest.requireActual("react-native-svg"),
  Path: () => null,
}));

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock("expo-router", () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
    back: (...args: unknown[]) => mockBack(...args),
  },
}));

const mockUpdate = jest.fn();
jest.mock("@/features/onboarding/OnboardingProvider", () => ({
  useOnboarding: () => ({
    draft: { step: "make-it-yours" },
    update: mockUpdate,
  }),
}));

jest.mock("@/theme/fonts/loader", () => ({ loadFontsFor: jest.fn(() => Promise.resolve()) }));
jest.mock("@/services/analytics", () => ({ trackEvent: jest.fn() }));
jest.mock("@/lib/db/repositories/preferences", () => ({ setPreference: jest.fn(() => Promise.resolve()) }));
jest.mock("@/theme/fonts/cache", () => ({
  clearFontCache: jest.fn(() => Promise.resolve()),
  areAllFontsCached: jest.fn(() => Promise.resolve(false)),
}));

import { loadFontsFor } from "@/theme/fonts/loader";
import { setPreference } from "@/lib/db/repositories/preferences";
import { areAllFontsCached } from "@/theme/fonts/cache";

const mockedLoad = loadFontsFor as jest.Mock;
const mockedCached = areAllFontsCached as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockedLoad.mockResolvedValue(undefined);
  mockedCached.mockResolvedValue(false);
});

describe("MakeItYoursScreen", () => {
  it("renders the headline and reminder microcopy", () => {
    renderWithTheme(<MakeItYoursScreen />);
    expect(screen.getByText("Make it yours.")).toBeTruthy();
    expect(screen.getByText(/Pick a look for your app/i)).toBeTruthy();
    expect(
      screen.getByText(/You can change the theme anytime in Settings/i),
    ).toBeTruthy();
  });

  it("renders one card per theme with Zen pre-selected as the active theme", () => {
    renderWithTheme(<MakeItYoursScreen />, { themeId: "zen" });
    expect(screen.getByTestId("theme-card-zen")).toBeTruthy();
    expect(screen.getByTestId("theme-card-cafe")).toBeTruthy();
    expect(screen.getByTestId("theme-card-fantasy")).toBeTruthy();
    expect(screen.getByTestId("active-checkmark-zen")).toBeTruthy();
  });

  it("does NOT render a back-affordance (no element with accessibilityLabel='Go back')", () => {
    renderWithTheme(<MakeItYoursScreen />);
    expect(screen.queryByLabelText("Go back")).toBeNull();
  });

  it("shows the download-size caption on uncached remote themes", () => {
    renderWithTheme(<MakeItYoursScreen />, { themeId: "zen" });
    // Cafe and Fantasy are remote; areAllFontsCached defaults to false in beforeEach.
    expect(screen.getAllByText(/ · first time$/i).length).toBeGreaterThan(0);
  });

  it("hides the download-size caption once fonts are cached on disk", async () => {
    mockedCached.mockResolvedValue(true);
    renderWithTheme(<MakeItYoursScreen />, { themeId: "zen" });
    // Preload effect populates cachedThemeIds asynchronously; the caption
    // disappears once isFontReady flips to true.
    await waitFor(() => {
      expect(screen.queryByText(/ · first time$/i)).toBeNull();
    });
  });

  it("tapping Continue updates the draft step to confirmation and pushes the route", () => {
    renderWithTheme(<MakeItYoursScreen />);
    fireEvent.press(screen.getByText("Continue"));
    expect(mockUpdate).toHaveBeenCalledWith({ step: "confirmation" });
    expect(mockPush).toHaveBeenCalledWith("/(onboarding)/confirmation");
  });

  it("tapping a non-active card triggers the shared picker flow (Alert → Download → setPreference)", async () => {
    const alertSpy = jest
      .spyOn(Alert, "alert")
      .mockImplementation((_t, _m, btns: any) => {
        btns?.find((b: any) => b.text === "Download")?.onPress?.();
      });
    renderWithTheme(<MakeItYoursScreen />, { themeId: "zen" });
    await act(async () => {
      fireEvent.press(screen.getByTestId("theme-card-cafe"));
    });
    await waitFor(() => {
      expect(setPreference).toHaveBeenCalledWith("theme_id", "cafe");
    });
    alertSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run the new test file to verify it fails**

Run: `npx jest src/features/onboarding/screens/__tests__/MakeItYoursScreen.test.tsx --runInBand`
Expected: FAIL — module not found (`MakeItYoursScreen` doesn't exist yet). This confirms red.

- [ ] **Step 3: Commit (red)**

```bash
git add src/features/onboarding/screens/__tests__/MakeItYoursScreen.test.tsx
git commit -m "test(onboarding): failing tests for MakeItYoursScreen (red)"
```

---

## Task 9: Implement `MakeItYoursScreen`

**Files:**
- Create: `src/features/onboarding/screens/MakeItYoursScreen.tsx`

Compose the onboarding chrome (`OnboardingLayout`, `OnboardingHeader` with `showBack={false}`) around the shared picker (`useThemePicker`, three `ThemeCard`s, `ThemeLoadErrorBanner`, `ThemePickerOverlay`). Continue button is enabled the moment the screen mounts.

- [ ] **Step 1: Create the screen file**

Create `src/features/onboarding/screens/MakeItYoursScreen.tsx`:

```tsx
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Settings as SettingsIcon } from "lucide-react-native";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { OnboardingLayout } from "@/components/layouts/OnboardingLayout";
import { OnboardingHeader } from "@/components/navigation/OnboardingHeader";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import { ThemeCard } from "@/features/settings/components/ThemeCard";
import { ThemeLoadErrorBanner } from "@/features/settings/components/ThemeLoadErrorBanner";
import { ThemePickerOverlay } from "@/features/settings/components/ThemePickerOverlay";
import { useThemePicker } from "@/features/settings/hooks/useThemePicker";
import { THEMES } from "@/theme/registry";
import { useTheme } from "@/theme/useTheme";
import { useThemedStyles } from "@/theme/useThemedStyles";

import type { Theme } from "@/theme/contract";

function totalDownloadBytes(theme: Theme): number | null {
  if (theme.fontAssets.kind !== "remote") return null;
  return Object.values(theme.fontAssets.assets).reduce((sum, a) => sum + a.bytes, 0);
}

export default function MakeItYoursScreen() {
  const { update } = useOnboarding();
  const theme = useTheme();
  const { active, cachedThemeIds, isApplying, loadError, onCardPress, retry } =
    useThemePicker();

  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      headline: {
        fontFamily: t.fontFamilies.displayBold,
        fontSize: 28,
        lineHeight: 33,
        color: t.colors.text,
        marginBottom: 8,
      },
      body: {
        fontFamily: t.fontFamilies.body,
        fontSize: 15,
        lineHeight: 23,
        color: t.colors.textMuted,
        marginBottom: 20,
      },
      cards: {
        gap: t.spacing.md,
      },
      micro: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginTop: t.spacing.md,
      },
      microText: {
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.labelMd,
        color: t.colors.textFaint,
        flex: 1,
      },
    }),
  );

  const handleContinue = () => {
    update({ step: "confirmation" });
    router.push("/(onboarding)/confirmation");
  };

  // Overlay must be a SIBLING of OnboardingLayout, not a child. absoluteFillObject
  // is relative to the nearest View ancestor; placed inside the layout's ScrollView
  // body it would only cover the body and leave the Continue button in the footer
  // visible and tappable mid-download. Wrapping both in an outer flex:1 View lets
  // the overlay cover the entire screen including the footer.
  return (
    <View style={{ flex: 1 }}>
      <OnboardingLayout
        footer={
          <PrimaryButton label="Continue" showArrow onPress={handleContinue} />
        }
      >
        <OnboardingHeader currentStep={7} showBack={false} />

        <Text style={styles.headline}>Make it yours.</Text>
        <Text style={styles.body}>Pick a look for your app.</Text>

        {loadError ? (
          <ThemeLoadErrorBanner themeName={loadError.themeName} onRetry={retry} />
        ) : null}

        <View style={styles.cards}>
          {(Object.values(THEMES) as Theme[]).map((t) => (
            <ThemeCard
              key={t.id}
              theme={t}
              isActive={t.id === active.id}
              isFontReady={t.fontAssets.kind === "bundled" || t.id === active.id || cachedThemeIds.has(t.id)}
              downloadSizeBytes={totalDownloadBytes(t)}
              onPress={() => {
                void onCardPress(t);
              }}
            />
          ))}
        </View>

        <View style={styles.micro}>
          <SettingsIcon color={theme.colors.textFaint} size={14} strokeWidth={1.8} />
          <Text style={styles.microText}>
            You can change the theme anytime in Settings → Appearance.
          </Text>
        </View>
      </OnboardingLayout>

      {isApplying ? <ThemePickerOverlay /> : null}
    </View>
  );
}
```

- [ ] **Step 2: Re-run the screen test file to verify green**

Run: `npx jest src/features/onboarding/screens/__tests__/MakeItYoursScreen.test.tsx --runInBand`
Expected: PASS — all five cases green.

If "does NOT render a back-affordance" fails, double-check that `OnboardingHeader` is being rendered with `showBack={false}` (Task 2 must be in place).

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit (green)**

```bash
git add src/features/onboarding/screens/MakeItYoursScreen.tsx
git commit -m "feat(onboarding): add MakeItYoursScreen theme picker step"
```

---

## Task 10: Create the route file and wire `PersonalizeScreen.handlePass`

**Files:**
- Create: `app/(onboarding)/make-it-yours.tsx`
- Modify: `src/features/onboarding/screens/PersonalizeScreen.tsx`

Match the existing one-line re-export pattern used by every other route (see `app/(onboarding)/personalize.tsx`). Then change `PersonalizeScreen.handlePass` so successful worst-day passes route through `make-it-yours` instead of straight to `confirmation`. After this task, the screen is reachable end-to-end.

- [ ] **Step 1: Create the route file**

Create `app/(onboarding)/make-it-yours.tsx`:

```tsx
export { default } from "@/features/onboarding/screens/MakeItYoursScreen";
```

- [ ] **Step 2: Edit `PersonalizeScreen.handlePass`**

In `src/features/onboarding/screens/PersonalizeScreen.tsx` at lines 203–206, change:

```tsx
  const handlePass = () => {
    update({ worstDayPassed: true, step: "confirmation" });
    router.push("/(onboarding)/confirmation");
  };
```

to:

```tsx
  const handlePass = () => {
    update({ worstDayPassed: true, step: "make-it-yours" });
    router.push("/(onboarding)/make-it-yours");
  };
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Run the full onboarding test suite**

Run: `npx jest src/features/onboarding --runInBand`
Expected: PASS. The existing `ConfirmationScreen.test.tsx` does not exercise navigation from Personalize, and `completion.test.ts` is finalization-only — neither asserts the Personalize → next-step path, so neither breaks.

- [ ] **Step 5: Commit**

```bash
git add "app/(onboarding)/make-it-yours.tsx" src/features/onboarding/screens/PersonalizeScreen.tsx
git commit -m "feat(onboarding): route make-it-yours and wire Personalize handoff"
```

---

## Task 11: Resumption test for `STEP_TO_HREF`

**Files:**
- Create: `src/features/onboarding/__tests__/onboardingIndexRedirect.test.tsx`

Add a small test that proves a hydrated draft with `step: "make-it-yours"` redirects to `/(onboarding)/make-it-yours`. This protects the resumption path (closing the app on the new step then reopening it).

**Important:** Jest's `testMatch` in [`jest.config.js`](../../../jest.config.js) only discovers test files under `src/`. The test goes under `src/features/onboarding/__tests__/` even though the file under test lives at `app/(onboarding)/index.tsx`. The relative import path from that test directory to the route is `../../../../app/(onboarding)/index` (four levels up).

- [ ] **Step 1: Create the test file**

Create `src/features/onboarding/__tests__/onboardingIndexRedirect.test.tsx`:

```tsx
import { render } from "@testing-library/react-native";

const mockRedirect = jest.fn();

jest.mock("expo-router", () => ({
  Redirect: (props: { href: string }) => {
    mockRedirect(props.href);
    return null;
  },
}));

jest.mock("@/features/onboarding/OnboardingProvider", () => ({
  useOnboarding: jest.fn(),
}));

jest.mock("@/components/feedback/LoadingState", () => ({
  LoadingState: () => null,
}));

// Route file lives outside src/, so the moduleNameMapper @/ alias can't reach
// it. Use a relative path. If this file is moved, recount the ../ depth so it
// still lands on app/(onboarding)/index.tsx.
import OnboardingIndex from "../../../../app/(onboarding)/index";

const { useOnboarding } = jest.requireMock(
  "@/features/onboarding/OnboardingProvider",
) as { useOnboarding: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
});

describe("OnboardingIndex resumption", () => {
  it("redirects make-it-yours → /(onboarding)/make-it-yours", () => {
    useOnboarding.mockReturnValue({
      draft: { step: "make-it-yours" },
      hydrated: true,
    });
    render(<OnboardingIndex />);
    expect(mockRedirect).toHaveBeenCalledWith("/(onboarding)/make-it-yours");
  });

  it("redirects personalize → /(onboarding)/personalize (regression guard)", () => {
    useOnboarding.mockReturnValue({
      draft: { step: "personalize" },
      hydrated: true,
    });
    render(<OnboardingIndex />);
    expect(mockRedirect).toHaveBeenCalledWith("/(onboarding)/personalize");
  });

  it("does not redirect while unhydrated", () => {
    useOnboarding.mockReturnValue({
      draft: { step: "welcome" },
      hydrated: false,
    });
    render(<OnboardingIndex />);
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test file**

Run: `npx jest src/features/onboarding/__tests__/onboardingIndexRedirect.test.tsx --runInBand`
Expected: PASS (all three cases).

- [ ] **Step 3: Commit**

```bash
git add src/features/onboarding/__tests__/onboardingIndexRedirect.test.tsx
git commit -m "test(onboarding): resumption redirect covers make-it-yours"
```

---

## Task 12: Final full-suite verification

**Files:** None modified — verification step only.

- [ ] **Step 1: Run the full Jest suite**

Run: `npx jest --runInBand`
Expected: PASS across the project. New test files added in this plan:
- `src/features/settings/hooks/__tests__/useThemePicker.test.tsx`
- `src/features/onboarding/screens/__tests__/MakeItYoursScreen.test.tsx`
- `src/features/onboarding/__tests__/onboardingIndexRedirect.test.tsx`

Existing tests that must still be green:
- `src/features/settings/screens/__tests__/AppearanceScreen.test.tsx` (8 cases)
- `src/features/onboarding/__tests__/screens/*.test.tsx`
- `src/features/onboarding/__tests__/completion.test.ts`

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Smoke-check the flow on a device or emulator (optional but recommended for UI changes)**

Run the app and walk through onboarding from Welcome to Confirmation. Verify:
- Passing the worst-day check on Personalize lands on Make-it-yours (not Confirmation).
- Zen is pre-selected with a checkmark; tapping Continue lands on Confirmation rendered in Zen.
- Tapping Cafe shows the existing download Alert; tapping Download then Continue lands on Confirmation rendered in Cafe colours.
- No back button is visible on Make-it-yours; the progress bar shows segment 7 of 7.

- [ ] **Step 4: (No commit needed for verification-only)**

If any check failed, return to the failing task to diagnose. Otherwise the feature is ready for review.
