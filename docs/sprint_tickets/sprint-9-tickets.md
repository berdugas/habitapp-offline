# Sprint 9 — Dev Team Tickets

> **Status:** Foundation tickets ready. Screen-reskin tickets ready for the surfaces that aren't blocked. Three OPEN product decisions still gate three surfaces (Today populated, Weekly Review, Backlog/RetroLog/Replace-or-backlog modals) — those screens are explicitly out of S9 and will land in later sprints when the OPEN decisions resolve.
> **Date:** May 1, 2026 (rev 3 — second dev review pass: heatmap inset-shadow correction, TabBar step + acceptance criterion, splash color clarification)
> **Owner:** Tech Lead → Dev Team
> **Companion documents:** `sprint-plan.md` (S9 definition, §5), `design-direction.md` (the visual language — locked), `design/habitapp/habit-screens.jsx` (visual oracle — when the design direction doc is silent or ambiguous, this file shows what the surface should look like). `core-v1-requirements.md` and `tech-handoff-core-v1.md` are reference-only for this sprint — no requirements or architectural changes.

S9 is the visual design implementation pass. The functional app exists today (S0–S8 closed); this sprint applies "The Mindful Canvas" visual language to existing surfaces. The largest cognitive shift is the brand rebrand from terracotta (`#bb6c3f`) to sage (`#446655`). Every reference to the old palette gets replaced; we do not branch the brand.

The risk in this sprint is concentrated in three places. First, **scope creep**: well-meaning engineers will see opportunities to "improve" existing screens during reskin. Resist. Reskin = visual change only. Behavior does not change. If a test breaks, the answer is almost always to update the snapshot, not to "fix" the screen. Second, **token discipline**: the moment a hex code appears outside `src/theme/`, the visual language is one re-skin away from drift. Search-and-destroy is part of every ticket. Third, **the deferred surfaces**: Today (populated state), Weekly Review, Backlog UI, retro-log affordance, replace-or-backlog modal — these are deliberately not in S9 because their underlying product decisions are open. Reskinning them speculatively will create rework. They land in their own sprints.

---

## 0. Shared context — read before picking up a ticket

### Branching for this sprint

> **⚠️ The very first action of S9 is cutting the sprint branch off `main`.** Do not start any ticket below until this is done.

Per `sprint-plan.md` §8.5, every sprint runs on its own integration branch. Before any ticket below starts:

```bash
git checkout main && git pull
git checkout -b sprint-9
git push -u origin sprint-9
```

Every ticket below branches off `sprint-9` and PRs back into `sprint-9`, **not** `main`. The `Branch suggestion` line on each ticket is the ticket branch:

```bash
git checkout sprint-9 && git pull
git checkout -b s9/foundation-tokens
# ... do the work ...
# Open PR: s9/foundation-tokens → sprint-9
```

When all nine tickets are merged into `sprint-9` and the Definition of S9 done is met, open one final PR: `sprint-9` → `main`.

### ⚠️ Execution order — read carefully

Ticket numbers (-01 through -09) reflect logical groups, **not** execution order. Atom dependencies require a non-numeric sequence. The correct order is:

```
S9-01 (tokens + rebrand)
   ↓
S9-02 (fonts)              ← can run parallel with S9-01 if dev capacity
   ↓
S9-04 (NEW atoms)          ← BEFORE S9-03 because RecoveryModal in S9-03 consumes TertiaryButton from S9-04
   ↓
S9-03 (re-skin existing atoms)
   ↓
S9-05 (Auth)               ← first screen ticket; lowest blast radius for catching foundation issues
   ↓
S9-06, S9-07 (parallel)    ← Onboarding and Settings can run in parallel after S9-05 proves the foundation
   ↓
S9-08 (Habit management)
   ↓
S9-09 (smoke + docs)
```

This is a hard ordering on the S9-04 → S9-03 step (S9-03 imports a component that S9-04 creates). Everything else has slack but the recommended order minimizes risk.

### What's already done

S0–S8 closed before S9 starts. By the time your S9 code runs:

- **The functional app works.** Auth, onboarding, Today (single-habit), Habit Detail, Create, Edit (with AI block currently rendered behind `FEATURE_FLAGS.aiRewrite=false`), Settings (with quiet trial sub-line + Archived + About sections), the Recovery modal, the ReadOnlyBanner, the heatmap, identity streaks, retro-log selector, single-miss reframing banner. All of it ships today, just in the existing terracotta visual language.
- **Theme tokens exist but in the OLD shape and OLD palette.** `src/theme/colors.ts` uses `accent: #bb6c3f` (terracotta) — S9-01 replaces this. `src/theme/typography.ts` has 6 sizes — S9-01 expands to 9. `src/theme/spacing.ts` and `src/theme/radius.ts` get extensions. `src/theme/shadows.ts` adds a third tier.
- **Component atoms mostly exist.** `src/components/buttons/{PrimaryButton,SecondaryButton}.tsx`, `src/components/forms/{TextField,ChoicePills,ToggleRow}.tsx`, `src/components/cards/HabitCard.tsx`, `src/components/feedback/{EmptyState,ErrorState,LoadingState}.tsx`, `src/components/{Heatmap,IdentityStreakDisplay,RecoveryModal,ReadOnlyBanner}.tsx`. S9-03 reskins these in place. S9-04 adds the missing atoms (TertiaryButton, ZenCard, Eyebrow, RowLV, MissBanner, NullableBooleanField).
- **The design canvas is the visual oracle.** `design/habitapp/habit-screens.jsx` shows every covered surface in The Mindful Canvas language. When `design-direction.md` is silent on a micro-detail, open `habit-screens.jsx` and match the rendered look. Note: the design canvas is web React with `<div>`/`<button>`/inline styles and `backdrop-filter` CSS — those don't translate directly to React Native. See (D5) below for the translation rules.
- **Test count baseline is 453 (post-S8).** Most existing tests should still pass after S9. Snapshot tests will need regeneration once tokens change — see (D6).
- **Reskin baseline is light-mode only.** The app currently has no dark-mode implementation, and per `design-direction.md` we ship light-only for beta. Dark mode is Phase D.

### What we are NOT touching in S9

- **Behavior.** No state machine changes, no API changes, no schema changes, no logic changes. Reskin only.
- **Today (populated state — multi-habit layout).** Blocked on OPEN decision: how do 1 Focus + up to 2 Supporting habits stack? Lands when the decision resolves, not in S9. Today (empty state) IS in S9 (S9-08) because it has a single canonical layout.
- **Weekly Review screen.** Blocked on OPEN decision: ship in beta or defer to Phase C? Lands when the decision resolves.
- **Backlog UI, retro-log affordance visual, replace-or-backlog modal.** All blocked on OPEN decisions. Note: the *functionality* exists — `RetroLogSelector` ships today. We are not re-skinning it in S9 because its visual placement and weight aren't decided.
- **AI hint UI.** Per `design-direction.md`, AI hints are stripped from production. The Today Insight card and EditHabit AI rewrite block do not render in production. S9 verifies this is true; it does not redesign the surfaces.
- **Account deletion confirmation, data export UX, SRHI graduation ceremony, populated Library, reminder setup screen, splash screen polish, app icon.** None designed yet (or out of beta scope). Not in S9.
- **Animation polish beyond the motion principles in `design-direction.md`.** S9 implements the motion calls in the doc (focus state fades, button press dim, modal slide-up). It does not invent new animations.
- **Accessibility audit.** A11y improvements that come "for free" with the reskin (better contrast from new palette, larger touch targets if buttons grow) are welcome. Dedicated a11y work is a separate sprint.
- **Storybook / Component playground.** If you find yourself wanting a Storybook to view atoms, that's a Phase D infrastructure ticket; not S9.

### Architectural and product decisions for S9

These six decisions shape the work. (D1), (D2), and (D6) are the load-bearing ones. All are settled — pushback should go to the Tech Lead.

**(D1) The brand rebrand is final. Sage replaces terracotta everywhere.**

The existing `src/theme/colors.ts` defines `accent: #bb6c3f` (terracotta). The new brand is `primary: #446655` (sage). This is a clean replacement, not a parallel palette. Specifically:

