# Additional themes — design spec

**Date:** 2026-06-04
**Status:** Approved — ready for implementation planning
**Scope:** Adds three themes (Play, Energy, Sound) to the runtime theme system shipped 2026-05-30.

---

## 1. Goal

Extend the theme catalog from three themes (Zen, Cafe, Fantasy) to six by adding Play, Energy, and Sound. Each new theme is a `Theme` object that plugs into the existing registry — no contract changes, no consumer changes, no schema migration.

The three new themes capture distinct moods sourced from established consumer-product design systems:

| ID | Name | Base | Inspiration | Identity |
|---|---|---|---|---|
| `play` | Play | **Dark** | PlayStation.com | Quiet-authority dark theme. PlayStation Blue primary, cyan gradient end, light-weight (Inter 300) display. |
| `energy` | Energy | Light | Bold/expressive style ref | Vibrant peach/orange. Limelight display, Work Sans body. |
| `sound` | Sound | **Dark** | Spotify | Achromatic dark theme. One Spotify-green accent; DM Sans throughout. |

After this work the registry holds six themes. Theme selection remains local-only via `local_user_preferences`. No OS dark-mode integration, no theme sync. Picking dark themes (Play, Sound) doesn't change anything about how non-themed surfaces (status bar, splash) render — that's existing infrastructure inherited from the v1 theme system.

---

## 2. Decisions (locked)

| Area | Decision |
|---|---|
| Contract changes | None. `Theme` shape is unchanged. `ThemeId` union expands from three IDs to six. |
| Slot mapping | All 23 color slots, 8 font slots, 5 shadow slots filled per theme. Sizes/spacing/radius scales are universal (already locked by v1). |
| Font loading | All three use `fontAssets.kind = "remote"` — Supabase fonts bucket, same loader path as Cafe/Fantasy. No bundling. |
| Display-weight inversion (Play) | `Inter_300Light` lives in the `displayBold` slot because PlayStation's quiet-authority voice is light-weight at hero sizes. Slot name "displayBold" describes role, not weight, and Fantasy already breaks the bold convention (NewRocker_400 is its only weight). |
| Dark-theme heatmap palette | Per-theme bespoke tuning: Play uses brand-blue done + muted gold skipped + near-bg missed; Sound uses Spotify-green done + dimmed warning amber skipped + near-bg missed. Off-day border tracks `surfaceHigh`. |
| Energy body text | Spec's `#EA580C` body fails AA (~3.5:1 on `#FFEDD5`). Replaced with `#7C2D12` burnt-orange (~8.5:1, passes AA Normal). Original `#EA580B` survives in `primary` where white-on-orange is its valid use. |
| Energy display font | Limelight is single-weight (400) with no italic. `displayBold` / `displaySemi` / `displaySemiItalic` all reference `Limelight_400Regular` — mirrors Fantasy's NewRocker pattern, no contract violation. |
| Sound `primaryText` | `#000000` (black on Spotify Green) — different from Play's white-on-blue. The contract permits either; this is correct per Spotify's identity. |
| Identity gaps left on the table | PlayStation's hover-scale-1.2× interaction (touch UI has no hover) and Spotify's uppercase + wide-letter-spacing buttons (no `letterSpacing` token in contract) cannot be captured. Energy's "thick borders" identity (no `borderWidth` token) also cannot. Deliberate omissions per Approach A — extending the contract for these would touch all ~90 themed components and risks regressing the just-shipped theme system. |
| Picker UX | Unchanged. `AppearanceScreen.tsx` (Settings) and `MakeItYoursScreen.tsx` (onboarding step 7) both iterate `Object.values(THEMES)`, so the three new theme cards render automatically in both pickers with their per-theme preview SVGs. |
| Sound `success` overlaps `primary` | Both are `#1ed760`. Toasts and validation marks in Sound are visually indistinguishable from primary actions — intentional per Spotify identity (green is both brand and success), but called out so consumers don't assume they're separate hues. |
| Preview SVGs | Generated via the existing opentype.js text-to-path pipeline (same as Zen/Cafe/Fantasy), committed as static strings in `previews/index.ts`. |

---

## 3. Theme definitions

### 3.1 Play

**Mood:** Console Black canvas with PlayStation Blue anchor and PlayStation Cyan accent. Light-weight (Inter 300) display creates "quiet-authority" hero headlines. The app's first dark theme.

