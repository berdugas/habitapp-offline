# Theme picker in onboarding — Design

**Date:** 2026-06-01
**Status:** Approved design, revised after code-grounded review, ready for implementation plan

## Problem

The app shipped with three themes (Zen, Cafe, Fantasy) but the only way to discover or pick one is to dig into Settings → Appearance after onboarding. Most users will never see it. The default Zen will silently stick forever for the majority, and the moment of "this app feels like mine" — which is what theming is for — never happens.

The onboarding flow already personalises the *habit* (name, icon, formula, schedule). It does not personalise the *app*. A theme-picker step closes that gap and gives the user something to look at that's visibly theirs before they tap "Let's go" on the confirmation screen.

Current Settings → Appearance lives at [`AppearanceScreen.tsx`](../../../src/features/settings/screens/AppearanceScreen.tsx) and handles the picker UI, font-download Alert, error banner, persistence via `setPreference("theme_id", id)`, and a font-preload effect that registers cached non-active theme fonts so each card label can render in its own typeface.

## Goals / Non-goals

**Goals**
- Surface theme selection during onboarding so users discover the feature.
- Make the confirmation screen render in the user's chosen theme — the visual payoff before "Let's go."
- Zero added latency or download for users who stick with Zen (the bundled default).
- Reassure users they can change theme later without making them hesitate.
- Share *all* picker behaviour (cards + orchestration + Alert + error banner + overlay) across onboarding and Settings so the two never drift.

**Non-goals**
- Adding new themes or changing existing themes.
- Changing `AppearanceScreen` visual layout beyond extracting reusable parts.
- Forcing a theme decision — Zen is pre-selected and a one-tap continue is the path of least resistance.
- Placing the picker before Personalize (e.g. right after Welcome). The user has to feel some commitment first; theming an app they haven't built anything in yet is hollow.
- Bundling Cafe/Fantasy fonts into the app to avoid the download. They're remote on purpose to keep app size down.

---

## Design

### Placement in the flow

Insert a new screen **between Personalize and Confirmation**:

```
... → schedule → personalize → make-it-yours (NEW) → confirmation
```

Personalize stays focused on the habit (name + icon + worst-day check). The new step is focused on the app. Confirmation then renders in whatever theme the user picked.

### The new screen — "Make it yours"

```
┌──────────────────────────────────────┐
│     [progress bar: now 7 of 7]       │  ← no back button (see Navigation)
│                                      │
│ Make it yours.                       │
│ Pick a look for your app.            │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ [preview] Zen      ● ● ●      ✓ │ │  ← default, selected
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ [preview] Cafe     ● ● ●         │ │
│ │           ~1.2 MB · first time   │ │  ← computed; hidden when cached
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ [preview] Fantasy  ● ● ●         │ │
│ │           ~1.4 MB · first time   │ │
│ └──────────────────────────────────┘ │
│                                      │
│ ⚙ You can change the theme anytime   │  ← reassurance microcopy
│   in Settings → Appearance.          │
│                                      │
│              [Continue →]            │
└──────────────────────────────────────┘
```

Key decisions:

