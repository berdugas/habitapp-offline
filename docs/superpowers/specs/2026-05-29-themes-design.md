# Themes — design spec

**Date:** 2026-05-29
**Status:** Approved — ready for implementation planning
**Scope:** v1 ships a runtime-swappable theme system + 3 themes (Zen, Cafe, Fantasy)

---

## 1. Goal

Let the user pick from a small catalog of named themes that swap colors and font families across the entire app at runtime. The current look becomes the default theme ("Zen"). Two additional themes ship at launch: "Cafe" (warm browns, Poppins) and "Fantasy" (royal blue + gold, New Rocker display + IBM Plex Mono body).

Theme selection is local-only (lives in the existing `local_user_preferences` SQLite key/value table). No OS dark mode integration in v1. No theme sync across devices. No theme creator or user-defined themes.

---

## 2. Decisions (locked)

| Area | Decision |
|---|---|
| Scope per theme | Colors + font families only. Typography sizes and spacing scales are universal across themes. Radii and shadows are universal. |
| Catalog | Extensible registry (~5 themes target). v1 ships 3: Zen, Cafe, Fantasy. |
| Color contract | Strict 23-field contract — every theme defines all 23 explicitly. No auto-derivation. No optional accents slot. |
| Font loading | Zen bundled (default; current `@expo-google-fonts/*` setup unchanged). Cafe + Fantasy lazy-loaded from a self-hosted Supabase storage bucket on first activation; cached to disk by content hash. |
| OS dark mode | Ignored in v1. User-picked theme always wins regardless of system setting. |
| Picker UX | Dedicated `AppearanceScreen` reached from Settings. Cards show theme name, three swatches, and a bundled SVG preview of "Aa Build daily." in the theme's actual fonts. Tap-to-apply. |
| Sync | Local only. Theme survives reinstall only if SQLite is restored (iOS iCloud / Android Auto Backup). |
| Architecture | React Context (`ThemeProvider`) + `useTheme()` hook + `useThemedStyles()` factory wrapping `StyleSheet.create`. Every styled component restructured to call the hook. |

---

## 3. Architecture

### 3.1 File layout

```
src/theme/
  contract.ts              ← Theme type (concrete shape in §3.2)
  registry.ts              ← { zen, cafe, fantasy } registered themes
  ThemeProvider.tsx        ← React context; holds active theme + setActiveTheme()
  useTheme.ts              ← hook → active Theme object
  useThemedStyles.ts       ← helper → useMemo(() => StyleSheet.create(factory(theme)), [theme])
  fonts/
    loader.ts              ← loadFontsFor(theme): downloads via expo-file-system if remote, registers via expo-font
    cache.ts               ← cache key = sha256 hash; download-once-then-serve-from-cache
  themes/
    zen.ts                 ← current look lifted into a Theme object; fontAssets.kind = 'bundled'
    cafe.ts                ← warm browns + Poppins; fontAssets.kind = 'remote'
    fantasy.ts             ← royal blue + gold + New Rocker / IBM Plex Mono; fontAssets.kind = 'remote'
    previews/
      zen.svg              ← text-to-path SVG, ~5 KB; "Aa Build daily."
      cafe.svg             ← same content, Poppins
      fantasy.svg          ← same content, New Rocker + IBM Plex Mono
  colors.ts                ← (existing) rewritten in PR 1 to re-export zen.colors; deleted in PR 6
  typography.ts            ← (existing) re-export zen.typography; deleted in PR 6
  spacing.ts               ← (existing) re-export zen.spacing; deleted in PR 6
  radius.ts                ← (existing) re-export zen.radius; deleted in PR 6
  shadows.ts               ← (existing) re-export zen.shadows; deleted in PR 6
  fontFamilies.ts          ← (existing) re-export zen.fontFamilies; deleted in PR 6
src/features/settings/screens/
  AppearanceScreen.tsx     ← picker
test/
  helpers/renderWithTheme.tsx     ← test wrapper
  setup.ts                        ← global wrap of @testing-library/react-native render
```