**Colors (23 slots):**

| Slot | Value | Note |
|---|---|---|
| `bg` | `#0A0B10` | Near-black with a subtle PlayStation-blue tilt — kinder on OLED than pure `#000` |
| `surface` | `#14161C` | Section surfaces |
| `surfaceCard` | `#1A1D24` | Cards |
| `surfaceHigh` | `#232733` | Elevated panels |
| `surfaceMuted` | `#0F1117` | Dimmer secondary surface |
| `text` | `#FFFFFF` | Inverse White |
| `textMuted` | `#B8BCC8` | Cool muted gray |
| `textFaint` | `#6B7080` | Faint label (waived for AA Normal like Zen/Cafe/Fantasy) |
| `primary` | `#0070cc` | PlayStation Blue |
| `primaryGradientEnd` | `#1eaedb` | PlayStation Cyan |
| `primaryLight` | `#BFDBFE` | Pastel blue for check icons over dark |
| `primarySoft` | `#0F1A2E` | Dark blue-tinted pill bg |
| `primaryText` | `#FFFFFF` | White on the blue CTA |
| `success` | `#34D399` | Emerald (readable on dark) |
| `danger` | `#F87171` | Light red (readable on dark) |
| `dangerSoft` | `#2E1517` | Dark red-tinted bg |
| `dangerSubtle` | `#7C2D3D` | |
| `heatDone` | `#0070cc` | Brand-blue heatmap fill |
| `heatSkipped` | `#534D33` | Muted gold-on-dark |
| `heatMissed` | `#1A1D24` | Near-bg empty cell |
| `offDayBorder` | `#232733` | Tracks `surfaceHigh` |
| `graduatedCircle` | `#1eaedb` | Cyan graduated ring |
| `graduatedBadge` | `#0F2A4D` | Deep blue badge bg |

**Fonts (Inter, remote — `fonts/v1/inter/`):**

| Slot | Family |
|---|---|
| `displayBold` | `Inter_300Light` |
| `displaySemi` | `Inter_400Regular` |
| `displaySemiItalic` | `Inter_400Regular_Italic` |
| `body` | `Inter_400Regular` |
| `bodyMedium` | `Inter_500Medium` |
| `bodySemi` | `Inter_600SemiBold` |
| `bodyBold` | `Inter_700Bold` |
| `bodyExtraBold` | `Inter_800ExtraBold` |

Seven font files. `Inter_400Regular` is referenced by both `displaySemi` and `body` slots — that's fine; the bucket holds one copy and the loader resolves both slot names against the same file.

**Shadows:** Heavier opacity than light themes (light shadows are invisible on dark). `button` carries a PlayStation-blue bloom.

| Slot | Value |
|---|---|
| `card` | `0 8px 32px rgba(0, 0, 0, 0.5)` |
| `lift` | `0 2px 12px rgba(0, 0, 0, 0.4)` |
| `button` | `0 4px 20px rgba(2, 80, 204, 0.45)` |
| `cardFloat` | `0 4px 24px rgba(0, 0, 0, 0.5)` |
| `inputField` | `0 4px 16px rgba(0, 0, 0, 0.3)` |

### 3.2 Energy

**Mood:** Vibrant peach/orange canvas with white cards. Limelight Art Deco display headlines provide the personality; Work Sans body keeps everything legible.

**Colors:**

