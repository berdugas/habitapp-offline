# Sprint 9 — Manual Smoke Test Script

> Run on both **iOS Simulator** and **Android Emulator** before merging `sprint-9 → main`.
> All 15 items must be ✅ on both platforms before the merge PR opens.
>
> Reference: `design/habitapp/habit-screens.jsx` (visual oracle), `docs/design-direction.md` (spec).
> Automated audits (items 13–14) run on any machine, not device-specific.

---

## Setup

Before starting, have ready:
- **Account A** — a fresh account with no habits (for empty-state tests)
- **Account B** — an existing account with at least one Focus habit that has ≥2 logged days (for populated-state, streak, heatmap tests)
- The app built from the `sprint-9` branch

---

## TC-01 Cold Start

**What it checks:** Font loading, splash screen hold, no flash of unstyled content.

**Steps:**
1. Force-quit the app completely.
2. Cold-launch the app.
3. Observe the splash screen.
4. Observe the first screen that appears (Sign In or Today).

**Expected:**
- Splash holds for ~200–500ms on first launch (font download), then app appears.
- On subsequent launches (fonts cached), splash hold is near-instant.
- Screen headings (e.g., "Welcome back." on Sign In) render in **Plus Jakarta Sans** — slightly warmer and rounder than San Francisco/Roboto.
- No brief flash of system font before Plus Jakarta appears.
- Background is warm off-white (`#fbf9f5`), not stark white or terracotta.

**Result:** ☐ iOS ☐ Android

---

## TC-02 Sign Up Flow — 7 Onboarding Screens

**What it checks:** All 7 onboarding screens, visual treatment, Worst Day weight bump.

**Precondition:** Use Account A (fresh, no onboarding completed) or create a new account.

**Steps:**
1. Tap "Create an account" on Sign In.
2. Enter email + password and tap "Sign Up".
3. Walk through each onboarding screen in order: Welcome → Becoming → Daily Action → Shrink → Worst Day → Cue → Confirmation.
4. On each screen, check the visual against the reference.
5. Complete onboarding and land on Today.

**Expected per screen:**
- **Welcome:** "This is a tool for becoming." headline in Plus Jakarta 800 (`headlineLg`). ZenCard with large headline + body text. "Begin" PrimaryButton (sage gradient pill).
- **Becoming:** Same skeleton. Free-text `TextInput` has no border, `surface` background. Example lines are plain `bodyLg textMuted` text, not tappable chips.
- **Daily Action:** Same. Reflection line italic `textMuted`. Helper copy in `bodyMd textMuted`.
- **Shrink:** Same. Coaching paragraph `bodyMd textMuted`. Examples as plain text.
- **Worst Day:** ⚠️ **Deliberate weight bump** — the question "If today were your worst day..." renders in **Plus Jakarta 700** (`headlineMd`, 22px). Visually heavier than other screens. Yes/No pills below.
- **Cue:** Two inline fields ("After I" / "I will"). Each `TextInput` is borderless with `surface` bg.
- **Confirmation:** Summary rows use **Eyebrow + value** (uppercase micro-label above each value). Single "Start showing up." PrimaryButton. No SecondaryButton.

**Result:** ☐ iOS ☐ Android

---

## TC-03 Sign In Flow — Focus States and Error States

**What it checks:** Sign In screen visual, focus animation on TextField, danger color on error.

**Precondition:** Have Account B credentials ready.

**Steps:**
1. On the Sign In screen, observe the initial state.
2. Tap into the Email field.
3. Observe the focus animation.
4. Tap away (blur the field).
5. Enter an incorrect password and tap "Sign In".
6. Observe the error state.
7. Correct credentials and sign in successfully.

**Expected:**
- Headline "Welcome back." in Plus Jakarta 800 (`displayLg`, 36px).
- Form is inside a ZenCard (`surfaceCard` bg, rounded, shadow).
- **Focus state:** When you tap a TextField, the background transitions from `surface` to `surfaceCard` (white), a `primary` (sage) 1.5px border appears, and the label color shifts from `textMuted` to `primary`. The transition takes ~180ms (smooth, not instant).
- **Blur state:** Border and shadow disappear, background softens back to `surface`.
- **Error state:** `ErrorState` card appears above the fields with red text (`danger` color). The error card has a light pink/red background (`dangerSoft`).
- "Create an account" SecondaryButton visible below PrimaryButton (no border, lift shadow, surfaceCard bg).