### 3.2 Theme contract

```ts
export type ThemeId = 'zen' | 'cafe' | 'fantasy';

export type Theme = {
  id: ThemeId;
  name: string;                // 'Zen' | 'Cafe' | 'Fantasy' — display in picker
  colors: Colors;              // all 23 fields, locked
  typography: Typography;      // universal — same shape and values across themes in v1
  spacing: Spacing;            // universal — same shape and values across themes in v1
  radius: Radius;              // universal
  shadows: Shadows;            // universal
  fontFamilies: FontFamilies;  // per-theme
  fontAssets:
    | { kind: 'bundled'; assets: Record<string, number> }                                // Zen only
    | { kind: 'remote'; assets: Record<string, { uri: string; hash: string; bytes: number }> }; // Cafe + Fantasy
};
```

The `fontAssets` discriminated union forces the loader to handle both at compile time. `bytes` is used to compute the download-size shown in the confirm modal.

### 3.3 Wiring (app/_layout.tsx after final PR)

```tsx
<GestureHandlerRootView>
  <SafeAreaProvider>
    <TelemetryProvider>
      <ThemeProvider initialThemeId={loadedThemeId}>
        <AppProviders>
          <ThemedRoot />   {/* StatusBar, ErrorBoundary, Stack live here */}
        </AppProviders>
      </ThemeProvider>
    </TelemetryProvider>
  </SafeAreaProvider>
</GestureHandlerRootView>
```

`ThemedRoot` is a new child component that calls `useTheme()` and feeds `colors.surface` to `StatusBar`, `colors.bg` to `Stack.screenOptions.contentStyle`, and a themed `ErrorFallback`. This resolves the cannot-call-hooks-in-RootLayout issue at the existing inline references in [app/_layout.tsx:222,282,290](app/_layout.tsx).

### 3.4 Cold-start flow

1. `_layout.tsx` reads `theme_id` from `local_user_preferences` via existing `getPreference()`. Unknown or missing → `'zen'`. If the stored id was *unknown* (not just missing), additionally overwrite the preference to `'zen'` since there's no valid choice to preserve.
2. Look up theme in registry. Call `loadFontsFor(theme)`:
   - `kind === 'bundled'`: hand assets straight to `useFonts()` (current pattern, unchanged for Zen).
   - `kind === 'remote'` + cached: register via `Font.loadAsync({ name: { uri: 'file://cached.ttf' } })`. (Cache is keyed by content hash; presence implies the bytes already matched the expected hash at write time.)
   - `kind === 'remote'` + cache miss + online: download to a temp file, **compute SHA256 and compare against the expected `hash` from the theme file**. On match, move into cache (keyed by hash) and register. On mismatch, delete the temp file and route to the same path as `download failed mid-flight` (preserve preference, fall back to Zen, banner).
   - `kind === 'remote'` + cache miss + offline: **fall back to Zen at runtime, do not overwrite preference**. Preference is preserved unchanged, so the next cold-start reads the same intended theme and naturally retries the load. Surface a non-dismissable ~3s banner on first render: *"Couldn't load Fantasy theme. Connect to the internet and try again. Using Zen for now."*
   - Font registered but fails to parse: fall back to Zen, **delete corrupted cache file**, preserve preference (next cold-start naturally retries), same banner with "try again" framing.
3. Mount `ThemeProvider` with the resolved theme. Hide splash.

### 3.5 Runtime switch flow

