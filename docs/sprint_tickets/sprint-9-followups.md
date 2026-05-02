# Sprint 9 — Followups

> Created: May 2, 2026 (S9 close)
> Owner: Tech Lead → Dev Team
> Format: same as sprint-8-followups.md

Items surfaced during S9 that are deferred. None of these are regressions — they are deliberate scope deferrals (OPEN decisions not yet resolved) or beta-feedback-driven improvements.

---

## F1 — Today populated multi-habit reskin (P1, blocks beta)

**What:** When OPEN #1 resolves (how do 1 Focus + up to 2 Supporting habits stack visually?), reskin `TodayScreen`'s populated path. The `FocusCard` component and inline `missBanner` / `actionsRow` styling still use S8-era layout. The atoms inside (PrimaryButton, SecondaryButton, Heatmap, IdentityStreakDisplay) are already S9-reskinned — only the card layout, miss banner (should use `MissBanner` atom), and Supporting habit treatment need work.

**Why deferred:** Multi-habit Today visual layout is OPEN #1 in `design-direction.md`. Reskinning speculatively would create rework when the decision lands.

**Scope when it lands:** Create a ticket in the S10 sprint (or the sprint that resolves OPEN #1) covering: `FocusCard` layout update, replace inline `missBanner` View with `<MissBanner>` atom, design Supporting habit card treatment, wire everything into `TodayScreen`.

---

## F2 — Weekly Review screen reskin (P1 or deferred to Phase C)

**What:** `WeeklyReviewScreen` (`src/features/reviews/screens/WeeklyReviewScreen.tsx`) is not reskinned. It still uses S8-era inline card styling, raw borders, no ZenCard/RowLV/Eyebrow. Reskin blocked by OPEN #2 (ship in beta? defer to Phase C?).

**Why deferred:** OPEN #2 in `design-direction.md`. If deferred entirely, also remove the screen's nav entry point so it is not reachable from Settings/Library.

**Scope when it lands:** Full reskin + decision on nav wiring. If deferred to Phase C, file a P3 removal-of-link ticket first.

---

## F3 — Backlog UI design + implementation (P2, beta-deferred)

**What:** Backlog (habit ideas held aside, distinct from Archived) has no design treatment. OPEN #3 in `design-direction.md`. Where does it live — Settings sub-section, Library tab, separate surface? What's the primary action?

**Why deferred:** OPEN #3 not resolved before S9.

**Scope when it lands:** Design decision → ticket → implementation. Likely touches Settings or Library tab.

---

## F4 — Retro-log affordance visual treatment (P2, beta-deferred)

**What:** `RetroLogSelector` (`src/features/habits/components/RetroLogSelector.tsx`) ships in S8 but has no Mindful Canvas visual treatment. OPEN #4: where does it live (Today screen second-tier action? Habit Detail? both?) and what's its visual weight?

**Why deferred:** OPEN #4 not resolved before S9.

**Scope when it lands:** Visual treatment decision → reskin `RetroLogSelector` and its entry points.

---

## F5 — Replace-or-backlog modal when creating 4th habit (P2, beta-relevant if 3-cap is tested)

**What:** When a user tries to create a 4th habit and hits the cap, the existing validation error surfaces. There's no designed modal or visual treatment for the "promote from backlog or add to backlog" flow. OPEN decision in the Backlog UI thread.

**Why deferred:** No design treatment yet. Depends on F3 resolution.

---

## F6 — ReadOnlyBanner styling refinement (P2)

**What:** `ReadOnlyBanner` was reskinned in S9-03 (`surface` bg, `radius.sm`, no border, `PrimaryButton` CTA). OPEN #5 in `design-direction.md` — the current treatment may need further Mindful Canvas voice refinement. Re-evaluate after manual smoke item 11.

**Why deferred:** OPEN #5. S9-03 applied a first-pass; final treatment pending product review.

**Scope when it lands:** Small visual tweak — likely just styling/copy iteration, no behavior change.

---

## F7 — Logo asset (P1, blocks app icon work in S22)

**What:** No production logo asset exists. The HTML design canvas references `uploads/logo-filled-v2.png` which is not present. Need SVG primary + raster fallbacks (multiple sizes for app icon). OPEN #6 in `design-direction.md`.

**Why deferred:** Asset not delivered before S9 close.

**Scope when it lands:** Asset delivery → `assets/icons/` integration → splash + app icon update in S22.

---

## F8 — Glassmorphism Android performance review (P3, beta-driven)

**What:** `RecoveryModal` and `TabBar` use `expo-blur` `BlurView`. iOS is GPU-native and cheap. Android performance varies by device. If smoke testing on a mid-range Android device shows stutter (Today scroll, modal slide), verify the (D4) fallback path (opaque tinted bg) is in place and document in the file.

**Why deferred:** Requires real device testing. Flag during S9-09 manual smoke item 15; track here if not resolved before merge.

**Scope when it lands:** If Android stutter confirmed, add `Platform.select` fallback in `RecoveryModal` and/or `TabBar` layout file.

---

## F9 — Animation polish opportunities (P3, beta-driven)

**What:** S9 implements minimum motion (TextField focus 180ms, button press opacity, RecoveryModal slide-up 250ms, tab switch instant). If beta feedback signals other surfaces need motion (heatmap cell update on Done, Today→HabitDetail transition), evaluate and implement.

**Why deferred:** Do not invent animations without beta signal. Motion that isn't needed is noise.

---

## F10 — Accessibility audit (P2, post-beta)

**What:** S9 establishes new contrast ratios (sage palette), new font weights, new touch targets. A dedicated a11y pass should run as a separate sprint after beta opens. Concerns: color contrast on `textFaint` at small sizes, touch target sizes on `TertiaryButton` (8px padding), `Eyebrow` labels need `accessibilityRole="text"` or similar.

**Why deferred:** Dedicated a11y work is its own sprint, not a reskin side-effect.

---

## F11 — Two pre-existing TodayScreen integration test failures (P3, housekeeping)

**What:** `src/features/today/__tests__/TodayScreen.integration.test.tsx` has 2 tests that fail consistently (heatmap round-trip after Done/Skip). "Today status mutation failed" logged. These predate S9 (confirmed present on main before S9 started). Not regressions.

**Why deferred:** Out of scope for a visual sprint. Investigation needed: likely a database initialization/teardown ordering issue in the test harness.

**Scope when it lands:** Diagnose root cause (`initDb`/`closeDb` timing in `beforeEach`/`afterEach`), fix test harness, verify the tests pass consistently in CI.