**Result:** ☐ iOS ☐ Android

---

## TC-04 Today — Empty State

**What it checks:** Today empty state visual, CTA navigation.

**Precondition:** Signed in as Account A (no habits). If Account A has habits, delete them or use a fresh account.

**Steps:**
1. Land on Today tab.
2. Observe the empty state.
3. Tap "Create your first habit".
4. Verify navigation to Create Habit screen.

**Expected:**
- Date header at top in `bodyLg textMuted` — quiet, not a headline.
- A ZenCard containing: "No active habits yet" headline (Plus Jakarta, `headlineLg`) and body copy below it.
- Single "Create your first habit" PrimaryButton (sage gradient) inside the card.
- TabBar visible at the bottom with glassmorphism (blurred warm background on iOS; opaque warm bg fallback acceptable on Android).
- Tapping the button routes to Create Habit screen.

**Result:** ☐ iOS ☐ Android

---

## TC-05 Today — Populated State (S8-era layout, atoms reskinned)

**What it checks:** That the populated Today works and looks correctly "halfway reskinned" — atoms are sage but the FocusCard layout is S8-era.

**Precondition:** Signed in as Account B (has a Focus habit).

**Steps:**
1. Land on Today tab with at least one Focus habit.
2. Observe the Focus card.
3. Tap "Done" to log the habit.
4. Observe the button state change.

**Expected:**
- Focus card visible with habit identity phrase and formula.
- Done button: sage gradient PrimaryButton. Skip button: SecondaryButton (surfaceCard, lift shadow).
- Heatmap: 30-day grid visible. Cells use sage/warm-cream/deep-surface colors.
- Today's unlogged cell has a subtle sage inset ring (not a large outer border). Once logged, ring disappears.
- Identity streak (if Focus habit): italic Manrope, `textMuted` color. E.g. "You've been a reader for 3 days."
- ⚠️ **FocusCard container and miss banner are S8-era layout** — this is expected. The atoms inside are reskinned but the overall card layout did not change. Flag in test notes if it looks broken (not just inconsistent).

**Result:** ☐ iOS ☐ Android

---

## TC-06 Habit Detail

**What it checks:** All sections of Habit Detail match the Mindful Canvas.

**Precondition:** Account B with a Focus habit that has at least a few days of history.

**Steps:**
1. From Today, tap the habit name or navigate to Habit Detail.
2. Scroll through all sections.
3. Tap a logged heatmap cell to trigger RetroLogSelector.
4. Close the RetroLogSelector.

**Expected:**
- **Header:** Habit name in Plus Jakarta 800 `headlineLg`. Identity phrase as `bodySemi textMuted` above it.
- **Setup section:** ZenCard with uppercase Eyebrow "SETUP" label. Each row (Identity, Formula, Preferred time) uses RowLV — uppercase micro-label above a `bodyLg` value.
- **Heatmap section:** ZenCard. 90-day grid. Today's unlogged cell has the inset sage ring. Done = sage green, Skipped = warm cream, Missed = deep surface. No cell is darker than its neighbors without reason.
- **Today section:** ZenCard. Eyebrow "TODAY". Status text below.
- **Progress section:** ZenCard. Identity streak italic Manrope below the Eyebrow "PROGRESS". Skip count and consistency as RowLV rows.
- **Recent history section:** ZenCard. Each log entry as a RowLV row (date label + status value).
- **RetroLogSelector:** Opens as a modal. Retains S8-era styling (not reskinned in S9 — this is expected).

**Result:** ☐ iOS ☐ Android

---

## TC-07 Create Habit

**What it checks:** Create Habit form visual, TextField animations, ChoicePills, save flow.