1. User taps a theme in `AppearanceScreen`.
2. If tapped theme is the *runtime* active theme: no-op. (Note: runtime vs intended — see §3.6.)
3. If `fontAssets.kind === 'bundled'` or assets already cached: `setActiveTheme(id)` → write `theme_id` to preferences → tree rerenders. Instant.
4. If `kind === 'remote'` and not cached:
   - Modal: *"Apply Fantasy theme? This will download about {formatted} of fonts. Connect to Wi-Fi if you're on cellular."* `[Cancel] [Download]`. `{formatted}` is computed at runtime by summing `bytes` across the theme's `assets`, rounding to nearest 100 KB, and rendering as `"{n} KB"` below 1024 KB or `"{n.n} MB"` above (e.g. `"800 KB"` or `"1.5 MB"`). Actual per-theme totals are determined after the Pre-PR-1 upload step (§8) — TTF weights from Google Fonts are typically 30-50 KB each, so Cafe (5 Poppins weights) and Fantasy (1 New Rocker + 5 IBM Plex Mono weights) both land roughly under 1 MB in practice.
   - On `Download`: lock the screen with a centered spinner + "Downloading fonts…" label. All cards disable. Wire an `AbortController` so the back gesture cancels cleanly.
   - On success: SHA256 verify downloaded file against expected `hash` (same step as cold-start §3.4). If mismatch, treat as failure path below. If match, theme applies + screen unlocks + checkmark moves.
   - On failure mid-flight (network drop, integrity mismatch, disk full): unlock screen, show `[ErrorState]` inline at the top — *"Couldn't load Fantasy theme. Connect to the internet and try again."* with a Retry button. No theme change.
   - On cancel: abort the download, delete any partial cache file (`controller.abort()` + `FileSystem.deleteAsync(partialPath, { idempotent: true })`), unlock screen.
5. Offline + not cached: modal becomes *"This theme needs to download fonts. Connect to the internet and try again."* `[OK]` only. No download attempt.

### 3.6 Runtime-vs-intended theme semantics

The picker checkmark and Settings row reflect the *runtime* theme — what's actually rendering. If the user picked Cafe but cold-start fell back to Zen due to offline, the picker shows Zen with the checkmark and Cafe without.

Re-tapping the intended-but-not-runtime theme is implicit retry: it re-triggers the download flow. Emitted as `theme_changed` with `was_retry: true`.

### 3.7 Concurrent picker taps

User taps Cafe, then immediately Fantasy before Cafe's download finishes. Single in-flight `AbortController` ref in the picker: new tap aborts the prior, deletes the partial cache file, starts the new download. Only the most recent tap wins.

---

## 4. Theme values

### 4.1 Zen (existing — lifted as-is)

All 23 colors, current typography scale, spacing (`4/8/12/16/24/32/48`), radii, shadows, Plus Jakarta Sans + Manrope. No visual change for users when the theme is selected. Zero work beyond moving values from `src/theme/colors.ts` (etc.) into `src/theme/themes/zen.ts`.

### 4.2 Cafe

| Field | Value |
|---|---|
| bg | `#F9F7F5` |
| surface | `#E9E3DD` |
| surfaceCard | `#FFFFFF` |
| surfaceHigh | `#D4CCC0` |
| surfaceMuted | `#F4F0EA` |
| text / textMuted / textFaint | `#3E2B1E` / `#6F5847` / `#A09080` |
| primary | `#5D4432` |
| primaryGradientEnd | `#7A5E45` |
| primaryLight / primarySoft | `#E9D9C4` / `#F5EDE0` |
| primaryText | `#FFFFFF` |
| success / danger / dangerSoft / dangerSubtle | `#16A34A` / `#DC2626` / `#FEF2F2` / `#FCA5A5` |
| heatDone / heatSkipped / heatMissed | `#5D4432` / `#D9C19C` / `#EDE5D8` |
| offDayBorder | `#E9DDC9` |
| graduatedBadge / graduatedCircle | `#F5EDE0` / `#7B5E3D` |

Fonts (mapping current weight slots → Poppins):
- `displayBold` → `Poppins_800ExtraBold`
- `displaySemi` → `Poppins_700Bold`
- `displaySemiItalic` → `Poppins_700Bold_Italic`
- `body` / `bodyMedium` / `bodySemi` / `bodyBold` / `bodyExtraBold` → `Poppins_400Regular` / `_500Medium` / `_600SemiBold` / `_700Bold` / `_800ExtraBold`

### 4.3 Fantasy