- The token name `accent` is renamed to `primary` everywhere it appears. Not aliased, not deprecated — renamed.
- Every consumer that imports `colors.accent` gets updated to `colors.primary`. Search-and-destroy on `\baccent\b` in `src/` is part of S9-01.
- `success: #3f7d4d` (forest) is renamed to `success: #446655` (same as primary). Per `design-direction.md`: there is no separate success-green; success in this app *is* identity-aligned action.
- `border: #ded4c6` is removed entirely. The Mindful Canvas rejects borders — surfaces stack by warmth. Any consumer using `colors.border` either (a) removes the border, (b) replaces it with shadow elevation, or (c) replaces it with a tonal surface delta. The right answer is decided per-component during S9-03.
- All heatmap colors are renamed to drop the redundant `heatmap` prefix: `heatmapDone` → `heatDone`, `heatmapSkipped` → `heatSkipped`, `heatmapMissed` → `heatMissed`, and `heatmapTodayOutline` is dropped (the new design uses an inset border on the today cell, computed from `colors.primary`).
- Splash screen color updates from `#f8f4ec` (the old warm off-white) to `#fbf9f5` (the new `bg` token). The splash is **not** sage — a dark green splash would be jarring on cold launch. Sage is reserved for the app icon (out of S9 scope) and primary actions inside the app. App icon update is out of scope for S9 — the logo asset is still missing (OPEN #6 in `design-direction.md`). S9 is light surfaces only.

If anyone asks "should we keep terracotta as a secondary accent": no. The Mindful Canvas has one chromatic accent. Adding a second creates a palette; we do not have a palette beyond sage + heatmap.

**(D2) Tokens follow `design-direction.md` exactly. Hex codes live in `src/theme/` and nowhere else.**

The complete token enumeration:

```ts
// src/theme/colors.ts (S9-01 final shape)
export const colors = {
  bg: '#fbf9f5',
  surface: '#f5f2eb',
  surfaceCard: '#ffffff',
  surfaceHigh: '#ede9e0',
  surfaceMuted: '#f0ece3',
  text: '#31332f',
  textMuted: '#6b6e67',
  textFaint: '#9a9d96',
  primary: '#446655',
  primaryGradientEnd: '#5a8a6e',
  primaryLight: '#c6ebd5',
  primarySoft: '#e8f5ee',
  primaryText: '#ffffff',
  success: '#446655',  // === primary
  danger: '#9b3b3b',
  heatDone: '#446655',
  heatSkipped: '#e6d3a8',
  heatMissed: '#ede9e0',
};
```

Typography scale:

```ts
// src/theme/typography.ts (S9-01 final shape)
export const typography = {
  displayLg: 36,
  headlineLg: 28,
  headlineMd: 22,
  titleLg: 20,
  titleMd: 18,
  bodyLg: 16,
  bodyMd: 14,
  labelMd: 13,
  micro: 11,
};
```

Spacing extension:

```ts
// src/theme/spacing.ts (S9-01 final shape)
export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48,
};
```

Radius extension:

```ts
// src/theme/radius.ts (S9-01 final shape)
export const radius = {
  sm: 12, md: 24, lg: 32, xl: 48, pill: 999,
};
```

Shadows expansion:

```ts
// src/theme/shadows.ts (S9-01 final shape — see (D4) for native rendering)
export const shadows = {
  card: '0 8px 32px rgba(68, 102, 85, 0.08)',
  lift: '0 2px 12px rgba(68, 102, 85, 0.06)',
  button: '0 4px 20px rgba(68, 102, 85, 0.22)',
};
```

After S9-01 lands, **no hex code may appear outside `src/theme/`**. Tests should fail (or at least flag) if they do; if a test asserts a hex code directly, it asserts the wrong thing — the test should reference the token. Sub-task in S9-01: search `src/` for `#[0-9a-fA-F]{3,8}` regex and resolve every hit (either move to theme, or convert consumer to import from theme).

**(D3) Fonts load via `expo-font` with Google Fonts packages.**

Add as dependencies in S9-02:

```bash
npx expo install @expo-google-fonts/plus-jakarta-sans @expo-google-fonts/manrope expo-font
```

Load in `app/_layout.tsx`:

```tsx
import { useFonts, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
```

Block app render until fonts load (return `null` from `_layout` while `!fontsLoaded`). The hold is brief (one-time per app install for Google Fonts, then cached). Splash screen stays visible during the hold via Expo's `SplashScreen.preventAutoHideAsync()` — see Expo docs.

Font family names available after load:
- `PlusJakartaSans_700Bold`, `PlusJakartaSans_800ExtraBold` (display only)
- `Manrope_400Regular` through `Manrope_800ExtraBold`

Add a typography helper module at `src/theme/fontFamilies.ts`:

```ts
export const fontFamilies = {
  displayBold: 'PlusJakartaSans_800ExtraBold',
  displaySemi: 'PlusJakartaSans_700Bold',
  body: 'Manrope_400Regular',
  bodyMedium: 'Manrope_500Medium',
  bodySemi: 'Manrope_600SemiBold',
  bodyBold: 'Manrope_700Bold',
  bodyExtraBold: 'Manrope_800ExtraBold',
};
```

Consumers reference `fontFamilies.displayBold`, never the raw font name. This means future font swaps are one-file changes.

**(D4) Glassmorphism uses `expo-blur`'s `BlurView`. If Android performance is poor, fall back to opaque tinted surface — no blur — and document the fallback in the atom file.**

Surfaces using glassmorphism: `TabBar`, `RecoveryModal`. Both have a translucent tinted background with a backdrop blur in the design language. The design specifies `backdrop-filter: blur(20px)` over `rgba(251, 249, 245, 0.85)` background.

In React Native:

```tsx
import { BlurView } from 'expo-blur';

<BlurView intensity={80} tint="light" style={...}>
  <View style={{ backgroundColor: 'rgba(251, 249, 245, 0.85)' }}>...</View>
</BlurView>
```

`expo-blur` is iOS-cheap (GPU-native UIVisualEffectView) and Android-variable (some hardware/OS combos render the blur on the CPU). Test the TabBar on a mid-range Android device during S9-03 implementation. If it drops below 60fps when scrolling Today, fall back to:

```tsx
<View style={{ backgroundColor: 'rgba(251, 249, 245, 0.95)' }}>...</View>
```

Add a `// FALLBACK: no-blur on Android due to performance` comment if you take this path. Don't try to gate per-platform unless the Android case is genuinely unusable on iOS-quality devices. Better to ship one consistent (non-blurred) experience across platforms than to have iOS users see one app and Android users see another.

**(D5) Web React → React Native translation rules.**

The design canvas (`habit-screens.jsx`) is web React. When translating to RN:

- `<div>` → `<View>`. `<button>` → `<Pressable>`. `<input>` → `<TextInput>`. `<span>`/inline text → `<Text>` (RN requires text inside `<Text>` always, never a bare string in `<View>`).
- `onClick` → `onPress`. `onMouseEnter`/`onMouseLeave` → don't translate; use `Pressable`'s `pressed` state for press feedback instead.
- Inline CSS (`style={{ background: '...', padding: '24px' }}`) → RN style objects (`style={{ backgroundColor: ..., padding: 24 }}`). Note: RN's `padding` takes a number (px), not a string.
- CSS gradients (`background: 'linear-gradient(...)'`) → `expo-linear-gradient`'s `<LinearGradient>` component.
- CSS `backdrop-filter: blur(...)` → `expo-blur` `<BlurView>` (see D4).
- Inline `<svg>` → `react-native-svg`'s `<Svg>` and friends. Verify the package is installed in S9-04 when atoms first need icons.
- CSS `box-shadow: '0 8px 32px ...'` → React Native 0.78+ supports `boxShadow` natively as a string with the same syntax. We're on 0.81. Test: render a card with `boxShadow: shadows.card` and verify it appears on iOS and Android. If Android renders nothing, fall back to platform-specific `elevation: 4` for Android.
- `:hover` CSS → no equivalent. Mobile is touch-first.
- `transition: ... 180ms ease-out` → `Animated.timing` from `react-native-reanimated` or `react-native`'s built-in `Animated`. Check the project's existing animation patterns and match.

If something in the design canvas doesn't have a clean RN equivalent, ask in the ticket discussion before inventing.

**(D6) Reskin only. No behavior changes. No data model changes. No test refactors.**

This is the single most important framing point in S9. Every ticket below should be evaluable by this question: *did the visual change, and only the visual?* If the answer is no, the ticket has gone out of scope.

Specifically:

- A test asserting `expect(screen.getByText('Save')).toBeOnTheScreen()` should pass before and after reskin. If the button's color changes, the test still passes — color isn't asserted.
- A test asserting `expect(button).toHaveStyle({ backgroundColor: '#bb6c3f' })` is asserting a hex code, which violates (D2). Update the test to assert the token (`expect(button).toHaveStyle({ backgroundColor: colors.primary })`). This is allowed under "no test refactors" because we're aligning the test with the token system, not changing what's tested.
- Snapshot tests will fail when tokens change. Regenerate snapshots in the ticket that changes the underlying tokens (S9-01 for tokens, S9-03/04 for atoms). Review each diff carefully — only the relevant visual properties should differ. If a snapshot diff includes layout changes (positions, ordering), you've made a behavior change and it needs to be reverted or scoped to a separate ticket.
- A reskin that "while we're in there, fixes a small bug" is out of scope. File the bug as a followup in `sprint-9-followups.md`. Bug fixes are separate sprints.

The reason this matters: if we mix visual + behavioral changes in the same sprint, regression debugging becomes "is this broken because of the reskin or because of the behavior change?" That's the worst kind of debugging. Pure-visual sprints are fast to verify (does it look right?) and pure-behavioral sprints are fast to verify (do the tests pass?). Mixed sprints are slow at both.

**(D7) The app is officially named Habitapp — single coined word, capital H only.**

This was an open question through S0–S8 and is locked at S9 kickoff:

- **User-visible name everywhere:** `Habitapp` (capital H, rest lowercase, single word — not "Habit App," not "HabitApp," not "habitapp").
- **`app.json` `expo.name`:** `"Habitapp"` (currently `"Habit Builder"`).
- **`app.json` `expo.slug`:** **STAYS `habit-builder`.** Slugs are tied to the EAS project ID (`a6076041-eb28-4ded-affc-589659dc05f4`); changing the slug post-EAS-project-creation breaks build pipelines and OTA update channels. The slug is an internal identifier; it is invisible to users.
- **`app.json` `expo.scheme`:** changes from `"habits"` to `"habitapp"`. Deep link scheme is updated because we are pre-beta and no production links yet exist with the old scheme. After S9 closes, `habitapp://habit/123`-style URLs are the supported form.
- **iOS `bundleIdentifier` / Android `package`:** **STAY `com.berdugas.habits`.** Bundle IDs are reverse-domain identifiers, not user-facing. Changing them post-store-publish is impossible and there is no benefit pre-publish either.
- **`package.json` `name`:** changes from current value to `"habitapp"` for npm-tooling consistency.
- **Splash screen text and any in-app references** (Welcome screen copy, About card, etc.): use `Habitapp` if any text references the brand by name. Verify against `design/habitapp/habit-screens.jsx` — if the design canvas uses generic "habits" wording, leave it generic; do not retrofit the name where the canvas didn't put it.
- **Repo and working directory** (`habits_offline`): unchanged. These are project codename / tooling paths, not the public name.

The naming change is mechanical and lands in S9-01 (the foundation ticket) alongside the token rebrand, since both touch infrastructure-level files.

---

## DEV-S9-01 — Foundation: theme tokens + rebrand

**Estimate:** 1 day
**Depends on:** Sprint-9 branch cut from `main`.
**Branch suggestion:** `s9/foundation-tokens`

### Context

Replaces the existing terracotta theme tokens with the sage Mindful Canvas tokens per (D1) and (D2). This is the foundation ticket — every subsequent S9 ticket depends on it. Until -01 lands, no atom or screen ticket can start.

The work is high-volume but mechanical. The rebrand renames `accent` to `primary`, expands the typography scale, extends spacing and radius, expands shadows. Then every consumer in `src/` that referenced an old token name gets updated.

### Files to modify

- `src/theme/colors.ts` — replace contents with the (D2) shape (note the new `primaryGradientEnd: '#5a8a6e'` token).
- `src/theme/typography.ts` — replace with the 9-size scale.
- `src/theme/spacing.ts` — add `xxxl: 48`.
- `src/theme/radius.ts` — add `xl: 48`, change `sm: 10 → 12`, `md: 16 → 24`, `lg: 24 → 32`.
- `src/theme/shadows.ts` — add `lift` tier, retune `card` and `button` to sage tints.
- `app.json` — multiple changes per (D7): `expo.name: "Habit Builder" → "Habitapp"`; `expo.scheme: "habits" → "habitapp"`; `expo.splash.backgroundColor: "#f8f4ec" → "#fbf9f5"`; `expo.android.adaptiveIcon.backgroundColor: "#f8f4ec" → "#fbf9f5"`. **Do not change** `expo.slug` (`habit-builder`), `expo.ios.bundleIdentifier` or `expo.android.package` (`com.berdugas.habits`) — these are sticky identifiers per (D7).
- `package.json` — update `name` field to `"habitapp"` per (D7). Other fields untouched.
- Every file in `src/` that imports from `src/theme/` — update token references.
- Every test file that asserts hex codes directly — update to reference tokens.
- Every snapshot that captures color or typography — regenerate after changes.

### Files to create

- `src/theme/index.ts` — barrel re-export of `colors`, `typography`, `spacing`, `radius`, `shadows`. (If it already exists, verify it covers all five.)

### Step-by-step

1. **Create the new tokens.** Replace each theme file with the (D2) shapes. Run `npx tsc --noEmit` — expect a wave of errors as consumers reference renamed tokens. That's the to-do list.
2. **Walk the type errors.** For each `Property 'accent' does not exist` style error, change the consumer to `primary`. For `border` consumers, replace per the (D1) decision (remove border, use shadow, or use surface delta). Track decisions in a brief comment if non-obvious.
3. **Update `app.json` and `package.json`** per (D7). Open `app.json` and apply the four changes listed in Files to modify. Open `package.json` and update `name`. Verify by running the app on a simulator — the app name on the home screen should now show "Habitapp," deep links should resolve `habitapp://...`, and the splash background should render the new off-white. The bundle ID and slug should be unchanged — verify by running `npx expo prebuild --clean` does NOT prompt to recreate the EAS project (if it does, the slug change leaked through; revert).
4. **Search for hex codes.** Run a regex search across `src/` for `#[0-9a-fA-F]{3,8}`. Any hit outside `src/theme/` is a violation of (D2). Fix each one — either move the value to a theme token or convert the consumer to import from theme. If the value is a one-off (e.g., a transparent overlay), prefer adding it as a theme token over keeping it inline. Note: `app.json` is an exception — splash and adaptive-icon backgrounds live there because Expo's prebuild config requires inline values, not token references.
5. **Search for old token names in tests.** Tests asserting `expect(...).toHaveStyle({ color: '#bb6c3f' })` get updated to assert against the token. If a test asserts an old hex by intent (e.g., "this color must be exactly this hue"), reconsider — the test is fragile and probably shouldn't assert on hex at all.
6. **Regenerate snapshots.** Run `npm test -- -u` (or equivalent for jest config). Review each snapshot diff carefully. The diffs should be color hex changes, font sizes, spacing. If a diff shows positional or structural changes, you broke something — investigate before committing.
7. **Run a manual eyeball pass on iOS simulator.** Open the app post-rebrand. Most surfaces will look "almost right" because atoms haven't been reskinned yet (S9-03), but the basic colors should be sage instead of terracotta everywhere. The miss banner, the action buttons, the heatmap — all should look like they're using the new palette. The home-screen app name should read "Habitapp." If anything still looks terracotta or still says "Habit Builder," you missed a hex code or a config field.

### Acceptance criteria

- `npx tsc --noEmit` clean.
- `npm test` passes — all 453 existing tests, plus any updated assertions or regenerated snapshots.
- A regex search for `#[0-9a-fA-F]{3,8}` in `src/` returns zero hits outside `src/theme/`.
- A regex search for `\baccent\b` in `src/` (case-sensitive, word-boundary) returns zero hits — the old token name is fully gone.
- `app.json` has `expo.name: "Habitapp"`, `expo.scheme: "habitapp"`, `expo.splash.backgroundColor: "#fbf9f5"`, `expo.android.adaptiveIcon.backgroundColor: "#fbf9f5"`. Slug, bundle ID, and Android package are unchanged.
- `package.json` `name` field is `"habitapp"`.
- iOS simulator eyeball pass: app opens, home-screen app name reads "Habitapp," no terracotta colors visible anywhere. Surfaces still look "raw" because atoms aren't reskinned yet — that's expected.

### References

- `docs/design-direction.md` — Tokens section.
- `design/habitapp/habit-screens.jsx` — for the `C` palette object that informed the new tokens.
- (D1), (D2) above.

### Out of scope

- Atom updates. The PrimaryButton still has its old visual treatment after -01; that's S9-03's job.
- Screen reskins. Today, Onboarding, etc. still look like S8 after -01 (with sage colors).
- Adding new tokens beyond what (D2) enumerates. If you find yourself wanting a new token, defer to S9-03 or S9-04 where the consuming atom defines the need.
- Dark mode tokens. Light-only for beta per `design-direction.md`.

---

## DEV-S9-02 — Foundation: fonts via expo-font

**Estimate:** 0.5 day
**Depends on:** S9-01 merged into `sprint-9` (so `fontFamilies.ts` references valid theme structure).
**Branch suggestion:** `s9/foundation-fonts`

### Context

Loads Plus Jakarta Sans (display) and Manrope (body) per (D3). Establishes the `fontFamilies` helper that consumers reference. Until -02 lands, screens reskinned in -05 onward would default to system fonts, which would mask whether the visual language is actually correct.

### Files to modify

- `app/_layout.tsx` — add font loading, gate render on `fontsLoaded`.
- `package.json` — add `@expo-google-fonts/plus-jakarta-sans`, `@expo-google-fonts/manrope`, ensure `expo-font` is present.

### Files to create

- `src/theme/fontFamilies.ts` — the helper module from (D3).

### Step-by-step

1. **Install packages.**
   ```bash
   npx expo install @expo-google-fonts/plus-jakarta-sans @expo-google-fonts/manrope expo-font
   ```
2. **Create `src/theme/fontFamilies.ts`** with the contents from (D3).
3. **Wire `_layout.tsx`** to call `useFonts({...})`. Block render with `if (!fontsLoaded) return null;`. Add `SplashScreen.preventAutoHideAsync()` at module top, `SplashScreen.hideAsync()` in a `useEffect` once fonts load — this prevents a brief flash of unstyled-content during font load.
4. **Smoke check.** Cold-launch the app on iOS simulator. Splash should hold ~200-500ms longer than before, then app appears. Headers should now render in Plus Jakarta Sans (test by inspecting the Today screen's date header — it should look like Plus Jakarta, not San Francisco).
5. **Verify caching.** Force-quit and reopen. Splash hold should be near-instant on the second launch (fonts are cached after first download).

### Acceptance criteria

- Packages added to `package.json`.
- `app/_layout.tsx` blocks render until fonts load.
- `src/theme/fontFamilies.ts` exists and exports the helper from (D3).
- iOS simulator smoke: app launches normally, splash holds briefly, headers render in Plus Jakarta on first inspection.
- Android emulator smoke: same.
- `npx tsc --noEmit` clean. `npm test` passes (no test changes expected — fonts don't affect logic).

### References

- (D3) above.
- Expo's `expo-font` documentation: https://docs.expo.dev/versions/latest/sdk/font/.

### Out of scope

- Applying `fontFamilies` references throughout existing components. That's S9-03 (atoms) and onward (screens).
- Custom font weights beyond what's in the Google Fonts packages.

---

## DEV-S9-03 — Atoms part 1: re-skin existing atoms

**Estimate:** 2 days
**Depends on:** S9-01 and S9-02 merged into `sprint-9`.
**Branch suggestion:** `s9/atoms-existing`

### Context

Re-skins the eight existing component atoms to match The Mindful Canvas. These atoms exist today; this ticket changes their visual treatment in place. APIs (props, callbacks, semantic behavior) do not change.

The atoms in scope:

1. `PrimaryButton` — gradient pill, `SHADOW_BUTTON`, `PlusJakartaSans_700Bold` weight 700 with 0.01em letter-spacing. Implementation uses `expo-linear-gradient`'s `<LinearGradient>`. Pressed state dims to ~92% opacity.
2. `SecondaryButton` — tonal pill, `surfaceCard` background, `SHADOW_LIFT`, no border. `Manrope_600SemiBold`.
3. `TextField` — invisible-by-default. No border. `surface` background. On focus: background shifts to `surfaceCard`, 1.5px `primary` border, `SHADOW_LIFT`. Label color shifts to `primary` on focus. Placeholder uses `textFaint`. Animate the focus transition over ~180ms.
4. `ChoicePills` — pill segmented control. Selected = primary gradient + `SHADOW_LIFT`. Unselected = `surface` background. No border on either state. Tapping a selected pill deselects (allow blank state — verify existing behavior preserves this).
5. `Heatmap` — 30 or 90 day grid. Cell color: `heatDone` / `heatSkipped` / `heatMissed`. Today's unlogged cell: 2px inset `primary` border. No-log cells: opacity 0.6. No tooltips, no labels.
6. `IdentityStreakDisplay` — italic `Manrope_400Regular` at `bodyLg` size, `textMuted` color. Day-zero copy variant: *"Day one. Start showing up."* Otherwise: *"You've been a [identity] for [N] days."* Rendered ONLY for Focus habits (per `design-direction.md`); existing prop or context already enforces this — verify.
7. `RecoveryModal` — bottom sheet, `R.lg` (32) top corners, glassmorphism per (D4). Three action cards stacked: *Restart as-is*, *Make it smaller*, *Pause for now*. `TertiaryButton` *"Just close"* below. Voice copy is exact per `design-direction.md` Components section.
8. `ReadOnlyBanner` — tonal banner, `surface` background, `R.sm` (12), no shadow, no border. Heading: `bodyLg bodyBold` color `text`. Body: `bodyMd` color `textMuted`. CTA: `PrimaryButton` "Reconnect" (smaller than full-width — `padding: 12 24`). Non-dismissible (verify existing behavior).
9. **TabBar** (`app/(app)/(tabs)/_layout.tsx`) — glassmorphism floating nav per (D4). The TabBar is configured via Expo Router's `<Tabs>` component, either by customizing `screenOptions.tabBarStyle` for simple cases, or by providing a custom `tabBar={(props) => ...}` render prop for full glassmorphism control. Recommended: custom `tabBar` render with `<BlurView intensity={80} tint="light">` wrapping the three tab items (Today, Library, Settings). Active tab uses `colors.primary`; inactive uses `colors.textMuted`. **No badge dots, no notification indicators ever** — per `design-direction.md`. If Android performance suffers per (D4), fall back to opaque tinted background (`rgba(251, 249, 245, 0.95)`). Verify the routes (`today`, `library`, `settings`) still resolve correctly after the change — a botched render prop can break navigation.

### Files to modify

- `src/components/buttons/PrimaryButton.tsx`
- `src/components/buttons/SecondaryButton.tsx`
- `src/components/forms/TextField.tsx`
- `src/components/forms/ChoicePills.tsx`
- `src/components/Heatmap.tsx`
- `src/components/IdentityStreakDisplay.tsx`
- `src/components/RecoveryModal.tsx`
- `src/components/ReadOnlyBanner.tsx`
- `app/(app)/(tabs)/_layout.tsx` — the TabBar lives here, configured via Expo Router's `<Tabs>` component. See atom #9 above.
- `package.json` — add `expo-linear-gradient`, `expo-blur` if not already present.

### Step-by-step

1. **Verify package availability.**
   ```bash
   npx expo install expo-linear-gradient expo-blur
   ```
2. **PrimaryButton.** Replace the existing solid background with `<LinearGradient colors={[colors.primary, colors.primaryGradientEnd]} start={{x:0,y:0}} end={{x:1,y:1}}>`. Apply `boxShadow: shadows.button` on the wrapper. Update label `fontFamily` to `fontFamilies.bodyBold`. Verify pressed state dims correctly via `Pressable`'s `pressed` style.
3. **SecondaryButton.** Background `colors.surfaceCard`, `boxShadow: shadows.lift`, no border. Padding `18px 40px`, `radius: pill`. Label `fontFamilies.bodySemi`, color `colors.text`.
4. **TextField.** Two-state visual: rest (background `surface`, no border) and focused (background `surfaceCard`, border `1.5px primary`, `boxShadow: shadows.lift`). Use `Animated.timing` for the 180ms transition. Label above input shifts color from `textMuted` to `primary` on focus.
5. **ChoicePills.** Each pill is `<Pressable>`. Selected state: `<LinearGradient>` background. Unselected: `colors.surface` background. Padding `12px 24px`, `radius: pill`. Label color: white when selected, `text` when unselected.
6. **Heatmap.** Update cell color resolver to use new tokens. Today's unlogged cell gets a 2px **inset** ring — implement via `boxShadow: 'inset 0 0 0 2px ${colors.primary}'` (or the equivalent template-literal form), NOT `borderWidth: 2`. This matters: `borderWidth` adds 2px **outside** the layout box on RN, which makes the today cell visibly larger than its siblings; an inset shadow renders the ring within the cell's bounds and preserves grid alignment. Verify on iOS and Android. If the inset shadow doesn't render on Android (the new architecture should support it on RN 0.81, but verify), fall back to an absolutely-positioned 2px overlay View with `borderWidth: 2, borderColor: colors.primary` and the same width/height as the cell, NOT a wrapper that grows the cell. No-log cells use `opacity: 0.6`. Verify the existing 30/90-day prop still drives layout correctly.
7. **IdentityStreakDisplay.** Update copy to italic `Manrope_400Regular`, color `textMuted`, size `bodyLg`. Verify the Focus-only constraint is still enforced.
8. **RecoveryModal.** Glassmorphism wrapper using `<BlurView intensity={80} tint="light">`. Top corners `radius.lg`. Three action cards as `<Pressable>` with `surfaceCard` background, `radius.md`. Action card has eyebrow + title + hint structure. *"Just close"* below as `TertiaryButton` (note: `TertiaryButton` doesn't exist yet — gets added in S9-04, so this part of the modal is stubbed in this ticket and finalized when S9-04 lands; alternatively, S9-04 lands first and this ticket consumes it. See note on ordering at the end of this ticket).
9. **ReadOnlyBanner.** Replace existing styling per spec above. Verify the existing dismissibility behavior (none) is preserved. The CTA should be a small `PrimaryButton`, not a tertiary link — the action is the whole point of the banner.
10. **TabBar (`app/(app)/(tabs)/_layout.tsx`).** Replace the current `<Tabs>` configuration (which uses `colors.accent` for `tabBarActiveTintColor` plus default styling) with a glassmorphism floating bar. Two implementation paths:
    - **Simple path** (try first): set `screenOptions={{ tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.textMuted, tabBarStyle: { backgroundColor: 'rgba(251, 249, 245, 0.85)', borderTopWidth: 0, ... } }}`. Wrap the resulting tab bar in a `<BlurView>` if Expo Router exposes a way to do so via `tabBarBackground`. As of Expo Router 3+, `tabBarBackground` accepts a render function returning a JSX element — use it to mount `<BlurView intensity={80} tint="light" style={StyleSheet.absoluteFillObject} />`.
    - **Custom path** (if simple path doesn't yield the right look): provide a custom `tabBar={(props) => <CustomTabBar {...props} />}` render prop, with `CustomTabBar` defined inline or as a small component rendering a `<BlurView>` wrapper with three `<Pressable>` items (Today, Library, Settings).
    Active tab uses `colors.primary`; inactive uses `colors.textMuted`. **No badge dots, no notification indicators, ever** — per `design-direction.md`. After the change, verify the three routes (Today, Library, Settings) still resolve correctly — a botched `tabBar` render prop can break navigation. If Android performance suffers per (D4), fall back to opaque tinted background (`rgba(251, 249, 245, 0.95)`) with no blur.

### Note on -03/-04 ordering

`RecoveryModal` consumes `TertiaryButton`, which doesn't exist yet. Two options:

- **Option A**: Land S9-04 (new atoms) before S9-03 (re-skin existing). Then RecoveryModal can consume TertiaryButton directly. Cleaner sequence.
- **Option B**: In S9-03, stub `TertiaryButton` inline inside RecoveryModal (a `Pressable` wrapping a `Text` with primary color, no background, no border). Replace with the real import once S9-04 lands. Faster sequence, slightly more rework.

Recommended: **Option A**. The new atoms are smaller and faster than re-skinning the existing ones; landing them first means S9-03 doesn't need stubs. Confirm with the dev team during sprint kickoff.

### Acceptance criteria

- `npx tsc --noEmit` clean.
- `npm test` passes — existing tests assert behavior, not visual treatment, so they should still pass. Update any test that asserts old hex codes (per (D6)).
- iOS simulator: navigate to surfaces using each atom (Today for buttons + heatmap + IdentityStreakDisplay, Sign In for TextField + ChoicePills, force RecoveryModal trigger, force ReadOnlyBanner state, the TabBar visible at the bottom of every top-level screen). Each atom matches `design-direction.md` and `habit-screens.jsx` references. **TabBar specifically:** Today/Library/Settings tabs render with glassmorphism (or fallback per (D4)); active tab uses `colors.primary`, inactive uses `colors.textMuted`; tapping each tab navigates correctly; no badge dots anywhere.
- Heatmap today cell visual: the today-unlogged ring renders **inside** the cell (cell stays the same size as its siblings) — if it grew, you used `borderWidth` instead of `boxShadow: inset`.
- Android emulator: same. Pay attention to BlurView performance on RecoveryModal and TabBar — if Android stutters when the modal slides up or when scrolling on Today, fall back per (D4) and document in the file.
- No regressions: every callback, prop, and semantic behavior works exactly as before. TabBar navigation specifically: ensure no tab routes broke during the customization.

### References

- `docs/design-direction.md` — Components section, Surface-specific calls section.
- `design/habitapp/habit-screens.jsx` — atoms `PrimaryBtn`, `SecondaryBtn`, `TextField`, `ChoicePills`, `Heatmap`, etc.
- (D4), (D5), (D6) above.

### Out of scope

- New atoms. That's S9-04.
- Adjusting which surfaces consume which atoms. The screens already consume them; reskin is in-place.
- A11y improvements that change the API (e.g., adding `accessibilityLabel` props that didn't exist). Pure visual treatment only.

---

## DEV-S9-04 — Atoms part 2: new atoms

**Estimate:** 1.5 days
**Depends on:** S9-01 and S9-02 merged into `sprint-9`. Recommended to land BEFORE S9-03 — see ordering note in -03.
**Branch suggestion:** `s9/atoms-new`

### Context

Adds the six atoms that don't exist yet but are referenced by the design canvas and required by the screen reskins in S9-05 onward.

The atoms to create:

1. **TertiaryButton** — text-only, `primary` color, no background, no border. Used for low-pressure exits ("Skip today", "Just close", "Back to Today"). Pressed state dims label to ~70% opacity.
2. **ZenCard** — the workhorse container. `surfaceCard` background, `radius.md`, `shadows.card`, no border. Default padding `xl` (24). Optional prop `padding="xxl"` (32) for hero/onboarding cards. Children stacked with default `gap` of `xl` (24); optional prop `gap` to override.
3. **Eyebrow** — uppercase micro-label. `Manrope_700Bold` weight 700, letter-spacing 0.09em (RN takes a number not em — compute as `fontSize * 0.09 ≈ 1`px for `fontSize: 11`). Color `textMuted` by default, `primary` for emphasis (prop: `tone="default" | "primary"`).
4. **RowLV** — label + value pair. Eyebrow above a `bodyLg` value. Vertical gap `xs` between them. No divider. Used in setup info, habit detail rows, weekly review summaries.
5. **MissBanner** — `surface` background, `radius.sm`, no border, no shadow. Padding `lg` (16). Microcopy props: `headline` and `body`. Default copy per `design-direction.md`: *"Yesterday was a miss. The science says it didn't matter. Keep going."* Headline `bodyMedium`, body `bodyMd textMuted`. Tonally *under* a card — never appears outside one.
6. **NullableBooleanField** — same visual as ChoicePills, two options (Yes / No), with a meaningful "not answered yet" state. Props: `value: boolean | null`, `onChange: (v: boolean | null) => void`. Tap selected to deselect (matches ChoicePills behavior).

### Files to create

- `src/components/buttons/TertiaryButton.tsx`
- `src/components/cards/ZenCard.tsx`
- `src/components/text/Eyebrow.tsx`
- `src/components/cards/RowLV.tsx`
- `src/components/feedback/MissBanner.tsx`
- `src/components/forms/NullableBooleanField.tsx`
- One test file per atom under `src/components/__tests__/` (or wherever existing tests live — match the convention).

### Step-by-step (per atom — applies to each)

1. **Define props with TypeScript.** Use the existing convention in the project (probably `interface Props { ... }` exported alongside the component).
2. **Implement using new theme tokens.** All hex codes go through `colors`, all sizes through `typography`, all radii through `radius`, all shadows through `shadows`, all fonts through `fontFamilies`.
3. **Add a test file.** Minimum: a render test, a basic interaction test if relevant (TertiaryButton press, NullableBooleanField selection cycling). Match the existing test style.
4. **Verify in isolation.** Either via the existing test runner (`npm test`) or by temporarily importing into a known screen for visual verification. Don't merge based purely on tests passing — verify the atom renders correctly on a real surface.

### Acceptance criteria

- All six atoms exist with the props and behaviors above.
- `npx tsc --noEmit` clean.
- `npm test` passes — all existing tests plus the new atom tests (~6+ new tests, likely more if interaction is covered).
- Each atom matches `design-direction.md` and `habit-screens.jsx`.
- `MissBanner`'s copy default matches the doc exactly (it's load-bearing copy — the visual + voice together carry the no-shame message).

### References

- `docs/design-direction.md` — Components section.
- `design/habitapp/habit-screens.jsx` — atoms `Eyebrow`, `RowLV`, `MissBanner`, `NullableBooleanField`, `ZenCard` (look for these names in the file).
- (D2), (D5), (D6) above.

### Out of scope

- Wiring these atoms into existing screens. That's S9-05 onward.
- Storybook playground entries. Not in S9 scope.
- A11y attributes beyond what the atom needs to render correctly. Add `accessibilityRole` where it's obvious (e.g., `accessibilityRole="button"` on TertiaryButton); don't go beyond.

---

## DEV-S9-05 — Re-skin Auth (Sign In + Sign Up)

**Estimate:** 0.75 day
**Depends on:** S9-03 and S9-04 merged into `sprint-9`.
**Branch suggestion:** `s9/screens-auth`

### Context

The first screen-reskin ticket. Auth screens are deliberately picked first as the lowest-risk batch — short forms, simple state, easy to spot visual issues. If the foundation has problems, they'll show up here without dragging down the larger Onboarding ticket.

Both screens follow the same skeleton: hero headline (Plus Jakarta 800 `displayLg`), subhead one line `bodyLg textMuted`, ZenCard with TextFields stacked, PrimaryButton, SecondaryButton "I already have an account" (or equivalent on the inverse screen).

### Files to modify

- `app/(auth)/sign-in.tsx`
- `app/(auth)/sign-up.tsx`

Note: the project uses Expo Router with file-based routing. Auth screens live at `app/(auth)/sign-in.tsx` and `app/(auth)/sign-up.tsx` — these are the route files, not separate screen modules under `src/features/auth/`. The route file IS the screen.

### Step-by-step

1. **Survey the existing screen.** Open both files. Identify hardcoded styles vs. styles already consuming theme. The latter are already fine; the former need migration.
2. **Apply the screen skeleton.** Status bar / safe area, no header (auth screens have no nav back), scrollable content area padded `xl`, content stacked with `xl` gaps.
3. **Replace local atoms with shared atoms.** Any inline button → `<PrimaryButton>` / `<SecondaryButton>`. Any inline input → `<TextField>`. Wrap form content in `<ZenCard>` with `padding="xxl"` (these are hero-feeling screens — extra padding earns its place).
4. **Update copy.** Match the design canvas hero copy. *"Welcome back."* on Sign In, *"Become someone different."* on Sign Up (verify against `habit-screens.jsx`).
5. **Verify navigation flows.** Sign In → routes to Today (or appropriate post-auth destination). Sign Up → routes to Onboarding. These are already wired; you're not touching them.
6. **iOS + Android smoke.** Open both screens, type into fields, submit. Verify the visual matches the canvas, focus states animate, button gradients render, error states (failed sign-in) display the danger color correctly.

### Acceptance criteria

- Both screens visually match `habit-screens.jsx`'s SignInScreen and SignUpScreen.
- All inline hex codes are gone (per (D2)).
- All inline atoms (raw `<TouchableOpacity>` for buttons, raw `<TextInput>` for fields) are gone — every visual primitive comes from `src/components/`.
- No behavior changes: existing tests pass, sign-in flow still works, sign-up flow still routes to Onboarding.
- `npx tsc --noEmit` clean.
- `npm test` passes.

### References

- `docs/design-direction.md` — Surface patterns, Components.
- `design/habitapp/habit-screens.jsx` — `SignInScreen`, `SignUpScreen`.
- (D5), (D6).

### Out of scope

- Forgot-password flow (handled by Supabase magic link, no custom screen).
- OAuth providers / SSO. Not in Core v1.
- Passwordless authentication UI. Not in Core v1.

---

## DEV-S9-06 — Re-skin Onboarding (7 screens)

**Estimate:** 1.5 days
**Depends on:** S9-05 merged into `sprint-9` (so we know the foundation works on real screens before doing the larger group).
**Branch suggestion:** `s9/screens-onboarding`

### Context

The seven onboarding screens (Welcome, Becoming, Daily Action, Shrink, Worst Day, Cue, Confirmation) share strong visual structure: large headline, supporting context line, ZenCard with the prompt's input atom, PrimaryButton at the bottom. Reskin is a group activity — patterns in one carry to the others.

The Worst Day screen has a deliberate weight bump per `design-direction.md`: the question *"If today were your worst day — sick, exhausted, stressed — could you still do this?"* uses `headlineMd` weight 700 inside the ZenCard, marking it as the most important onboarding question.

### Files to modify

- `app/(onboarding)/welcome.tsx`
- `app/(onboarding)/becoming.tsx`
- `app/(onboarding)/daily-action.tsx`
- `app/(onboarding)/shrink.tsx`
- `app/(onboarding)/worst-day.tsx`
- `app/(onboarding)/cue.tsx`
- `app/(onboarding)/confirmation.tsx`
- `app/(onboarding)/index.tsx` — onboarding entry point; verify it routes correctly after reskin (no logic changes).

Note: the project uses Expo Router with file-based routing. Onboarding screens are the route files themselves at `app/(onboarding)/*.tsx`. The naming is kebab-case, not PascalCase.

### Step-by-step

1. **Survey all seven screens together.** Identify the shared skeleton — they should all have headline + context line + card + primary action. Anything that diverges is either intentional (Worst Day's weight bump, Confirmation's summary) or a target for unification.
2. **Reskin Welcome first.** Use it as the template — the simplest screen with only a headline and a button. Get the screen skeleton, padding rhythm, Plus Jakarta headline rendering correctly.
3. **Replicate to Becoming, Daily Action, Shrink, Cue.** These four share an input pattern (TextField for free-text, ChoicePills for choice). Apply the same skeleton with the input swapped.
4. **Reskin Worst Day with the weight bump.** Keep the skeleton, but the question itself uses `headlineMd` weight 700 inside the ZenCard, with `xl` gap above the NullableBooleanField. The hint copy below stays small and quiet.
5. **Reskin Confirmation.** This screen summarizes prior answers. Use `RowLV` for each label + value pair. Single PrimaryButton "Begin" or equivalent. No SecondaryButton on this screen — it's a one-way commit.
6. **Examples-as-text, not autocomplete.** The design canvas treats example answers as plain `bodyLg textMuted` lines under the input, not as tappable suggestion chips. Verify your reskin doesn't accidentally introduce autocomplete affordances.
7. **iOS + Android smoke through the full onboarding flow.** Sign up a fresh test account. Walk through Welcome → Becoming → Daily Action → Shrink → Worst Day → Cue → Confirmation → Today. Verify visual and copy at each step.

### Acceptance criteria

- All seven screens visually match `habit-screens.jsx`.
- Worst Day screen has the deliberate weight bump on the question.
- Confirmation screen uses RowLV for the summary rows.
- All inline hex codes gone. All inline raw primitives replaced with shared atoms.
- The full onboarding flow works end-to-end without regressions.
- `npx tsc --noEmit` clean.
- `npm test` passes — onboarding tests pass without any logic change.

### References

- `docs/design-direction.md` — Surface-specific calls (Onboarding subsection), Components.
- `design/habitapp/habit-screens.jsx` — onboarding screens.
- (D6).

### Out of scope

- Changing what onboarding asks. Same questions, same flow logic.
- Adding new onboarding steps. The 7-screen flow is fixed.
- Skip-onboarding or shortened-onboarding paths.

---

## DEV-S9-07 — Re-skin Settings

**Estimate:** 0.75 day
**Depends on:** S9-04 merged into `sprint-9`.
**Branch suggestion:** `s9/screens-settings`

### Context

Settings is one screen with three card sections: Account, Archived habits, About. Plus the trial status sub-line under Account (from S8). Reskin only — no new sections, no removed sections.

The OPEN list says ReadOnlyBanner styling is being refined (OPEN #5 in the design direction doc). Per `design-direction.md`, Settings is NOT gated by ReadOnlyBanner — the banner doesn't appear on Settings even in read-only mode. So Settings reskin is independent of the banner refinement.

### Files to modify

- `app/(app)/(tabs)/settings.tsx`

Note: route file under Expo Router. The screen logic may import helpers from `src/features/settings/` — those imports stay; only the route file's render path changes.

### Step-by-step

1. **Survey the existing screen** — three cards (Account, Archived habits, About) plus Sign Out at the bottom.
2. **Apply screen skeleton.** Quiet header (Settings title), scrollable content padded `xl`, cards stacked with `xl` gaps, Sign Out as `TertiaryButton` (or `SecondaryButton` if destructive context — verify against canvas) below.
3. **Account card.** ZenCard. Email as `bodyLg`, status sub-line as `bodyMd textMuted` italic (matches IdentityStreakDisplay's voice — quiet, italic, secondary).
4. **Archived habits card.** ZenCard. Eyebrow "Your archived habits". Helper copy *"Pause and resume habits without losing their history."* in `bodyMd textMuted`. Empty state: *"No archived habits"* in `textFaint`. List of archived habits as RowLV items if any exist.
5. **About card.** ZenCard. RowLV for App version. Two TertiaryButton or list rows for "Privacy policy" and "Terms of service" (both currently route to "Coming soon" stub — preserve that behavior).
6. **Sign Out.** Follows the canvas treatment — verify whether it's a TertiaryButton at the bottom or a styled row. Match the canvas exactly.

### Acceptance criteria

- Settings visually matches `habit-screens.jsx`'s SettingsScreen.
- All three cards (Account, Archived, About) render correctly.
- Trial status sub-line shows the correct word per S8's logic (status word only, no countdown).
- Sign Out works.
- `npx tsc --noEmit` clean.
- `npm test` passes.

### References

- `docs/design-direction.md` — Surface patterns.
- `design/habitapp/habit-screens.jsx` — `SettingsScreen`.
- `docs/sprint_tickets/sprint-8-tickets.md` — S8 Settings spec (still authoritative for the *content* of each card).

### Out of scope

- Adding "Delete account" or "Export data" rows. S18 / S19 work.
- Adding reminder controls. S17 work.
- Adding a habit-management surface beyond the existing Archived list. S15 work.

---

## DEV-S9-08 — Re-skin Habit management (Detail, Create, Edit, Today empty)

**Estimate:** 2 days
**Depends on:** S9-04 merged into `sprint-9`.
**Branch suggestion:** `s9/screens-habit-management`

### Context

The largest screen-reskin ticket. Four screens grouped because they share atoms heavily (TextField, ChoicePills, ZenCard, PrimaryButton, RowLV). Habit Detail also consumes the Heatmap.

**Today (empty) state** is in this ticket because it has a single canonical layout — no multi-habit ambiguity. The populated state of Today is OUT of scope (OPEN #1).

**Edit Habit's AI rewrite block** must be removed per the locked AI decision in `design-direction.md`. Not styled-and-hidden — *removed from the JSX entirely*, gated behind `FEATURE_FLAGS.aiRewrite` (which is already `false` and stays `false`).

### Files to modify

- `app/(app)/habits/[habitId].tsx` — Habit Detail (dynamic route)
- `app/(app)/habits/create.tsx` — Create Habit
- `app/(app)/habits/[habitId]/edit.tsx` — Edit Habit (nested under habit context)
- `app/(app)/(tabs)/today.tsx` — Today screen (only the empty-state path is in scope; populated state is OUT — see Context above)
- Any related sub-components specific to these screens (likely under `src/features/habits/components/` and `src/features/today/components/` — imports and component logic stay; only visual treatment changes).

Note: route files under Expo Router. The route file IS the screen. There may also be `app/(app)/habits/[habitId]/context.tsx` — if it's a layout/provider for the habit-detail route, it stays untouched (no visual surface).

### Step-by-step

1. **Habit Detail.** Screen skeleton with quiet header (habit name as `headlineLg` Plus Jakarta 800), scrollable content. Sections: Setup info (RowLV stack inside ZenCard), Heatmap (90-day inside ZenCard), Today action area (Done/Skip buttons), Progress (streak display + identity streak if Focus), Recent history (list with RowLV style entries). The (currently inert) suggestion card path in `HabitDetailScreen` from S8 is touched only to update its visual treatment — its inertness is preserved per S8.
2. **Create Habit.** Hero headline *"Build a new habit."* Single ZenCard with becoming + daily-action + cue inputs. PrimaryButton "Save" at the bottom. SecondaryButton "Cancel" or back action above.
3. **Edit Habit.** Same skeleton as Create, but with prefilled values. **Remove the AI rewrite block entirely** — the `<View>` containing the *"Generate rewrite"* button and the AI suggestion card. After removal, verify `FEATURE_FLAGS.aiRewrite` reference is also removed from the file (it's the gate on a now-deleted block; the gate itself goes too, since dead code shouldn't accumulate).
4. **Today (empty state).** Screen skeleton with date header at top (`bodyLg textMuted` quiet), then the empty state — *"No active habits yet."* headline in ZenCard, single PrimaryButton *"Create your first habit"*. TabBar at the bottom (will be reskinned in S9-03 if not already done).
5. **Verify the inertness boundaries.** The dead `latestReviewQueries` block in `useTodayHabits` stays untouched per S5/S8 followups. The dropped `weekly_reviews` query stays untouched. We are not migrating reviews in S9.
6. **iOS + Android smoke.** Walk through: Today (empty) → Create Habit → save → Today (populated — UNRESKINNED, expected) → Habit Detail → Edit Habit → save. At each step, verify visual matches canvas. The populated Today and the suggestion-card-on-detail are expected to look "halfway reskinned" (atoms updated, screen layout unchanged) because their OPEN decisions block the screen-level reskin.

### Acceptance criteria

- Habit Detail, Create, Edit, and Today (empty) match `habit-screens.jsx`.
- The AI rewrite block is fully removed from EditHabit (verified by grepping for `aiRewrite` in `src/features/habits/` — should return zero hits except possibly the feature-flag definition itself).
- Today's populated state remains as it is — explicitly NOT reskinned in this ticket (it'll look like its atoms are reskinned but the screen layout is S8-era — that's correct).
- All four screens have inline hex codes gone.
- `npx tsc --noEmit` clean.
- `npm test` passes — the inert Bug #2 dual-card test still passes (engine-level), the screen test for HabitDetail still passes.

### References

- `docs/design-direction.md` — Surface-specific calls (Focus card subsection — note: applies to Today *populated* which is out of scope, but informs Habit Detail), Components.
- `design/habitapp/habit-screens.jsx` — `HabitDetailScreen`, `CreateHabitScreen`, `EditHabitScreen`, `TodayEmptyScreen`.
- (D6).

### Out of scope

- Today populated state (OPEN #1).
- The retro-log selector visual treatment (OPEN #4) — `RetroLogSelector` keeps its current styling for now; tap-cell-on-heatmap still works the same way.
- Replace-or-backlog modal when creating a 4th habit (currently doesn't have a designed treatment — when the user hits the cap, the existing UX runs).
- Account deletion confirmation, data export — not in S9.

---

## DEV-S9-09 — Manual smoke, PROJECT_BRAIN update, S9 followups doc

**Estimate:** 0.5 day
**Depends on:** DEV-S9-01 through DEV-S9-08 all merged into `sprint-9`.
**Branch suggestion:** `s9/smoke-and-docs`

### Context

Closes the sprint. End-to-end visual smoke on a real simulator or device, PROJECT_BRAIN §11 update reflecting S9 closure, `sprint-9-followups.md` for the deferred items surfaced during S9. Also: a quick spot-check that the OPEN list in `design-direction.md` is accurate after S9 — some items may have been resolved inline; some may have surfaced new questions.

### Files to modify

- `docs/PROJECT_BRAIN.md` — update §11 with S9 closure note.
- `docs/design-direction.md` — update OPEN section if any items resolved during S9 implementation.

### Files to create

- `docs/sprint_tickets/sprint-9-followups.md`

### Manual smoke checklist

Run on a real simulator or device, both iOS and Android. Mark each item ✅ before merging `sprint-9` into `main`.

1. **Cold start.** App launches, splash holds briefly during font load, then app appears. Headers render in Plus Jakarta. No flash of unstyled content.
2. **Sign Up flow.** New account → onboarding 7 screens → Today. Each screen visually matches the canvas. Worst Day question has the deliberate weight bump.
3. **Sign In flow.** Existing account. Sign In screen visually matches canvas, focus states animate, error states use danger color.
4. **Today empty state.** Newly created account with no habits. Empty state matches canvas. *"Create your first habit"* button works.
5. **Today populated state (existing user).** Loads with one or more habits. **Layout is S8-era**, atoms are reskinned. This is expected — flag in followups if it looks broken (it shouldn't, just visually inconsistent — the Focus card layout doesn't have its full Mindful Canvas treatment).
6. **Habit Detail.** Open any habit. Setup, Heatmap, Today action, Progress, Recent history all match canvas. Heatmap renders 90 days. Today's unlogged cell has the inset border. Identity streak (if Focus) renders italic `textMuted`.
7. **Create Habit.** Form renders correctly, TextField focus animates, ChoicePills work, save routes back.
8. **Edit Habit.** Prefilled values, AI rewrite block GONE (verify by visual inspection — there should be no Generate button anywhere on this screen).
9. **Settings.** Three cards (Account, Archived, About). Trial sub-line shows. About card has version + Privacy/Terms placeholders. Sign Out works.
10. **Recovery modal.** Force trigger via streak break. Modal slides up with glassmorphism (or fallback if Android perf required it). Three actions + "Just close". Each action works.
11. **ReadOnlyBanner.** Force read-only mode (set cache `lastValidatedAt` to >7 days). Banner appears on Today, HabitDetail, Create, Edit. Does NOT appear on Settings, Onboarding, Recovery modal. Banner styling matches design-direction spec (note: refinement here is OPEN #5 — flag if current treatment feels off).
12. **No regressions.** All S8 functionality works: trial validation lifecycle, retro-log within 48h, single-miss reframing banner, recovery flow, dev-only sign-in, sign-out clears cache.
13. **Hex code audit.** Run `grep -rE "#[0-9a-fA-F]{3,8}" src/ --exclude-dir=theme` — should return zero results.
14. **Old token name audit.** Run `grep -rE "\baccent\b" src/` — should return zero results (or only matches that are unrelated text like comments referencing "accent color" descriptively).
15. **Android performance check.** Open Today on a mid-range Android device. Scroll. The TabBar (if it has BlurView) should not stutter. If it does, verify the (D4) fallback is in place.

### Beta watch-items (post-merge, not check-at-merge)

These don't gate the `sprint-9 → main` merge. They're observations to capture once the build reaches testers.

- **Plus Jakarta feeling out-of-place.** If testers describe the headline font as "trying too hard" or "too design-y," that's signal to revisit. The font is opinionated — we're betting on it being the right opinion.
- **Sage feeling cold or clinical.** Reverse failure mode. If testers describe the brand color as muted-to-the-point-of-invisible, we may need to bump saturation or brightness slightly. The current spec is calibrated for restraint; if it crosses into "where's the color" we adjust.
- **Glassmorphism on RecoveryModal feeling distracting.** If testers report the modal "feels weird" or "is hard to focus on," the blur may be drawing too much attention. Fallback to opaque tinted is one git-blame away.
- **Heatmap reading as chart-y rather than glance-y.** If testers ask "what does each color mean?" or expect a legend, the heatmap is being read analytically when we want it read at a glance. Possible response: add an introductory aside the first time the heatmap appears (not a permanent legend).

### PROJECT_BRAIN update

Update `docs/PROJECT_BRAIN.md` §11 with a closure note covering:

- S9 moved from "Up next" to "Done."
- Visual language is now **The Mindful Canvas** — sage-branded, warm-tonal, no borders, glassmorphism on TabBar + RecoveryModal, italic identity streaks, generous vertical rhythm. See `docs/design-direction.md` for the spec.
- Theme tokens overhauled: 17 colors (sage-based), 9 typography sizes, 7 spacing steps, 5 radii, 3 shadows. Full enumeration in `design-direction.md`.
- Fonts loaded via `expo-font`: Plus Jakarta Sans (display) + Manrope (body). Helper at `src/theme/fontFamilies.ts`.
- New atoms shipped: `TertiaryButton`, `ZenCard`, `Eyebrow`, `RowLV`, `MissBanner`, `NullableBooleanField`. Existing atoms re-skinned in place.
- AI rewrite UI removed from production builds (Today Insight card and EditHabit rewrite block both deleted from JSX, gates simplified).
- Reskin coverage: Auth (2), Onboarding (7), Settings (1), Habit Detail, Create, Edit, Today (empty). Reskin **deferred** for: Today (populated — OPEN: multi-habit layout), Weekly Review (OPEN: beta scope), Backlog UI, Retro-log affordance, Replace-or-backlog modal, Account deletion modal, Data export UX, SRHI ceremony, Populated Library, Reminder setup, Logo asset.
- "Up next" line points at S10 (beta build), gated on the OPEN-list resolutions where they affect beta surfaces (multi-habit Today is the load-bearing one).
- The dead `latestReviewQueries` block in `useTodayHabits` STILL stays untouched. The dropped `weekly_reviews` query STILL stays untouched. Bug #2 fix STILL inert. None of these were touched in S9 — visual-only sprint.

Add the new test-count line: 453 → ~470-480 (verify exact number after running suite — new atom tests add ~6-12 tests).

### sprint-9-followups.md

Create `docs/sprint_tickets/sprint-9-followups.md` with at minimum:

- **F1 — Today populated multi-habit reskin (P1, blocks beta).** When OPEN #1 resolves, reskin TodayScreen's populated path: Focus card with full identity-streak + heatmap treatment, Supporting habit cards (treatment TBD per the resolution). Sequence: this is the load-bearing surface for beta. Should be its own ticket in the next sprint that opens once the OPEN decision lands.
- **F2 — Weekly Review screen reskin (P1 or deferred to Phase C).** Depending on OPEN #2's resolution: either reskin in beta sprint, or defer entirely. If deferred, also remove the screen's nav entry point so it's not reachable.
- **F3 — Backlog UI design + implementation (P2, beta-deferred).** OPEN #3 needs to resolve before this can ticket. Backlog likely lives in Settings or as a Library sub-section.
- **F4 — Retro-log affordance visual treatment (P2, beta-deferred unless resolved).** OPEN #4 — where does the retro-log selector live and what's its visual weight?
- **F5 — Replace-or-backlog modal when creating 4th habit (P2, beta-relevant if 3-cap is tested).** No design treatment yet. Modal needs design + implementation.
- **F6 — ReadOnlyBanner styling refinement (P2).** OPEN #5 — current treatment is functional but may need the Mindful Canvas voice applied more carefully. Re-evaluate after manual smoke item 11.
- **F7 — Logo asset (P1, blocks app icon work in S22).** OPEN #6 — no asset in `design/habitapp/`. Need SVG primary + raster fallbacks. Splash + app icon both consume this.
- **F8 — Glassmorphism Android performance review (P3, beta-driven).** If smoke item 15 surfaced Android perf issues, verify the fallback path. If not surfaced now, watch in beta.
- **F9 — Animation polish opportunities (P3, beta-driven).** S9 implements minimum motion (focus state, button press, modal slide). If beta feedback indicates other surfaces need motion (e.g., heatmap cell update on Done, transition between Today and Habit Detail), evaluate then.
- **F10 — A11y audit (P2, post-beta).** Reskin established new contrast ratios, new font weights, new touch targets. A dedicated a11y pass should run as a separate sprint after beta opens.
- Anything surfaced during the manual smoke that isn't a blocker.

### Acceptance criteria

- All 15 manual smoke items checked ✅. Paste the checklist (or a brief confirmation per item) into the `sprint-9 → main` PR description.
- `docs/PROJECT_BRAIN.md` §11 reflects S9 closure with the visual language note above.
- `docs/design-direction.md` OPEN section is accurate post-S9.
- `docs/sprint_tickets/sprint-9-followups.md` exists with at least F1 through F10.

### References

- The eight S9 tickets above.
- `sprint-8-tickets.md` DEV-S8-07 (smoke-checklist pattern).
- `sprint-8-followups.md` (followups format pattern).

### Out of scope

- Anything that's a real bug found during smoke — those get fixed before merge, not pushed to followups.
- Architectural changes to docs other than PROJECT_BRAIN §11 and design-direction.md OPEN section.
- A first-pass on the deferred surfaces (Today populated, Weekly Review, etc.) — those are explicitly NOT in S9.

---

## Definition of S9 done

S9 is complete when **all nine tickets** are merged into the `sprint-9` branch AND:

1. `npx tsc --noEmit` is clean on the integration branch.
2. `npm test` passes on the integration branch (all new + existing suites; expect ~470-480 tests).
3. The 15-item manual smoke checklist in DEV-S9-09 has been run end-to-end on iOS and Android. All items ✅.
4. The visual language is consistently applied across all S9-scoped surfaces. A user opening the app can't tell which surface was reskinned by which ticket — they read as one coherent app.
5. The brand rebrand is complete: zero terracotta references in `src/`, zero hex codes outside `src/theme/`, `accent` token name fully removed.
6. AI rewrite UI is removed from production: zero rendering paths show the Today Insight card or EditHabit Generate-rewrite button. The feature flag exists but no JSX consumes it.
7. Plus Jakarta Sans + Manrope render correctly on iOS and Android. Cold-launch font load is brief and cached on subsequent launches.
8. New atoms (TertiaryButton, ZenCard, Eyebrow, RowLV, MissBanner, NullableBooleanField) exist with tests.
9. Existing atoms (PrimaryButton, SecondaryButton, TextField, ChoicePills, Heatmap, IdentityStreakDisplay, RecoveryModal, ReadOnlyBanner) are re-skinned in place. APIs unchanged.
10. The deferred surfaces are explicitly noted: Today (populated), Weekly Review, Backlog UI, retro-log visual, replace-or-backlog modal, ReadOnlyBanner refinement, logo, account deletion, data export, SRHI, populated Library, reminder setup. None of these are reskinned in S9; their tickets land in later sprints.
11. No behavior regressions: trial validation lifecycle, retro-log, single-miss reframing, recovery flow, sign-in/sign-up, sign-out — all work as they did at close of S8.
12. `docs/PROJECT_BRAIN.md` §11 reflects S9 closure.
13. `docs/sprint_tickets/sprint-9-followups.md` exists.

After S9 closes, the next gating events are the OPEN-list resolutions (especially OPEN #1 — multi-habit Today layout — which is load-bearing for the beta build). Once those resolve, S10 (beta build) can begin.

The `sprint-9` → `main` PR closes the sprint.

---

*End of S9 ticket package.*