**Steps:**
1. Navigate to Create Habit (from Today empty state or "+" action).
2. Observe the initial form state.
3. Tap into the "Habit name" field.
4. Observe focus animation.
5. Fill out all fields (name, identity, cue, tiny action).
6. Tap "Morning" on the time window ChoicePills.
7. Observe the selected pill.
8. Observe the Preview card update.
9. Tap "Save Habit".
10. Verify you land back on Today.

**Expected:**
- Form is inside a ZenCard (`surfaceCard` bg, `radius.md`, shadow).
- All TextFields start with no border, `surface` background.
- On focus: 1.5px sage border appears, bg shifts to `surfaceCard`, label shifts to sage — smooth 180ms.
- ChoicePills: unselected = `surface` bg, no border. Selected = sage gradient + lift shadow. Only one active at a time.
- Preview card: ZenCard with Eyebrow "PREVIEW" in sage (primary tone) above the formula text.
- "Save Habit" is PrimaryButton (sage gradient). After save, routes to Today or Habit Detail.

**Result:** ☐ iOS ☐ Android

---

## TC-08 Edit Habit — No AI Block

**What it checks:** Edit Habit visual + confirms AI rewrite block is completely absent.

**Precondition:** Account B with a habit.

**Steps:**
1. Open any habit's Edit screen (from Habit Detail → Edit, or from recovery flow).
2. Scroll the entire Edit screen from top to bottom.
3. Actively look for any "Generate rewrite" button, AI suggestion card, or AI rewrite output area.
4. Edit the "Tiny action" field.
5. Tap "Save changes".

**Expected:**
- Form looks identical to Create Habit (ZenCard, TextField focus animations, ChoicePills).
- Fields are prefilled with the existing habit values.
- **No "Generate rewrite" button anywhere on the screen.** Not hidden, not greyed out — not present.
- **No AI rewrite card or output area.** The screen should have: (optionally) a suggestion guidance card if navigated from recovery, then the form fields, then the Preview card, then "Save changes" PrimaryButton.
- Suggestion guidance card (if visible from recovery flow): ZenCard with Eyebrow "SUGGESTED ADJUSTMENT" and guidance text. No AI button inside it.
- After saving, routes back to Habit Detail.

**Result:** ☐ iOS ☐ Android

---

## TC-09 Settings

**What it checks:** Three ZenCards, trial status, About card, Sign Out.

**Precondition:** Signed in as any account.

**Steps:**
1. Navigate to Settings tab.
2. Observe all three cards.
3. Verify the trial status sub-line appears under the email.
4. Tap "Privacy Policy" (should do nothing or navigate to a placeholder).
5. Observe the archived habits section (empty state if no archived habits).
6. Tap "Sign Out".
7. Verify you are signed out.

**Expected:**
- **Account card:** ZenCard. Eyebrow "ACCOUNT". Email address in `bodyLg`. Trial status (e.g., "Trial") as `bodyMd textMuted italic` below the email.
- **Archived habits card:** ZenCard. Eyebrow "YOUR ARCHIVED HABITS". Helper copy in `bodyMd textMuted`. Either archived habit list (HabitCard items) or "No archived habits" empty state.
- **About card:** ZenCard. Eyebrow "ABOUT". Version row as RowLV (uppercase "VERSION" label + version number). Privacy Policy and Terms of Service as RowLV rows with "Coming soon" values.
- **Sign Out:** TertiaryButton at the bottom (text-only, sage color, no background, no border). Tapping it signs out and routes to Sign In.

**Result:** ☐ iOS ☐ Android

---

## TC-10 Recovery Modal — Glassmorphism

**What it checks:** Recovery modal visual treatment, glassmorphism, all three actions.

**Precondition:** Account B with a Focus habit that has a break (≥2 consecutive missed days before today, or manually simulate by adjusting dates in the DB).

> **How to force trigger (dev):** In the app's DB, insert missed logs for the past 2 days for a Focus habit and restart the app. Or use the dev-only break-simulation if one exists.

**Steps:**
1. Open Today with the habit in a break state.
2. Observe the Recovery Modal appearing.
3. Inspect the modal's visual treatment.
4. Tap "Restart as-is". Observe.
5. Re-trigger and tap "Make it smaller". Observe navigation.
6. Re-trigger and tap "Pause for now". Observe.
7. Re-trigger and tap "Just close". Observe.