- **Zen pre-selected.** The screen is fully usable as a one-tap skip — `Continue` is enabled the moment the screen mounts. No "Skip" button needed.
- **Picker behaviour shared via a hook + a component, not the card alone.** See "Shared picker extraction" below.
- **Inline download size on Cafe/Fantasy cards.** Computed value `formatBytes(sum of theme.fontAssets.assets[*].bytes)` — not a hardcoded string. Hidden when `cachedThemeIds.has(theme.id)` (or replaced with a quieter "Already downloaded" label, TBD in implementation). This caption is additive — the existing Alert still fires on tap (see Download UX).
- **Card labels.** Each card's label renders in that theme's own typeface *if its fonts are cached on disk*, otherwise in the active theme's font. This is the existing Settings behaviour at [`AppearanceScreen.tsx:331`](../../../src/features/settings/screens/AppearanceScreen.tsx#L331) — on a fresh install nothing is cached, so all three labels initially render in Zen. The shared extraction preserves this without claiming more.
- **Reminder microcopy.** Below the cards, same visual weight and pattern as the existing "You can rename or change the icon anytime" line at [`PersonalizeScreen.tsx:313`](../../../src/features/onboarding/screens/PersonalizeScreen.tsx#L313). Copy: *"You can change the theme anytime in Settings → Appearance."* with a small gear glyph for scannability.
- **Headline + body.** "Make it yours." / "Pick a look for your app." The reassurance now lives in dedicated microcopy, so body text stays short.

### Shared picker extraction

The card alone isn't enough. To honour the goal of "no drift between the two pickers" we extract both:

- **`useThemePicker()` hook** (`src/features/settings/hooks/useThemePicker.ts`): owns `cachedThemeIds` preload effect, `applyTheme` with abort controller, `isApplying` and `loadError` state, the `onCardPress` flow including the download-size Alert, `formatBytes`, and `classifyError`. Returns `{ active, cachedThemeIds, isApplying, loadError, onCardPress, retry }`. Pinned signatures: `onCardPress(target: Theme): Promise<void>` (matches the existing `onCardPress` callsite), `retry(): void` (no args — the in-flight `loadError.themeId` is the retry target, same as [`AppearanceScreen.tsx:251–253`](../../../src/features/settings/screens/AppearanceScreen.tsx#L251)).

  **What stays out of the hook.** `settings_appearance_opened` (at [`AppearanceScreen.tsx:57`](../../../src/features/settings/screens/AppearanceScreen.tsx#L57)) MUST remain at the `AppearanceScreen` level — moving it into the hook would have Make-it-yours fire it on mount and pollute the Settings-discovery funnel. The `[DEV] Clear font cache` button stays in `AppearanceScreen` for the same separation-of-concerns reason.
- **`<ThemeCard>` component** (`src/features/settings/components/ThemeCard.tsx`): the existing inline `ThemeCard` at [`AppearanceScreen.tsx:299`](../../../src/features/settings/screens/AppearanceScreen.tsx#L299), now exported. Gains a new prop `downloadSizeBytes?: number | null` so the caption can be shown on the onboarding picker (Settings keeps it off by passing `null`/omitting, preserving current Settings visuals).
- **`<ThemePickerOverlay>` and `<ThemeLoadErrorBanner>` components** (same folder): the small "Downloading fonts…" overlay (`AppearanceScreen.tsx:289–294`) and the error banner (`AppearanceScreen.tsx:243–258`). Pulled out so both screens render identical loading and error UI from the same source.

`AppearanceScreen` becomes a thin layout that composes these. `MakeItYoursScreen` composes the same pieces in onboarding chrome.

### Navigation wiring

- **From Personalize → Make-it-yours.** `PersonalizeScreen.handlePass` (the "Yes, I could" button at [`PersonalizeScreen.tsx:203`](../../../src/features/onboarding/screens/PersonalizeScreen.tsx#L203)) currently does `update({ step: "confirmation" })` and `router.push("/(onboarding)/confirmation")`. Change both to `make-it-yours`.
- **From Make-it-yours → Confirmation.** Continue button calls `update({ step: "confirmation" })` and `router.push("/(onboarding)/confirmation")`.
- **No back button on Make-it-yours.** Rationale: the theme picker is a one-tap-Continue screen with nothing destructive to recover from, *and* a back button would have to either (i) drop the user into `PersonalizeScreen`'s worst-day phase — which itself renders no back button at [`PersonalizeScreen.tsx:233–242`](../../../src/features/onboarding/screens/PersonalizeScreen.tsx#L233) — stranding them, or (ii) require non-trivial seeding logic in `PersonalizeScreen`. Skipping the back button avoids both. (`gestureEnabled: false` in [`_layout.tsx:34`](app/(onboarding)/_layout.tsx#L34) already prevents the swipe-back gesture.)

  **Suppression mechanism.** Omitting `onBack` is not enough: [`OnboardingHeader.tsx:19`](../../../src/components/navigation/OnboardingHeader.tsx#L19) unconditionally renders `<BackButton>`, and [`BackButton.tsx:35`](../../../src/components/navigation/BackButton.tsx#L35) defaults `onPress` to `() => router.back()` when the prop is undefined. To genuinely hide the button, **add a `showBack?: boolean = true` prop to `OnboardingHeader`**. When `false`, render an empty 40×40 `View` in the BackButton's slot so the progress bar stays in the same horizontal position as every other screen. Make-it-yours passes `showBack={false}`. All other screens are unchanged.
- **The worst-day fail path is unchanged.** If the user fails the worst-day check on Personalize, they still go to `shrink` and cycle back through cue → schedule → personalize. They'll only see Make-it-yours after a successful worst-day pass.

### Persistence and state

Theme selection uses the **same path as Settings → Appearance**:

1. Tap a theme card → `loadFontsFor(target, signal)` (no-op for Zen, downloads for Cafe/Fantasy).
2. On success: `setActiveTheme(target.id)` + `await setPreference("theme_id", target.id)`.
3. The `ThemeProvider` re-renders the rest of the app — including Confirmation — in the new theme.

**No new field on `OnboardingDraft`.** Theme is persisted to the preferences table the moment it's chosen, exactly like Settings does. This keeps it consistent and means an interrupted onboarding still preserves the user's theme choice.

**Zen-skip path writes nothing.** If the user taps Continue without ever picking a non-Zen card, `setPreference("theme_id", …)` is never called. This is safe because the cold-start resolver at [`app/_layout.tsx:289–292`](../../../app/_layout.tsx#L289) treats a missing `theme_id` preference as Zen with no telemetry. (Tests should assert the missing-pref → Zen path stays intact.)

**`OnboardingStep` union** in [`src/features/onboarding/types.ts`](../../../src/features/onboarding/types.ts) gains `"make-it-yours"`. **`STEP_TO_HREF`** in [`app/(onboarding)/index.tsx`](../../../app/(onboarding)/index.tsx) — typed as `Record<OnboardingStep, string>` — must add the corresponding entry; otherwise the type is non-exhaustive and the resumption redirect breaks for users whose persisted draft has `step: "make-it-yours"`.

### Download UX

Cafe and Fantasy require downloading ~1–2 MB of font assets the first time they're picked. We considered three approaches:

| | Approach | Trade-off |
|---|---|---|
| (i) | **Keep the existing Alert** (today's Settings flow) + add inline size disclosure on the card | Consistent with Settings, minimal new UI, user sees size both before and during tap |
| (ii) | Replace Alert with inline disclosure only — tap goes straight to download | Less friction but inconsistent with Settings; user could trigger a download by accident |
| (iii) | Defer download — let user finish onboarding on Zen, swap themes in once download completes in background | Complex (re-render after Confirmation), and the whole point of doing this in onboarding is to *show* the chosen theme on Confirmation |

**Chosen: (i).** Keep the Alert from Settings exactly as is via the shared `useThemePicker` hook. Add the inline size caption on the card so the cost is disclosed before the tap. This means the onboarding picker and Settings picker behave identically for downloads, the user gets two chances to back out, and the Confirmation payoff still works because the user has already downloaded before reaching it.

The current Alert wording at [`AppearanceScreen.tsx:142–151`](../../../src/features/settings/screens/AppearanceScreen.tsx#L142) is *"Apply X theme? This will download about Y of fonts. Connect to Wi-Fi if you're on cellular."* — implementation should sanity-check this reads naturally in the onboarding context. If it doesn't, branch the wording via an optional prop on the hook rather than forking the flow.

### Error handling

Reuse the existing error banner pattern from `AppearanceScreen` (now extracted into `<ThemeLoadErrorBanner>`):

- If `loadFontsFor` fails (network/storage/integrity), show the same error banner above the cards with a Retry button.
- The active theme stays as whatever was last successfully applied (Zen if the user hasn't switched yet).
- The Continue button stays enabled at all times. If a user picks Cafe, the download fails, they dismiss the banner, and tap Continue — they continue with Zen. No dead-end.

### Progress bar

[`OnboardingHeader`](../../../src/components/navigation/OnboardingHeader.tsx) currently defaults to `totalSteps=6`. Adding one step means **bumping the default to 7** and using `currentStep={7}` on Make-it-yours. Personalize stays at `currentStep={6}`. Every other onboarding screen that uses the default total will be visually consistent — they'll just show 6 of 7 filled instead of 6 of 6. Make-it-yours renders the progress bar without the BackButton (see Navigation).

### Analytics

- **`onboarding_step_viewed`** with `step: "make_it_yours"` — emitted **automatically** by [`OnboardingStepTracker`](../../../app/(onboarding)/_layout.tsx#L13) on pathname change. No additional view event needed; adding one would double-count.
- **`theme_changed`** — existing event from `applyTheme` (now in the shared hook) fires as-is when the user picks a non-Zen theme. Already tracks `from_theme_id`, `to_theme_id`, `required_download`, `was_retry`, `time_to_apply_ms`.
- **`theme_picker_card_pressed`** — existing event continues to fire.

A user who tapped Continue without picking shows up as `onboarding_step_viewed{step: make_it_yours}` followed by `onboarding_step_viewed{step: confirmation}` with no `theme_changed` in between. That absence is the "kept Zen" signal.

### Testing

There are **no existing `PersonalizeScreen` tests** and the existing `completion.test.ts` asserts finalization logic only — it does not exercise screen-to-screen navigation. So the migration burden on existing tests is minimal; the new tests below carry most of the coverage.

- **`MakeItYoursScreen.test.tsx`** (RNTL):
  - Renders three theme cards with Zen pre-selected.
  - Reminder microcopy is present.
  - Tapping a non-active card invokes the shared `useThemePicker` flow (mock `loadFontsFor` and `setPreference`).
  - Tapping Continue calls `update({ step: "confirmation" })` and pushes `/(onboarding)/confirmation`.
  - **No back-button is rendered.** Assert the absence of an element with `accessibilityLabel="Go back"` — not the absence of an `onBack` prop, since that would still leave the default-`router.back()` button visible (see `BackButton.tsx:33–35`).
- **Hook test `useThemePicker.test.tsx`**: covers the orchestration (Alert flow, abort on rapid retap, error classification, retry). Replaces what would have been duplicated logic between `AppearanceScreen.test.tsx` and `MakeItYoursScreen.test.tsx`.
- **`AppearanceScreen.test.tsx`** (existing, [`AppearanceScreen.test.tsx`](../../../src/features/settings/screens/__tests__/AppearanceScreen.test.tsx)): after refactor, this should still pass without behaviour changes. If it currently asserts internals of the inline `ThemeCard` / orchestration, it shifts to asserting the integration with the extracted hook/components.
- **`STEP_TO_HREF` exhaustiveness**: adding `"make-it-yours"` to `OnboardingStep` makes TypeScript flag the missing entry. The implementation adds it; no separate test needed beyond `tsc`.
- **Resumption test:** add a unit test that `STEP_TO_HREF["make-it-yours"]` resolves to the new route, and that a hydrated draft with `step: "make-it-yours"` redirects there via `<OnboardingIndex>`.
- **Confirmation renders in chosen theme**: light assertion via theme context — if `setActiveTheme("cafe")` was called during the previous step, the Confirmation card's `surfaceCard` color matches Cafe's palette.

---

## Files touched

**New:**
- `app/(onboarding)/make-it-yours.tsx` — route
- `src/features/onboarding/screens/MakeItYoursScreen.tsx` — screen component
- `src/features/settings/hooks/useThemePicker.ts` — extracted orchestration hook
- `src/features/settings/components/ThemeCard.tsx` — extracted card (with optional `downloadSizeBytes` prop)
- `src/features/settings/components/ThemePickerOverlay.tsx` — extracted loading overlay
- `src/features/settings/components/ThemeLoadErrorBanner.tsx` — extracted error banner
- `src/features/onboarding/screens/__tests__/MakeItYoursScreen.test.tsx`
- `src/features/settings/hooks/__tests__/useThemePicker.test.tsx`

**Modified:**
- `src/features/onboarding/types.ts` — add `"make-it-yours"` to `OnboardingStep`. `KNOWN_DRAFT_KEYS` unaffected (no new draft field).
- `src/features/onboarding/screens/PersonalizeScreen.tsx` — `handlePass` routes to `make-it-yours` instead of `confirmation` (one-line change to `step` and `router.push` path).
- `app/(onboarding)/index.tsx` — add `"make-it-yours": "/(onboarding)/make-it-yours"` to the `STEP_TO_HREF` record so the type stays exhaustive and resumption works.
- `src/features/settings/screens/AppearanceScreen.tsx` — replace inline `ThemeCard` declaration, `applyTheme` / `onCardPress` logic, overlay, and error banner with imports of the extracted pieces. Behaviour unchanged.
- `src/components/navigation/OnboardingHeader.tsx` — bump default `totalSteps` from 6 to 7; add `showBack?: boolean = true` prop, rendering a 40×40 spacer `View` in place of `<BackButton>` when `false`.

## Open questions

None blocking. The download UX decision (option i) is captured, the shared-extraction shape is specified, the back-button decision is locked. Two minor implementation-time judgements:

- Whether the size caption hides entirely when cached, or swaps to a quieter label like "Already downloaded".
- Whether the existing Alert wording ("Connect to Wi-Fi if you're on cellular") reads naturally in the onboarding context. Branch the hook by a small optional prop if not.
