# Theme picker in onboarding — Design

**Date:** 2026-06-01
**Status:** Approved design, ready for implementation plan

## Problem

The app shipped with three themes (Zen, Cafe, Fantasy) but the only way to discover or pick one is to dig into Settings → Appearance after onboarding. Most users will never see it. The default Zen will silently stick forever for the majority, and the moment of "this app feels like mine" — which is what theming is for — never happens.

The onboarding flow already personalises the *habit* (name, icon, formula, schedule). It does not personalise the *app*. A theme-picker step closes that gap and gives the user something to look at that's visibly theirs before they tap "Let's go" on the confirmation screen.

Current Settings → Appearance lives at [`AppearanceScreen.tsx`](../../../src/features/settings/screens/AppearanceScreen.tsx) and handles the picker UI, font-download Alert, error banner, and persistence via `setPreference("theme_id", id)`.

## Goals / Non-goals

**Goals**
- Surface theme selection during onboarding so users discover the feature.
- Make the confirmation screen render in the user's chosen theme — the visual payoff before "Let's go."
- Zero added latency or download for users who stick with Zen (the bundled default).
- Reassure users they can change theme later without making them hesitate.
- Reuse the existing `AppearanceScreen` card UI so the picker stays consistent across the two places it appears.

**Non-goals**
- Adding new themes or changing existing themes.
- Changing `AppearanceScreen` behaviour or visuals.
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
│ ←  [progress bar: now 7 of 7]        │
│                                      │
│ Make it yours.                       │
│ Pick a look for your app.            │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ [preview] Zen      ● ● ●      ✓ │ │  ← default, selected
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ [preview] Cafe     ● ● ●         │ │
│ │           ~1.2 MB · first time   │ │  ← inline download disclosure
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
- **Theme cards reuse the existing component.** The `ThemeCard` component in [`AppearanceScreen.tsx:299`](../../../src/features/settings/screens/AppearanceScreen.tsx#L299) should be extracted into a shared component (e.g. `src/features/settings/components/ThemeCard.tsx`) and imported by both screens. Same swatches, same preview SVG, same active checkmark, same labels rendered in each theme's own typeface.
- **Inline download size on Cafe/Fantasy cards.** Small "~1.2 MB · first time" caption under the swatches so the cost is disclosed before the user taps. This is additive — the existing download confirmation Alert still fires on tap (see "Download UX" below).
- **Reminder microcopy.** Below the cards, same visual weight and pattern as the existing "You can rename or change the icon anytime" line at [`PersonalizeScreen.tsx:313`](../../../src/features/onboarding/screens/PersonalizeScreen.tsx#L313). Copy: *"You can change the theme anytime in Settings → Appearance."* with a small gear glyph for scannability.
- **Headline + body.** "Make it yours." / "Pick a look for your app." The reassurance now lives in dedicated microcopy, so body text stays short.

### Navigation wiring

- **From Personalize → Make-it-yours.** `PersonalizeScreen.handlePass` (the "Yes, I could" button at [`PersonalizeScreen.tsx:203`](../../../src/features/onboarding/screens/PersonalizeScreen.tsx#L203)) currently does `update({ step: "confirmation" })` and `router.push("/(onboarding)/confirmation")`. Change both to `make-it-yours`.
- **From Make-it-yours → Confirmation.** Continue button calls `update({ step: "confirmation" })` and `router.push("/(onboarding)/confirmation")`.
- **Back from Make-it-yours.** Returns to Personalize. Note: `PersonalizeScreen` keeps its `phase` ("personalize" vs "worstday") in local component state, so a remount currently resets the user to the name/icon phase. The implementation plan needs to either (a) seed the initial phase from `draft.worstDayPassed` so a back-navigated user resumes in the worst-day phase, or (b) skip back-navigation entirely from Make-it-yours (no back button), since the theme picker is a one-tap-Continue screen and the user has nothing destructive to recover from. Recommended: (a), because it's a small, general improvement to `PersonalizeScreen`.
- **The worst-day fail path is unchanged.** If the user fails the worst-day check on Personalize, they still go to `shrink` and cycle back through cue → schedule → personalize. They'll only see Make-it-yours after a successful worst-day pass.

### Persistence and state

Theme selection uses the **same path as Settings → Appearance**:

1. Tap a theme card → `loadFontsFor(target, signal)` (no-op for Zen, downloads for Cafe/Fantasy).
2. On success: `setActiveTheme(target.id)` + `await setPreference("theme_id", target.id)`.
3. The `ThemeProvider` re-renders the rest of the app — including Confirmation — in the new theme.

**No new field on `OnboardingDraft`.** Theme is persisted to the preferences table the moment it's chosen, exactly like Settings does. This keeps it consistent and means an interrupted onboarding still preserves the user's theme choice.

The only `OnboardingStep` change is adding `"make-it-yours"` to the union in [`src/features/onboarding/types.ts`](../../../src/features/onboarding/types.ts).

### Download UX

Cafe and Fantasy require downloading ~1.2–1.4 MB of font assets the first time they're picked. We considered three approaches:

| | Approach | Trade-off |
|---|---|---|
| (i) | **Keep the existing Alert** (today's Settings flow) + add inline size disclosure on the card | Consistent with Settings, minimal new UI, user sees size both before and during tap |
| (ii) | Replace Alert with inline disclosure only — tap goes straight to download | Less friction but inconsistent with Settings; user could trigger a download by accident |
| (iii) | Defer download — let user finish onboarding on Zen, swap themes in once download completes in background | Complex (re-render after Confirmation), and the whole point of doing this in onboarding is to *show* the chosen theme on Confirmation |

**Chosen: (i).** Keep the Alert from Settings exactly as is. Add the inline size caption on the card so the cost is disclosed before the tap. This means the onboarding picker and Settings picker behave identically for downloads, the user gets two chances to back out, and the Confirmation payoff still works because the user has already downloaded before reaching it.

### Error handling

Reuse the existing error banner pattern from `AppearanceScreen`:

- If `loadFontsFor` fails (network/storage/integrity), show the same error banner above the cards with a Retry button.
- The active theme stays as whatever was last successfully applied (Zen if the user hasn't switched yet).
- The Continue button stays enabled at all times. If a user picks Cafe, the download fails, they dismiss the banner, and tap Continue — they continue with Zen. No dead-end.

### Progress bar

[`OnboardingHeader`](../../../src/components/navigation/OnboardingHeader.tsx) currently defaults to `totalSteps=6`. Adding one step means **bumping the default to 7** and using `currentStep={7}` on Make-it-yours. Personalize stays at `currentStep={6}`. Every other onboarding screen that uses the default total will be visually consistent — they'll just show 6 of 7 filled instead of 6 of 6.

### Analytics

- `onboarding_make_it_yours_viewed` — new event, fires once when the screen mounts.
- `theme_changed` — existing event from `applyTheme` will fire as-is when the user picks a non-Zen theme. Already tracks `from_theme_id`, `to_theme_id`, `required_download`, `time_to_apply_ms`.
- `theme_picker_card_pressed` — existing event continues to fire.

No new event for "continued without changing" — absence of `theme_changed` between `make_it_yours_viewed` and `confirmation_viewed` is the signal that they kept Zen.

### Testing

- **Component test for `MakeItYoursScreen`** (RNTL):
  - Renders three theme cards with Zen pre-selected.
  - Microcopy reminder is present.
  - Tapping a non-active card calls into the same download path as Settings (mock `loadFontsFor`).
  - Tapping Continue calls `update({ step: "confirmation" })` and pushes.
- **Navigation flow test:**
  - From Personalize, passing the worst-day check pushes to `make-it-yours` (not directly to `confirmation`).
  - From Make-it-yours, Continue pushes to `confirmation`.
  - Back from Make-it-yours returns to Personalize.
- **`OnboardingStep` type test:** the resumption logic in [`OnboardingProvider`](../../../src/features/onboarding/OnboardingProvider.tsx) routes a draft with `step: "make-it-yours"` to the new screen.
- **Confirmation renders in chosen theme:** asserted via theme context — if `setActiveTheme("cafe")` was called during the previous step, the Confirmation card should pick up Cafe's `surfaceCard` color.

---

## Files touched

**New:**
- `app/(onboarding)/make-it-yours.tsx` — route
- `src/features/onboarding/screens/MakeItYoursScreen.tsx` — screen component
- `src/features/settings/components/ThemeCard.tsx` — extracted shared card component
- `src/features/onboarding/screens/__tests__/MakeItYoursScreen.test.tsx` — component tests

**Modified:**
- `src/features/onboarding/types.ts` — add `"make-it-yours"` to `OnboardingStep` and `KNOWN_DRAFT_KEYS` is unaffected (no new draft field)
- `src/features/onboarding/screens/PersonalizeScreen.tsx` — `handlePass` routes to `make-it-yours` instead of `confirmation`
- `src/features/settings/screens/AppearanceScreen.tsx` — import the extracted `ThemeCard` instead of declaring it inline
- `src/components/navigation/OnboardingHeader.tsx` — bump default `totalSteps` from 6 to 7
- Existing onboarding flow tests that assert navigation after worst-day pass

## Open questions

None blocking. The download UX decision (option i) is captured. The microcopy wording can be tuned in implementation review.