**Expected:**
- Modal **slides up from the bottom** (~250ms ease-out).
- **Glassmorphism on iOS:** The tab bar and content behind the modal should be visible through a blurred warm-tinted overlay. The modal itself has `rgba(251,249,245,0.9)` background + blur.
- **Android fallback acceptable:** If BlurView performs poorly, the modal uses a solid `rgba(251,249,245,0.95)` background with no blur. This is acceptable.
- Modal header: habit name in uppercase Eyebrow (micro-label, textMuted).
- Body copy: "The habit lost some momentum..." in `bodyLg`.
- Three action cards stacked: ZenCard tiles with `bodySemi` label + `bodyMd textMuted` hint.
- "Just close" is a TertiaryButton (text-only, sage, no border).
- All four actions dismiss the modal and trigger the correct behavior.

**Result:** ☐ iOS ☐ Android

---

## TC-11 ReadOnlyBanner — Placement and Styling

**What it checks:** Banner appears on correct screens, absent from others, styling correct.

> **How to force read-only mode:** In the SQLite preferences table, set `lastValidatedAt` to a timestamp >7 days ago.  
> Dev steps: use the Appium DB access pattern (exec-out → modify → push) or add a dev toggle if one exists.  
> Alternatively: sign in with an account where the trial grace has expired.

**Steps:**
1. Force read-only mode.
2. Navigate to Today. Observe banner.
3. Navigate to Habit Detail. Observe banner.
4. Navigate to Create Habit. Observe banner.
5. Navigate to Edit Habit. Observe banner.
6. Navigate to Settings. Confirm NO banner.
7. Navigate to Sign Out → Sign In. Confirm NO banner on Sign In.
8. Navigate to any onboarding screen. Confirm NO banner.

**Expected:**
- Banner appears on: **Today, Habit Detail, Create Habit, Edit Habit.**
- Banner absent on: **Settings, Sign In, Sign Up, all Onboarding screens, Recovery Modal.**
- Banner styling: `surface` background (warm off-white, slightly deeper than `bg`), `radius.sm` (12px), no border, no shadow. Heading in `bodyLg bodyBold`. Body in `bodyMd textMuted`. "Reconnect" PrimaryButton (sage gradient, not full-width).
- ⚠️ OPEN #5: Note in test results if the banner treatment feels off — this is a known refinement candidate.

**Result:** ☐ iOS ☐ Android

---

## TC-12 S8 Regression — Core Features

**What it checks:** Nothing broken in S8 functionality by the S9 reskin.

**Steps:**
1. **Trial validation lifecycle:** Sign in with Account B. Verify Today loads normally (not read-only if trial is valid).
2. **Retro-log:** Open Habit Detail. Tap a cell within the last 48 hours. Verify RetroLogSelector opens and allows status change.
3. **Single-miss reframing banner:** If Account B has exactly one missed day yesterday (and no break), verify the inline banner "Yesterday was a miss. The science says it didn't matter. Keep going." appears in the FocusCard.
4. **Recovery flow:** (If completed TC-10) verify each recovery action actually worked: Restart resets streak, Make it smaller navigated to Edit, Pause archived the habit.
5. **Dev sign-in:** Verify dev-only sign-in (if applicable) still functions.
6. **Sign out:** Tap Sign Out in Settings. Verify you land on Sign In and cache is cleared (no stale data on next sign-in).

**Expected:**
- All S8 behaviors function identically to pre-S9. No functional regressions.

**Result:** ☐ iOS ☐ Android

---

## TC-13 Hex Code Audit (automated — run once, not per platform)

**What it checks:** No hex codes exist outside `src/theme/`.

**Steps:**
1. In the terminal at the project root:
   ```bash
   grep -rE "#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}\b" src/ app/ --include="*.ts" --include="*.tsx" | grep -v "src/theme/"
   ```
2. Observe the output.