| Field | Value |
|---|---|
| bg | `#FFFFFF` |
| surface | `#F3F4F6` |
| surfaceCard | `#FFFFFF` |
| surfaceHigh | `#E5E7EB` |
| surfaceMuted | `#F9FAFB` |
| text / textMuted / textFaint | `#111827` / `#4B5563` / `#9CA3AF` |
| primary | `#0250CC` |
| primaryGradientEnd | `#3B82F6` |
| primaryLight / primarySoft | `#BFDBFE` / `#EFF6FF` |
| primaryText | `#FFFFFF` |
| success / danger / dangerSoft / dangerSubtle | `#16A34A` / `#DC2626` / `#FEF2F2` / `#FCA5A5` |
| heatDone / heatSkipped / heatMissed | `#0250CC` / `#FDE68A` / `#F3F4F6` |
| offDayBorder | `#E5E7EB` |
| graduatedBadge / graduatedCircle | `#FDC800` / `#1F2937` (gold pill, near-black label — satisfies the legibility constraint) |

Fonts. New Rocker is a decorative blackletter with one weight — unreadable at body sizes. Split:
- `displayBold` / `displaySemi` / `displaySemiItalic` → `NewRocker_400Regular`
- `body` / `bodyMedium` / `bodySemi` / `bodyBold` / `bodyExtraBold` → `IBMPlexMono_400Regular` / `_500Medium` / `_500Medium` / `_600SemiBold` / `_700Bold`

(IBM Plex Mono ships only 100/200/300/400/500/600/700 weights; closest match is used where the slot expects something heavier.)

### 4.4 Design constraint: graduatedCircle on graduatedBadge

`graduatedCircle` is used as the text color on a `graduatedBadge` background in [LibraryHabitCard.tsx:139-147](src/features/library/components/LibraryHabitCard.tsx) and [HabitDetailScreen.tsx:605-613](src/features/habits/screens/HabitDetailScreen.tsx). New themes must pick a `graduatedCircle` legible on their `graduatedBadge`. **Code-enforced** via the contrast test in §7 (the pair is enumerated; new themes get it checked with no waiver).