| Slot | Value | Note |
|---|---|---|
| `bg` | `#FFEDD5` | Spec's peach background |
| `surface` | `#FED7AA` | Lighter peach (steps up from bg) |
| `surfaceCard` | `#FFFFFF` | White cards on peach |
| `surfaceHigh` | `#FDBA74` | Spec's bright peach as elevated accent |
| `surfaceMuted` | `#FFE4C4` | |
| `text` | `#7C2D12` | Dark burnt-orange (~8.5:1 on bg — replaces spec's `#EA580C` which fails AA) |
| `textMuted` | `#9A3412` | |
| `textFaint` | `#C2410C` | (waived) |
| `primary` | `#EA580B` | Spec's primary — survives as CTA color (white-on-orange passes) |
| `primaryGradientEnd` | `#F59E0B` | Spec's secondary amber |
| `primaryLight` | `#FED7AA` | Pale peach for check icons over primary |
| `primarySoft` | `#FFE4C4` | Soft pill bg |
| `primaryText` | `#FFFFFF` | White on orange CTA |
| `success` | `#16A34A` | Spec's success |
| `danger` | `#DC2626` | Spec's danger |
| `dangerSoft` | `#FEE2E2` | |
| `dangerSubtle` | `#FCA5A5` | |
| `heatDone` | `#EA580B` | Orange heatmap |
| `heatSkipped` | `#FCD34D` | Sunny yellow skip marker |
| `heatMissed` | `#FFE4C4` | Muted peach empty cell |
| `offDayBorder` | `#FED7AA` | |
| `graduatedCircle` | `#9A3412` | Deep burnt-orange ring (originally `#F59E0B` amber but that paired at 1.76:1 on the badge, failing AA Normal — tightened to match `textMuted` for ~6.9:1) |
| `graduatedBadge` | `#FFE4C4` | |

**Fonts (Limelight + Work Sans, remote):**

| Slot | Family |
|---|---|
| `displayBold` | `Limelight_400Regular` |
| `displaySemi` | `Limelight_400Regular` |
| `displaySemiItalic` | `Limelight_400Regular` |
| `body` | `WorkSans_400Regular` |
| `bodyMedium` | `WorkSans_500Medium` |
| `bodySemi` | `WorkSans_600SemiBold` |
| `bodyBold` | `WorkSans_700Bold` |
| `bodyExtraBold` | `WorkSans_800ExtraBold` |

Six font files: 1 Limelight + 5 Work Sans. Buckets: `fonts/v1/limelight/`, `fonts/v1/work-sans/`.

**Shadows:** Orange-tinted, matching the per-theme convention.

| Slot | Value |
|---|---|
| `card` | `0 8px 32px rgba(234, 88, 11, 0.10)` |
| `lift` | `0 2px 12px rgba(234, 88, 11, 0.08)` |
| `button` | `0 4px 20px rgba(234, 88, 11, 0.25)` |
| `cardFloat` | `0 4px 24px rgba(234, 88, 11, 0.10)` |
| `inputField` | `0 4px 16px rgba(234, 88, 11, 0.08)` |

### 3.3 Sound

**Mood:** Spotify's achromatic dark theme — UI disappears behind content, Spotify Green is the lone functional accent, black-on-green CTA text.

**Colors:**

| Slot | Value | Note |
|---|---|---|
| `bg` | `#121212` | Spotify Near Black |
| `surface` | `#181818` | Dark Card |
| `surfaceCard` | `#181818` | |
| `surfaceHigh` | `#252525` | Elevated card |
| `surfaceMuted` | `#1f1f1f` | Interactive surface |
| `text` | `#FFFFFF` | |
| `textMuted` | `#b3b3b3` | Spotify Silver |
| `textFaint` | `#7c7c7c` | (waived) |
| `primary` | `#1ed760` | Spotify Green |
| `primaryGradientEnd` | `#1db954` | Slightly darker green variant |
| `primaryLight` | `#A7F3D0` | Pale mint for check icons |
| `primarySoft` | `#0F1F12` | Dark green-tinted pill bg |
| `primaryText` | `#000000` | **Black on green — Spotify signature, intentionally different from Play** |
| `success` | `#1ed760` | Same as primary (Spotify treats green as success) |
| `danger` | `#f3727f` | Spotify Negative Red |
| `dangerSoft` | `#2E1517` | |
| `dangerSubtle` | `#7C2D3D` | |
| `heatDone` | `#1ed760` | Green-filled cells |
| `heatSkipped` | `#8C5816` | Dimmed Spotify warning amber |
| `heatMissed` | `#181818` | Near-bg empty cell |
| `offDayBorder` | `#252525` | |
| `graduatedCircle` | `#1ed760` | |
| `graduatedBadge` | `#103821` | Deep green badge bg |

**Fonts (DM Sans, remote — `fonts/v1/dm-sans/`):**

| Slot | Family |
|---|---|
| `displayBold` | `DMSans_700Bold` |
| `displaySemi` | `DMSans_600SemiBold` |
| `displaySemiItalic` | `DMSans_600SemiBold_Italic` |
| `body` | `DMSans_400Regular` |
| `bodyMedium` | `DMSans_500Medium` |
| `bodySemi` | `DMSans_600SemiBold` |
| `bodyBold` | `DMSans_700Bold` |
| `bodyExtraBold` | `DMSans_800ExtraBold` |

Six font files: `400`, `500`, `600`, `600 Italic`, `700`, `800`. The `DMSans_600SemiBold` file is referenced by three slots (`displaySemi`, `bodySemi`, `displaySemiItalic` resolves via the italic variant); the loader serves one file per unique family name.

**Shadows:** Heavy, per Spotify's elevated-on-dark identity.

| Slot | Value |
|---|---|
| `card` | `0 8px 24px rgba(0, 0, 0, 0.5)` |
| `lift` | `0 8px 8px rgba(0, 0, 0, 0.3)` |
| `button` | `0 4px 12px rgba(0, 0, 0, 0.4)` |
| `cardFloat` | `0 8px 24px rgba(0, 0, 0, 0.5)` |
| `inputField` | `0 4px 16px rgba(0, 0, 0, 0.4)` |

---

## 4. Wiring

### 4.1 Code changes

| File | Change |
|---|---|
| `src/theme/contract.ts` | `ThemeId` union: add `"play" \| "energy" \| "sound"` |
| `src/theme/themes/play.ts` | New file — `play: Theme` |
| `src/theme/themes/energy.ts` | New file — `energy: Theme` |
| `src/theme/themes/sound.ts` | New file — `sound: Theme` |
| `src/theme/themes/previews/index.ts` | Add `playPreviewSvg`, `energyPreviewSvg`, `soundPreviewSvg` exports |
| `src/theme/registry.ts` | Import new themes, add to `THEMES` record, extend `isKnownThemeId` literal checks |
| `src/theme/__tests__/registry.test.ts` | Assert presence of `play`, `energy`, `sound` IDs |
| `src/theme/__tests__/contract.test.ts` | Update the hard-coded `ThemeId[]` literal and length assertion from 3 → 6 |
| `src/theme/__tests__/contrast.test.ts` | Add three `textFaint` waivers each for `play`, `energy`, `sound` (matches the universal pattern from Zen/Cafe/Fantasy). Energy's `graduatedCircle`/`graduatedBadge` pair is tightened to pass AA Normal — no waiver needed. |
| `src/theme/__tests__/ThemeProvider.test.tsx` | Widen the hard-coded `let captured: ((id: "zen" \| "cafe" \| "fantasy") => void)` literal to `ThemeId`. Still compiles today via function-parameter bivariance, but the literal disagrees with the contract once `ThemeId` expands. |
| `src/features/onboarding/screens/__tests__/MakeItYoursScreen.test.tsx` | Existing assertions for `theme-card-zen/cafe/fantasy` testIDs are non-exclusive and continue to pass. No new assertions added — the catalog-driven render is already covered by `AppearanceScreen` tests, and adding three more here would duplicate intent. Decision called out so reviewers don't expect it. |

### 4.2 No-touch zones

These are explicitly **not** modified, and we should reject any plan task that proposes to:

- `AppearanceScreen.tsx` — iterates `Object.values(THEMES)`, so new themes auto-render
- `MakeItYoursScreen.tsx` (onboarding step 7) — same catalog-driven render pattern
- `useThemePicker.ts` — agnostic to theme IDs
- The ~90 themed components — they consume contract tokens, which haven't changed shape
- `ThemeProvider.tsx`, `useTheme.ts`, `useThemedStyles.ts` — unchanged
- `fonts/loader.ts`, `fonts/cache.ts` — unchanged

### 4.3 Asset uploads (Supabase fonts bucket)

| Family | Bucket path | Files |
|---|---|---|
| Inter (Play) | `fonts/v1/inter/` | 300, 400, 400-italic, 500, 600, 700, 800 (7 files) |
| DM Sans (Sound) | `fonts/v1/dm-sans/` | 400, 500, 600, 600-italic, 700, 800 (6 files) — **`DMSans_600SemiBold_Italic` and `DMSans_800ExtraBold` are the highest-risk cuts**: older static DM Sans distributions only shipped 400/500/700 + italics. Implementation must verify these two cuts are available from the chosen source (Google Fonts v3 or the variable font subset) before relying on them. If unavailable, fall back to `500_Medium_Italic` and `700_Bold` respectively. |
| Limelight (Energy) | `fonts/v1/limelight/` | 400 (1 file) |
| Work Sans (Energy) | `fonts/v1/work-sans/` | 400, 500, 600, 700, 800 (5 files) |

**Total: 19 new font files.** Each `RemoteFontAsset` entry needs `uri`, SHA256 hex hash, and byte count — computed at upload time and pasted into the theme file. The implementation plan must include an "upload + measure" step that runs before the theme files become committable.

### 4.4 Preview SVG generation

Generated via opentype.js text-to-path (240×80 viewBox, theme name in display font + tagline), same approach used for Zen/Cafe/Fantasy. Output committed as static strings in `previews/index.ts`.

The original generation script was a one-off and is not currently checked in (only `scripts/generate_app_icon.py` lives in `scripts/`). The recipe lives in [docs/superpowers/plans/2026-05-29-themes-pr1-infra.md §0b](../plans/2026-05-29-themes-pr1-infra.md). **Implementation must commit a reusable preview-generation script** (suggested path: `scripts/generate_theme_previews.mjs`) so future themes don't reinvent the recipe. The script must carry the opentype.js NaN-float workaround called out in memory `state_theming.md` — render glyph-by-glyph, bypass the shaper for fonts with substitution tables, validate path coordinates for `NaN` before serializing.

---

## 5. Test plan

| Test | Behavior |
|---|---|
| `registry.test.ts` | Assert six theme IDs present, including `play`, `energy`, `sound`. |
| `contract.test.ts` | Existing shape assertions iterate `THEMES` automatically — new themes pass when files are well-formed. |
| `contrast.test.ts` | All required FG/BG pairs pass AA Normal (4.5:1) for each new theme. `textFaint` pairs are waived (universal pattern). Energy specifically: `text=#7C2D12` on `bg=#FFEDD5` ≈ 8.5:1 ✓ |
| `AppearanceScreen.test.tsx` | Existing render covers six cards instead of three; assertion updates required. |
| Manual device smoke | Activate each new theme on a physical device. Inspect: Today screen heatmap, GoalContainer, ConsistencyDonut, CalendarGrid, HabitCard, MiniHeatmapStrip, EditHabitScreen colors, theme card preview rendering. |

---

## 6. Risks and known limitations

1. **Two new dark themes mean dark-mode tuning is exercised twice in one shot.** If Play's dark execution looks wrong (heatmap reads off, card edges seem to bleed, etc.) Sound likely inherits the same issues since the surface stops are derived from the same dark-mode pattern. The implementation plan should consider shipping Play first as a canary, then validating Sound against device-tested Play behavior — but this is a plan-staging decision, not a design-doc decision.
2. **Font hashes/bytes are not knowable until upload.** Theme files have placeholder hash/byte values until the upload step completes. Plan must order steps so that upload + measure precedes theme-file commit.
3. **Identity gaps from contract limits.** PlayStation's hover-scale-1.2×, Spotify's uppercase+wide-tracking buttons, and Energy's thick borders are not capturable token-wise. Deliberately deferred — fixing them requires `letterSpacing` / `borderWidth` / interaction tokens that would touch ~90 components and is out of scope for this work.
4. **Status bar / splash on dark themes.** The v1 theme system doesn't theme the status bar or splash screen. On Play and Sound, the OS status bar (and any white splash flash on app launch) won't match the dark canvas. Out of scope here but worth flagging for follow-up.
5. **Bundle size impact: none.** All fonts are remote. App binary size unchanged.
6. **Mount-time cache fan-out doubles.** `useThemePicker.ts:41–63` runs `areAllFontsCached(t)` for every theme on mount and eagerly `loadFontsFor` any non-active that's already cached. With six themes the fan-out doubles vs the v1 three-theme baseline. A user who has activated all themes at least once would preload roughly 30 font files (vs ~11 today) on app start. Not a regression of the v1 design — just a linear scale-out worth noting. If startup latency suffers, the loop is the place to look.

---

## 7. Out of scope

- OS dark-mode auto-detection or auto-switching
- Theme sync across devices
- User-defined themes / theme editor
- Status bar and splash theming
- `letterSpacing`, `borderWidth`, or interaction-token contract extensions
- Updating Zen/Cafe/Fantasy to match any of the new themes' refinements