**Expected:**
- **Zero output.** No hex codes anywhere in `src/` or `app/` outside `src/theme/`.
- If any hits appear, they are violations of (D2) and must be fixed before merge.

**Result:** ☐ Pass (zero hits)

---

## TC-14 Old Token Name Audit (automated — run once)

**What it checks:** The `accent` token name is fully gone, and the AI rewrite block is fully removed from screen JSX.

**Steps:**
1. Run:
   ```bash
   grep -rn "\baccent\b" src/ app/ --include="*.ts" --include="*.tsx"
   ```
2. Run:
   ```bash
   grep -rn "FEATURE_FLAGS.aiRewrite\|generateRewriteMutation\|handleGenerateRewrite" src/ app/ --include="*.ts" --include="*.tsx"
   ```
3. Observe output of each.

**Expected:**
- **`\baccent\b` grep:** Zero hits (or hits only in comments/strings that describe the old name descriptively — no `colors.accent` or `accent:` in token definitions).
- **AI audit:** Zero hits in any screen file. `featureFlags.ts` may still define `aiRewrite: false` — that is acceptable (the flag definition stays; no screen consumes it).

**Result:** ☐ Pass

---

## TC-15 Android Performance — TabBar Blur

**What it checks:** TabBar glassmorphism doesn't cause scroll stutter on Android.

**Platform:** Android only (emulator or mid-range device).

**Steps:**
1. On Android emulator/device, open Today with a populated habit list.
2. Slowly scroll the Today screen up and down several times.
3. Observe the TabBar at the bottom while scrolling.
4. Open Habit Detail and scroll through the 90-day heatmap.

**Expected:**
- **No stutter or frame drops** while scrolling with the TabBar visible.
- TabBar maintains its blur/tint appearance without flickering.
- If the app drops below 60fps consistently during scroll, the (D4) fallback (opaque tinted background, no blur) should be applied and documented in `app/(app)/(tabs)/_layout.tsx`.

> **If stutter is confirmed:** Add `Platform.OS === 'android'` check in the TabBar layout to use opaque `rgba(251, 249, 245, 0.95)` without BlurView. File as F8 in followups (already pre-filed).

**Result:** ☐ Android

---

## Summary Checklist

Paste into the `sprint-9 → main` PR description once all items are verified.

| TC | Description | iOS | Android |
|----|-------------|-----|---------|
| TC-01 | Cold start — font load, no FOUT | ☐ | ☐ |
| TC-02 | Sign Up + 7 onboarding screens | ☐ | ☐ |
| TC-03 | Sign In — focus animation, error state | ☐ | ☐ |
| TC-04 | Today empty state | ☐ | ☐ |
| TC-05 | Today populated (S8-era layout, atoms reskinned) | ☐ | ☐ |
| TC-06 | Habit Detail — all sections | ☐ | ☐ |
| TC-07 | Create Habit — form, ChoicePills, preview | ☐ | ☐ |
| TC-08 | Edit Habit — no AI block | ☐ | ☐ |
| TC-09 | Settings — three ZenCards, Sign Out | ☐ | ☐ |
| TC-10 | Recovery Modal — glassmorphism, all actions | ☐ | ☐ |
| TC-11 | ReadOnlyBanner — placement and styling | ☐ | ☐ |
| TC-12 | S8 regression suite | ☐ | ☐ |
| TC-13 | Hex code audit (automated) | ☐ | n/a |
| TC-14 | Token name + AI removal audit (automated) | ☐ | n/a |
| TC-15 | Android TabBar blur performance | n/a | ☐ |

---

## Beta Watch-Items (post-merge, not blocking)

These don't gate the merge. Note observations after the build reaches testers.

- **Plus Jakarta feeling out-of-place** — if testers say "trying too hard" or "too design-y," revisit the font choice.
- **Sage feeling cold or clinical** — if the brand color reads as invisible, bump saturation slightly.
- **Glassmorphism on RecoveryModal feeling distracting** — if testers say "hard to focus on," fall back to opaque tint.
- **Heatmap reading as chart-y** — if testers ask "what do the colors mean?", consider a first-time-only introductory aside (not a permanent legend).