Computed v1 values (corrected — an earlier draft of this section mistakenly used Zen's `primary` `#446655` instead of its actual `graduatedCircle` `#6b9e7d`):
- **Zen: `#6b9e7d` on `#c6ebd5` = 2.38:1 — FAILS AA.** This is the *current shipping app's* pairing (mint label on mint badge). Zen must remain visually identical to today, so its colors cannot change in this project; the pair is **grandfathered via a §7 waiver** and the underlying a11y debt is tracked as a separate fix (see §11/§12). New themes do NOT get this waiver.
- Cafe: `#7B5E3D` on `#F5EDE0` = **5.15:1** (passes).
- Fantasy: `#1F2937` on `#FDC800` = **9.39:1** (passes).

---

## 5. Picker UX

### 5.1 Settings entry

A row inside Settings, above "Privacy & Data":

```
Appearance  • Zen  >
```

The `•` dot uses runtime `colors.primary`, changing with the theme. Provides a tiny in-context confirmation. Entry is added only in the final migration PR; during prior PRs a `__DEV__`-gated entry is used.

### 5.2 AppearanceScreen layout

Per-card content:
- **Bundled preview SVG** (~5 KB each, text-to-path) showing "Aa" in the theme's display font and "Build daily." in the theme's body font over the theme's `bg`. No font download is triggered by opening the picker.
- **Three swatches** (12px circles): theme's `primary`, `surfaceHigh`, `graduatedBadge`.
- **Theme name**.
- **Active state**: checkmark icon (✓) on the right + 2px border using runtime `colors.primary`. (Runtime, not intended — see §3.6.)
- **Accessibility:** `accessibilityRole="radio"`, `accessibilityState={{ selected: isActive }}`. For remote-uncached themes, `accessibilityHint` carries the download warning. No manual `announceForAccessibility` — the OS handles the selection-change announcement.

### 5.3 Footer copy

*"Non-default themes need internet to download fonts the first time they're used. After that, they work offline."*

---

## 6. Error matrix

Preference-rewrite rule (top-level): preferences are rewritten only when the stored value is invalid (unknown id, parse error). Never on runtime fallback where the user's choice is still meaningful.

| Trigger | Behavior | User-facing | Telemetry |
|---|---|---|---|
| Cold-start: theme_id missing/unknown | Fall back to Zen, write `zen` to preference | None | `theme_unknown_id_recovered` (`bad_id`) |
| Cold-start: remote theme + cached fonts | Register from cache, mount | None | None |
| Cold-start: remote theme + cache miss + online | Download, cache, register, mount | Splash stays up briefly (~2-5s) | None |
| Cold-start: remote theme + cache miss + offline | Fall back to runtime Zen, **preference preserved unchanged** (next cold-start naturally retries) | Non-dismissable ~3s banner: *"Couldn't load Fantasy theme. Connect to the internet and try again. Using Zen for now."* | `theme_offline_fallback_triggered` (`intended_theme_id`) |
| Cold-start: download failed mid-flight | Same as cache-miss-offline | Same banner | `theme_font_download_failed` (`error_kind: 'network'`) |
| Cold-start: downloaded font hash mismatch | Delete temp file, preference preserved (next cold-start naturally retries), fall back to Zen | Same banner | `theme_font_download_failed` (`error_kind: 'integrity'`) |
| Cold-start: registered font fails to parse | Fall back to Zen, **delete corrupted cache file**, preference preserved (next cold-start naturally retries) | Same banner with "try again" framing | `theme_font_load_failed` (`error_kind: 'parse'`) |
| Picker: tap currently-active runtime theme | No-op | None | `theme_picker_card_pressed` (`was_active: true`) |
| Picker: tap a theme with fonts cached | Apply instantly | Card highlight moves | `theme_changed` (`required_download: false`) |
| Picker: tap remote theme, cache miss, online | Confirm modal → download spinner → apply | Modal then loading | `theme_changed` (`required_download: true`) |
| Picker: user cancels mid-download | Abort, delete partial file, unlock screen | Screen returns to normal | `theme_font_download_cancelled` |
| Picker: disk full mid-download | Abort, delete partial file, unlock screen | Error inline at top of screen: *"Couldn't save Fantasy fonts to disk. Free up space and try again."* | `theme_font_download_failed` (`error_kind: 'storage'`) |
| Picker: downloaded font hash mismatch | Delete temp file, unlock screen, surface inline error | Error inline at top of screen: *"Couldn't load Fantasy theme. Connect to the internet and try again."* | `theme_font_download_failed` (`error_kind: 'integrity'`) |
| Picker: tap remote theme, cache miss, offline | Show offline modal, no download | Modal: *"This theme needs to download fonts. Connect to the internet and try again."* | `theme_offline_download_blocked` |
| Picker: user backgrounds app mid-download | **Best-effort.** iOS suspends JS within seconds; Android within minutes. If suspended, treated as cancelled on next foreground. | None until reopen | (existing failed/cancelled events) |
| App update: theme removed from registry | Treat as unknown_id on next launch | None | `theme_unknown_id_recovered` |
| App update: theme's font hash changed | Detected in cache check (key by hash), download new asset on first activation | None until activated | None |
| Restored install (iOS iCloud / Android Auto Backup with preserved SQLite) | Same flow as fresh launch with that preference. Removed-theme id falls through unknown_id_recovered path. | Depends on path above | Per matching row |

---

## 7. Testing

- **`test/setup.ts`** wraps `@testing-library/react-native`'s `render` with `<ThemeProvider initialThemeId="zen">`. Existing ~150 test renders continue to pass unchanged because Zen's values match today's static `colors`/`typography`/etc. exactly.
- **`renderWithTheme(ui, { themeId: 'cafe' })`** overrides the default for theme-specific assertions. Used sparingly.
- **Contrast unit test** runs in PR 1. For each theme, computes WCAG contrast ratio for every `(fg, bg)` token pair where `fg` is a text-color token and `bg` is a surface-color token. Fails CI if any pair falls below 4.5:1 (AA Normal) **except** pairs listed in `KNOWN_CONTRAST_WAIVERS`.

```ts
const KNOWN_CONTRAST_WAIVERS = [
  // textFaint is a deliberately-faint hint color; it fails AA Normal on every
  // surface in all three themes (~2.3–3.1:1). Pre-existing in Zen; mirrored debt
  // in Cafe/Fantasy. Tracked in §12 v2 followups #8.
  { themeId: 'zen',     fg: 'textFaint',       bg: 'bg',          reason: "Body-faint copy fails AA Normal; §12 #8" },
  { themeId: 'zen',     fg: 'textFaint',       bg: 'surfaceCard', reason: "Body-faint copy fails AA Normal; §12 #8" },
  { themeId: 'zen',     fg: 'textFaint',       bg: 'surface',     reason: "Body-faint copy fails AA Normal; §12 #8" },
  { themeId: 'cafe',    fg: 'textFaint',       bg: 'bg',          reason: "Body-faint copy fails AA Normal; §12 #8" },
  { themeId: 'cafe',    fg: 'textFaint',       bg: 'surfaceCard', reason: "Body-faint copy fails AA Normal; §12 #8" },
  { themeId: 'cafe',    fg: 'textFaint',       bg: 'surface',     reason: "Body-faint copy fails AA Normal; §12 #8" },
  { themeId: 'fantasy', fg: 'textFaint',       bg: 'bg',          reason: "Body-faint copy fails AA Normal; §12 #8" },
  { themeId: 'fantasy', fg: 'textFaint',       bg: 'surfaceCard', reason: "Body-faint copy fails AA Normal; §12 #8" },
  { themeId: 'fantasy', fg: 'textFaint',       bg: 'surface',     reason: "Body-faint copy fails AA Normal; §12 #8" },
  // Zen's graduated badge is mint label on mint badge (2.38:1) — the current
  // shipping app's pairing. Zen must stay visually identical to today, so it
  // cannot be changed here; grandfathered. Cafe (5.15) and Fantasy (9.39) pass.
  { themeId: 'zen',     fg: 'graduatedCircle', bg: 'graduatedBadge', reason: "Pre-existing low-contrast graduated badge in shipping app; Zen is frozen; §12 #8" },
];
```

  The test enumerates a fixed list of `(fg, bg)` token pairs actually used in the app — `text|textMuted|textFaint` on `bg|surfaceCard|surface`, `primaryText` on `primary`, `graduatedCircle` on `graduatedBadge`. `text`, `textMuted`, and `primaryText` pairs pass AA in all themes and stay enforced; any regression fails CI. A NEW theme is checked on ALL pairs (no waivers for its id), so it must meet AA on graduatedCircle/graduatedBadge and is pushed toward fixing textFaint. Catches static token pairs only — not gradients, overlays, or text-on-image.

- **Hot-reload smoke check** (manual, before merging each migration PR): switch theme to Cafe, edit any themed component, verify (a) the theme persists across Fast Refresh, (b) no missing-font warnings in Metro console, (c) the updated component renders with Cafe colors.

---

## 8. Migration PR plan

Each PR is independently reviewable, independently shippable, and leaves the app in a working state. App stays on Zen for end-users throughout — only after PR 6 does the Settings entry surface.

### Pre-PR-1 manual steps (both blocking)

1. **Upload fonts.** Upload Poppins (5 weights), New Rocker (1 weight), and IBM Plex Mono (5 weights) to a public Supabase storage bucket. Record the URIs and SHA256 content hashes in `themes/cafe.ts` and `themes/fantasy.ts`. Record `bytes` per asset via `stat` after upload, or via HEAD request on each URI. PR 1 cannot land without valid `{uri, hash, bytes}` triples.
2. **Render preview SVGs.** Produce `src/theme/themes/previews/{zen,cafe,fantasy}.svg` — text-to-path, ~5 KB each, showing "Aa" in display font + "Build daily." in body font over the theme's `bg`. Spec author renders if no designer is available. PR 1 cannot land without these — the picker cards reference them.

### PRs

| PR | Contents | LOC est. (diff) | Verifies |
|---|---|---|---|
| **1** | Infra: contract, registry, ThemeProvider, useTheme, useThemedStyles, fonts/loader, fonts/cache, three theme files (23 fields each), three preview SVGs (referenced; rendered in Pre-PR-1), contrast test with enumerated pairs + waivers, renderWithTheme helper, global jest setup wrap. Re-exports `colors`/etc. from `zen.ts`. **`<ThemeProvider>` wired in `_layout.tsx` at the root** — inline color references at lines 222, 282, 290 stay as-is (resolved via re-export shim). No edits to existing styled components. AppearanceScreen built but unlinked. `__DEV__`-gated Settings entry to it. Optional `__DEV__` "clear font cache" action in AppearanceScreen to enable PR 6 verification scenarios. | ~1200-1500 + tests | All existing tests pass. (1) `npm test` — snapshot suite no diffs. (2) Manual: open Today, Habit Detail, Settings on Zen — no visual change vs. prior commit. (3) Dev-navigate to AppearanceScreen, switch to Cafe — that screen itself themes; other surfaces stay Zen (expected). |
| **2** | Migrate `src/components/` (all atoms): buttons, cards, feedback, forms, layouts, navigation, sections, text, branding. ~30 files. | ~800-1200 | All tests pass. Manual: open every screen on Zen — no diff. Dev-toggle to Cafe — atoms reflect Cafe colors; screens still mostly Zen (expected). |
| **3** | Migrate `src/features/today/` + `src/features/habits/`. ~18 files. Highest-traffic surfaces, migrated together so the daily-driver flow is fully themable mid-rollout. | ~1000-1500 | All tests pass. Dev-toggle: Today and Habit Detail render fully under Cafe + Fantasy. |
| **4** | Migrate `src/features/onboarding/` + `src/features/reviews/` + `src/features/library/`. ~25 files. | ~1200-1800 | All tests pass. Dev-toggle: onboarding flow under each theme; weekly review under each theme. |
| **5** | Migrate remaining features: `auth/`, `entry/`, `graduation/`, `habit-context/`, `settings/` (existing screens). Plus `app/_layout.tsx`, `app/(app)/(tabs)/_layout.tsx`, `app/(onboarding)/_layout.tsx`. ~16 files. **Splits `RootLayout` into `<ThemedRoot>` that lifts inline color references at lines 222, 282, 290.** | ~700-1000 | All tests pass. Dev-toggle: complete app under each theme. No `import { colors }` from `@/theme/colors` (or siblings) outside test files and the re-export shims. |
| **6 (final)** | Real Settings entry to AppearanceScreen. Delete `__DEV__` dev entry (keep the optional clear-cache dev action behind `__DEV__` for ongoing debugging). Delete re-export shims in `src/theme/{colors,typography,spacing,radius,shadows,fontFamilies}.ts`. Update `KNOWN_CONTRAST_WAIVERS` if values changed during migration. | ~50 | End-user acceptance: (a) Pick Cafe → force-quit → relaunch → app starts on Cafe. (b) Pick Fantasy with cellular off → see offline modal. (c) Pick Fantasy with cellular on → see download modal → confirm → fonts download → theme applies. (d) Cold-start fallback: fresh install (or `__DEV__` clear cache) → seed `theme_id=fantasy` via dev tool → airplane mode → relaunch → see banner, see Zen, preference still `fantasy`. (e) Next launch with internet → Fantasy loads automatically. |

### Calendar

Roughly 6-10 weeks elapsed for a single developer working this part-time alongside other work. PR 1 is the heaviest (~2 weeks) — contrast test, all three theme files with their final hex values, font upload + URI recording, preview SVGs, all infra. Migration PRs 2-5 are 1-3 days each. Final PR is half a day.

### Rollback

Migration PRs depend on each other. Once PR N is merged (N > 1), recovery from a regression in N is a forward fix, not a `git revert`. **Only PR 6 is safely revertable in isolation**; reverting it makes themes invisible to users while leaving the system in code.

### EAS env vars

None needed for v1. Supabase storage URLs are hardcoded in theme files (themes are code-defined). Debug force-fallback-to-Zen affordance lives behind `__DEV__`, not an env var.

### Beta self-test before public ship

Owner tests all three themes on real iOS + Android device. Specifically verifies:
- Offline first-launch on Cafe (per §6 fallback path).
- Font download from cellular.
- Picker accessibility with VoiceOver and TalkBack.
- Force-quit + relaunch theme persistence.

---

## 9. Telemetry (full list)

| Event | Props |
|---|---|
| `settings_appearance_opened` | — |
| `theme_picker_card_pressed` | `theme_id`, `was_active` |
| `theme_picker_dismissed` | `had_card_press` |
| `theme_changed` | `from_theme_id`, `to_theme_id`, `required_download`, `was_retry`, `time_to_apply_ms` |
| `theme_font_download_cancelled` | `theme_id` |
| `theme_font_download_failed` | `theme_id`, `error_kind` ('network' \| 'storage' \| 'integrity' \| 'other') |
| `theme_font_load_failed` | `theme_id`, `error_kind` ('parse' \| 'register') |
| `theme_offline_download_blocked` | `theme_id` |
| `theme_offline_fallback_triggered` | `intended_theme_id` |
| `theme_unknown_id_recovered` | `bad_id` |

---

## 10. Non-goals (explicit)

1. No per-component theme overrides (`<HabitRow theme="fantasy" />` style).
2. No per-screen themes.
3. No partial theme mixing (Cafe colors + Zen typography).
4. No user-defined themes / theme builder.
5. No theme import from external URLs or files.
6. No theme sync across devices.
7. No OS dark mode integration.
8. No live-preview-before-apply.
9. No per-theme animation timings or motion adjustments.
10. No per-theme iconography (Lucide icons stay the same; only color changes).
11. No theme-aware generated images. If the app ever generates a habit-share image or streak screenshot, it uses Zen visuals regardless of active theme.

---

## 11. Accessibility (known limitations)

- **Body-faint contrast.** Every theme's `textFaint` fails WCAG AA Normal on `bg`, `surfaceCard`, AND `surface` (~2.3–3.1:1 across all three). Grandfathered in `KNOWN_CONTRAST_WAIVERS`. Tracked for v2.
- **Zen graduated badge.** Zen's `graduatedCircle` (#6b9e7d, mint) on `graduatedBadge` (#c6ebd5, mint) is 2.38:1 — fails AA. This is the current shipping app's pairing and is left unchanged (Zen is frozen to today's look); grandfathered. Cafe (5.15:1) and Fantasy (9.39:1) pass. Fixing Zen's graduated-badge contrast is a separate a11y task, not part of theming v1.
- **Dyslexia.** New Rocker (blackletter) and IBM Plex Mono (monospace) are both harder to read for dyslexic users. Fantasy is the worst of three on this dimension. No mitigation in v1.
- **CVD.** Fantasy's blue/gold heatmap can be confused under tritan-type color blindness (rare but real). Cafe's brown/tan ramp is safe for all CVD types. No mitigation in v1.

---

## 12. V2 followups (explicitly not in v1)

1. Per-theme spacing / typography scales (if Fantasy needs a true 8pt grid).
2. OS dark mode integration (each theme would need light + dark variants).
3. Theme sync across devices (Supabase column + conflict resolution).
4. Theme builder / user-defined themes.
5. Theme-aware share images.
6. Live preview before apply.
7. Bundle Cafe + Fantasy fonts (if telemetry shows >50% of users pick non-Zen).
8. Fix grandfathered `textFaint` contrast failures.

---

## 13. Open questions

None blocking. Worth a brief check before PR 1 lands:

- **AppearanceScreen route placement:** `/(app)/settings/appearance` follows current settings nesting. Confirm with whoever owns the navigation map.

(Preview SVG rendering was moved to §8 Pre-PR-1 manual steps — it's a blocker, not an open question.)
