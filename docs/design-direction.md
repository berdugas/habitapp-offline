# Design Direction — Habits Core v1

**Last updated:** 3 May 2026 (rev 3 — goal-based habit architecture; Today screen redesign locked; Focus/Supporting distinction dissolved)
**Status:** Living document. Most decisions locked; open items at the bottom.
**Source-of-truth pairing:** This document plus `design/habitapp/habit-screens.jsx` together define the visual language. When this doc is silent or ambiguous, the screens file is the visual oracle. When the screens diverge from this doc, this doc wins.
**Audience:** Engineers implementing visual surfaces, and the product lead reviewing those implementations.

---

## Why this document exists

The product strategy is unusually specific about what the app should *feel* like — calm, evidence-informed, adult, dignified, allergic to gamification. That's a strong negative space, but a weak positive specification of what the visuals actually *are*. Without this document, every engineer building a surface has to invent answers to the same micro-questions: what color is the streak number, is this a heading or a caption, does the heatmap use one accent or two? The point of this document is so they don't.

This is not a brand bible. It's the minimum opinionated spec needed for engineers to ship Core v1 visuals without coming back to ask product-lead questions.

---

## The design language: The Mindful Canvas

The visual language is named **The Mindful Canvas**. The name does work — every micro-decision can be checked against it. *Is this mindful? Is this canvas-like (layered paper, not chrome)?*

### Anchors

In adjectives: **calm, warm, quiet, dignified, evidence-informed, adult**.

What we reject, explicitly:

- **No gamification chrome.** No badges, points, levels, confetti, "+1 XP" toasts, achievement unlocks, level-up animations, or trophy iconography. Streaks exist but are expressed as identity, not as numbers-go-up.
- **No alarming semantics.** No red-for-bad / green-for-good signaling on routine state. A missed day is *absent*, not *failed*. Danger color exists only for genuine errors and destructive actions.
- **No productivity-app aesthetic.** No dense data tables, kanban affordances, GTD jargon, or efficiency metaphors.
- **No cool greys.** Every neutral is warm. Cool greys read clinical and sterile; we want lived-in.
- **No hard borders.** Surfaces stack by warmth and shadow, not by lines.
- **No exclamation marks in microcopy.** No emojis in interface chrome. (Emojis are acceptable inside user-entered content like habit names, but never in our UI.)
- **No urgency manufacturing.** No countdowns, no "you'll lose your streak" warnings, no FOMO patterns. The forgiving streak rule (1 isolated miss tolerated) lives in product logic; the visual language reinforces it by treating misses as quiet, not loud.

The product strategy says the wedge user is allergic to most habit-app aesthetics. The visual language is built for someone who has already tried Productive, Streaks, Habitica, and Way of Life and bounced off because they felt childish, gamified, or pressuring. We earn trust by visibly being the opposite.

---

## Tokens

### Color

The palette is built around a single chromatic accent (sage `#446655`) layered over warm off-whites. There are no accent colors — no secondary brand color, no chart palette beyond the heatmap, no different colors for different habit categories.

| Token | Hex | Use |
|---|---|---|
| `bg` | `#fbf9f5` | Main app canvas — the deepest visible surface |
| `surface` | `#f5f2eb` | Large content blocks within cards (text field backgrounds, archived habit chips) |
| `surfaceCard` | `#ffffff` | Floating cards — the primary content container |
| `surfaceHigh` | `#ede9e0` | Deeper tonal — disabled buttons, deeper recesses |
| `surfaceMuted` | `#f0ece3` | Muted sections — rarely used |
| `text` | `#31332f` | All primary reading text |
| `textMuted` | `#6b6e67` | Captions, secondary text, helper copy |
| `textFaint` | `#9a9d96` | Placeholders, dismiss buttons, deep deemphasis |
| `primary` | `#446655` | Signature actions, success state, identity-positive emphasis |
| `primaryGradientEnd` | `#5a8a6e` | End stop of the primary button gradient (start = `primary`) |
| `primaryLight` | `#c6ebd5` | Reserved — lighter sage for future surfaces (not currently consumed) |
| `primarySoft` | `#e8f5ee` | Accent backgrounds — Preview cards, AI rewrite cards (when re-enabled) |
| `primaryText` | `#ffffff` | Text on primary backgrounds |
| `success` | `#446655` | Same as primary — there is no separate success green |
| `danger` | `#9b3b3b` | Validation errors, destructive action emphasis |
| `heatDone` | `#446655` | Heatmap: completed days |
| `heatSkipped` | `#e6d3a8` | Heatmap: explicitly skipped days |
| `heatMissed` | `#ede9e0` | Heatmap: missed days |

**Rules:**

- Surfaces stack from `bg` (deepest) up through `surface` → `surfaceCard` (highest). Never use a darker surface on top of a lighter one.
- `success` deliberately equals `primary`. There is no separate success-green because success in this app is *identity-aligned action*, not a transactional achievement.
- `danger` is rare. Reserve for true errors (validation failures, irrecoverable destructive actions). Do not use it for misses, skips, or empty states.
- Heatmap colors are the only place where multiple semantic colors coexist. Resist any temptation to extend this palette into other charts or status indicators.

### Typography

Two typefaces, both Google Fonts, loaded via `expo-font`:

- **Plus Jakarta Sans** — display / headline only, weights 700–800.
- **Manrope** — everything else, weights 400–800.

The pairing matters: Plus Jakarta has slightly higher x-height and warmer terminals than Inter or SF Pro, which lets it carry headline weight without feeling corporate. Manrope is workhorse-readable at small sizes.

| Token | Size (px) | Use |
|---|---|---|
| `displayLg` | 36 | Auth/onboarding hero headlines |
| `headlineLg` | 28 | Screen titles, primary card headlines |
| `headlineMd` | 22 | Secondary headlines, decision questions |
| `titleLg` | 20 | Section titles within cards |
| `titleMd` | 18 | Subsection headers, preview text |
| `bodyLg` | 16 | Primary reading text, button labels |
| `bodyMd` | 14 | Secondary copy, helper text |
| `labelMd` | 13 | Form labels, eyebrows |
| `micro` | 11 | Tiny uppercase eyebrows |

**Rules:**

- Headlines (≥ 22px) use Plus Jakarta Sans, weight 700 or 800.
- Body and labels use Manrope.
- Eyebrow micro-labels are uppercase, weight 700, letter-spacing ~0.09em.
- Identity streak copy is italic Manrope `bodyLg`, never bold, never large. The smallness is deliberate: *"You've been a reader for 12 days"* is a quiet statement, not a celebration.

### Spacing

Four-point scale, used universally:

```
xs:   4
sm:   8
md:   12
lg:   16
xl:   24
xxl:  32
xxxl: 48
```

**Rules:**

- Card internal padding: `xl` (24) on all sides for standard cards. `xxl` (32) for hero/onboarding cards where the content owns the screen.
- Vertical gap between sections within a card: `xl` (24).
- Vertical gap between cards on a screen: `xl` (24).
- Screen edge padding: `xl` (24).
- Prefer vertical space over dividers. We never use horizontal rules to separate content within a card.

### Radii

```
sm:   12   // form fields, small chips
md:   24   // standard cards, buttons that aren't pill
lg:   32   // bottom sheets, large containers
xl:   48   // reserved; not currently used
pill: 999  // all pill buttons and segmented control items
```

**Rules:**

- All buttons are pill (`R.pill`) by default. The card-shaped button is rare and always intentional.
- Cards are always `md` (24). Small embedded surfaces inside cards are `sm` (12).
- Bottom sheets (recovery modal) use `lg` (32) on the top corners only.

### Shadows

Three named shadows, all primary-tinted:

```
SHADOW_CARD   = '0 8px 32px rgba(68, 102, 85, 0.08)'   // floating cards
SHADOW_LIFT   = '0 2px 12px rgba(68, 102, 85, 0.06)'   // text fields on focus, secondary buttons
SHADOW_BUTTON = '0 4px 20px rgba(68, 102, 85, 0.22)'   // primary button only
```

**Rules:**

- Shadows are always tinted with primary at very low opacity. Never use neutral grey shadows — they read clinical.
- The primary button is the *only* element that earns `SHADOW_BUTTON` (the strongest shadow). This is what makes it look pressable from across the screen.
- React Native shadows are implemented via the native `boxShadow` string prop (RN 0.78+). The token values above are direct CSS-string format and pass through. Acceptable Android fallback if `boxShadow` doesn't render: `elevation: 4` for cards, `elevation: 6` for primary buttons. Do not introduce `react-native-shadow-2` or other shadow libraries — the native prop is sufficient.

---

## Components

### Buttons

Three tiers, used in strict descending hierarchy: **never put two primary buttons on the same screen.**

**`PrimaryBtn`** — the signature gradient pill. Used once per screen for the primary forward action (Save, Continue, Done). Gradient `linear-gradient(135deg, #446655 0%, #5a8a6e 100%)`. Padding `18px 40px`. Weight 700. Letter-spacing `0.01em`. Carries `SHADOW_BUTTON`. In React Native, gradient implemented via `expo-linear-gradient`.

**`SecondaryBtn`** — tonal pill with `surfaceCard` background and `SHADOW_LIFT`. No border. Used for alternative actions (*"Probably not"*, *"I already have an account"*) and post-primary supporting actions.

**`TertiaryBtn`** — text-only, primary color, no background, no border. Used for the lowest-pressure exits (*"Skip today"*, *"Just close"*, *"Back to Today"*).

### Form fields

**`TextField`** — invisible by default. The input has no border and a `surface` background, which makes it look like part of the card. On focus, the background shifts to `surfaceCard` (white) with a 1.5px primary border and a `SHADOW_LIFT`. The label color shifts to primary on focus. The form field "wakes up" when you touch it.

The reason this works: in a card-on-card layout, traditional bordered inputs read as *a UI form*. Removing the border makes the input feel like editable prose. This is core to the "calm" anchor — the interface stops shouting "FORM" at you.

**`ChoicePills`** — pill segmented control. Selected state uses primary gradient with `SHADOW_LIFT`; unselected uses `surface` background. No border on either state. Tapping a selected pill deselects (allows blank state).

**`NullableBooleanField`** — same visual as ChoicePills, two options (Yes / No). Used for weekly review questions where there's a meaningful "not answered yet" state.

### Containers

**`ZenCard`** — the workhorse container. `surfaceCard` background, `R.md` (24) radius, `SHADOW_CARD`, no border. Internal padding `xl`. Children separated by `xl` vertical gap by default. This is what every floating piece of content sits in.

**`MissBanner`** — `surface` background, `R.sm` (12) radius, no border, no shadow. Distinguishes from cards by being deliberately *under* the card surface — it's a quiet acknowledgment, not a notification. Microcopy: *"Yesterday was a miss. The science says it didn't matter. Keep going."*

The miss banner is one of the most important visual decisions in the entire app. The moment a user sees it tests whether the app's promise of "calm, science-informed, no shame" is real or marketing copy. The visual treatment must reinforce the message: the banner is small, tonal, dismissible without consequence, and worded in second person without judgment.

**`Eyebrow`** — uppercase micro-label, weight 700, letter-spacing 0.09em, color `textMuted` by default or `primary` for emphasis. Used to label sections that don't need a full title. *"PREVIEW"*, *"YOUR HABIT"*, *"SUGGESTED ADJUSTMENT"*.

**`RowLV`** — label + value pair, no divider. Eyebrow-style label above a `bodyLg` value. Vertical gap `xs` between them, `xl` between rows. Used in setup info, habit detail rows, weekly review summaries.

### Chrome

**`TabBar`** — glassmorphism floating nav. `rgba(251, 249, 245, 0.85)` background with `backdrop-filter: blur(20px)`. Three tabs: Today, Library, Settings. Active tab uses primary color; inactive uses `textMuted`. No badge dots, no notification indicators ever.

In React Native, `backdrop-filter` doesn't exist natively — use `expo-blur`'s `<BlurView>` with an `intensity` of 80 and a tinted background fallback. Test on both iOS (where blur is GPU-cheap) and Android (where it can be expensive); if Android performance degrades, fall back to opaque `rgba(251, 249, 245, 0.95)` with no blur.

### Modals

**`RecoveryModal`** — bottom sheet, glassmorphism. Three action cards stacked vertically: *Restart as-is*, *Make it smaller*, *Pause for now*. Each action card is its own surface with a label + hint. Below the actions, a `TertiaryBtn` *"Just close"* gives a no-pressure exit.

The voice in the recovery modal is critical: *"The habit lost some momentum. That happens to everyone — what matters now is what you do next."* No personal address (*"you failed"*), no shame, no urgency. The modal is offered, not imposed.

---

## Surface patterns

### Screen layout

Every full screen follows the same skeleton:

1. Status bar / safe area.
2. (Optional) Quiet header — date, logo mark, or section eyebrow. Never a back button as a primary affordance; navigation is always semantic (*"Back to Today"* as a `TertiaryBtn` at the bottom of detail screens).
3. Scrollable content area, padded `xl` on the edges, content stacked with `xl` vertical gaps.
4. Cards as primary content containers.
5. (Optional) Floating `TabBar` at the bottom for top-level screens.

### Vertical rhythm

The product is unusually generous with vertical space. This is deliberate. Density is not a virtue here — most screens have one focal idea (a question, a card, a chart) and the rest is breathing room. **If a screen feels crowded, the answer is almost always to remove content, not to compress spacing.**

### Header weight

Screen-level headlines use `headlineLg` (28px) Plus Jakarta 800. Below the headline, a single `bodyLg` line of `textMuted` context — never two lines, never a full paragraph. The headline + one line is the entire screen header.

---

## Motion

The screens file doesn't encode motion, but the language has clear motion principles:

- **What moves:** focus state on form fields (background + border fade, ~180ms), button press feedback (~150ms opacity dip), modal entrance (slide up from bottom, ~250ms ease-out), tab change (instant — no slide).
- **What doesn't move:** card mount/unmount (no fade-in on initial render), streak number changes (silent — no count-up animation, no confetti), heatmap cells (silent — no animated fill on log).
- **Celebration animations are forbidden.** No confetti on streaks, no sparkle on completion, no haptic burst on Done. The Done button changes label to *"Done ✓"* and color shifts subtly. That's it. The reward is internal — we don't try to manufacture one externally.

This is the strongest motion call in the language: **a habit completed is acknowledged, not celebrated.** Celebration is a productivity-app pattern that triggers exactly the dopamine-loop dynamic we're trying to avoid. It also makes the app feel cheap.

---

## Surface-specific calls

### Focus card (Today screen)

The Focus card is the emotional heart of the daily experience. It's the first thing the user sees and the most-encountered surface in the app.

- **Identity headline owns the card.** Plus Jakarta 800, `headlineLg`. Example: *"Become someone who reads daily."*
- **Formula sits below the headline** in `bodyLg textMuted`: *"After I brush my teeth, read 1 page."*
- **Identity streak** is italic `bodyLg` Manrope, never bold, never large: *"You've been a reader for 12 days."* On day 0: *"Day one. Start showing up."*
- **Miss banner** appears between streak and actions when yesterday was a miss.
- **Done button** is the only `PrimaryBtn` on the screen. *"Skip today"* is a `TertiaryBtn` below it.
- **Heatmap** sits at the bottom of the card, 30-day view (5 rows × 6 cols, 32px cells).

### Heatmap

- 30-day view on Today/Focus card; 90-day view on Habit Detail.
- Three states: done (primary sage), skipped (warm cream), missed (deep surface).
- Today's cell, when not yet logged, has a 2px primary outline at -2px offset (inset).
- No tooltips, no per-cell copy on tap, no week labels. The heatmap is read by glance, not by analysis.
- Faded opacity (0.6) for cells with no log to date, full opacity for logged cells.

### Identity streak

Identity streak copy is **per-goal**, displayed inside the goal container below the becoming phrase. The copy is generic (no identity-noun extraction from the phrase) and randomized from 5 variants per render. See §Today screen redesign for the full copy set.

The streak number reflects the oldest active habit's forgiving streak in the goal group.

### Onboarding

- All onboarding cards use `xxl` (32) internal padding — extra room because the content is asking real questions.
- Examples appear as plain `bodyLg textMuted` lines under the input, not as tappable suggestions. We're prompting reflection, not autocomplete.
- The "Worst Day" question (*"If today were your worst day — sick, exhausted, stressed — could you still do this?"*) uses `headlineMd` weight 700 inside the card. This is a deliberate weight bump to mark it as the most important question in onboarding.

### Empty states

Empty states are full screens, not inline placeholders. *"No active habits yet"* gets a `ZenCard` headline and a single primary action. We don't show empty rows or skeletons.

---

## Dark mode

Dark mode is **not a Core v1 surface.** The design canvas has a `darkDevice` toggle for testing the device shell; that's a canvas affordance only. Production ships light-mode only for beta. Dark mode is a Phase D consideration.

If a user's system is set to dark, the app should respect a light-mode override and not auto-flip. We'll revisit when we have a coherent dark variant; shipping a half-converted dark mode would damage trust more than not having one.

---

## AI hints — locked decision

AI features are gated off for Core v1 production builds. Specifically:

- **Today screen Insight card** — does not render in production. Removed entirely from the JSX, gated behind `FEATURE_FLAGS.aiRewrite` (already exists from S8).
- **EditHabit AI rewrite card and *"Generate rewrite"* button** — does not render in production. Same gate.
- **Layout slots are not preserved.** When AI re-enables post-Core-v1, those surfaces will be redesigned — keeping dead slots is not worth the code drag.

The design canvas keeps the AI surfaces visible (controlled by the `showAIHints` tweak) so we can iterate on them in design space without affecting production. Engineers must verify their production builds genuinely lack these surfaces, not merely hide them.

---

## Open decisions

These are tracked here so they don't go missing. Each is gated to a specific S9 ticket or downstream sprint.

**LOCKED — Multi-habit Today / Goal-based architecture.** Resolved 3 May 2026. See §Goal-based architecture and §Today screen redesign below.

**LOCKED — Weekly Review screen in beta.** Resolved 3 May 2026. Option (a): defer entirely. Don't ship UI, don't link to it. Data layer migrates in S11 but screen is gated until post-beta.

**OPEN — Backlog UI.** Backlog (deferred habit ideas, distinct from Archived) has no design treatment yet. The Settings screen shows Archived; Backlog has no surface. Decision needed before any Backlog ticket: where does Backlog live (Settings sub-section? Library tab? separate surface?), and what's its primary action (promote-to-active? edit? delete?).

**OPEN — Retroactive logging affordance.** S8 ships `RetroLogSelector` (48-hour retro window). The selector has no visual treatment in the current designs. Decision needed before RetroLog UI ticket: where does it live (Today screen second-tier action? Habit Detail? both?) and what's its visual weight?

**OPEN — ReadOnlyBanner styling.** S8 ships a non-dismissible banner when trial grace expires. The current banner uses `PrimaryButton` styling; needs proper visual treatment in the language. Likely treatment: tonal banner using `surface` background, no shadow, primary-colored CTA button. Final treatment to be locked before re-skinning the surfaces that host it (Today, HabitDetail, Create, Edit).

**OPEN — Logo asset.** The HTML references `uploads/logo-filled-v2.png`. The actual asset isn't in the design folder. Need the production asset (ideally SVG primary + raster fallback, multiple sizes for app icon). Required before the icon ticket and any surface that displays the brand mark.

---

## How to use this document

This is the source of truth for visual *intent.* When a token, a component, or a surface treatment in the codebase doesn't match this doc, the codebase is wrong unless it explicitly notes a deliberate divergence in code comments.

When this doc is silent or ambiguous, fall back to `design/habitapp/habit-screens.jsx` — the visual oracle. When the screens file disagrees with this doc, this doc wins (the screens file is design exploration; this doc is the locked spec).

When something is genuinely not covered by either, **stop and ask the product lead before inventing.** Inventing visual decisions on the fly is exactly the failure mode this document was created to prevent.

---

---

## Goal-based habit architecture (locked 3 May 2026)

This section documents a significant product architecture change from role-based habits (Focus/Supporting) to goal-based habits.

### The change

**Before:** Habits had a `habit_state` of `focus`, `supporting`, or `automatic`. One Focus slot, two Supporting slots. Global 3-active hard cap. Focus habits got rich visual treatment (identity streak, heatmap, gradient circle); Supporting habits got reduced treatment (no streak display, smaller card, no identity copy).

**After:** Habits belong to a **goal** (the becoming/identity phrase). All habits under a goal are peers — no Focus/Supporting distinction. The `habit_state` axis simplifies: `active` (in formation) or `automatic` (graduated). A soft cap of 3 habits per goal applies, with a gentle warning if the user tries to add a 4th ("Research suggests more than 3 active habits under one goal can be difficult to sustain. Are you sure?"). The user can proceed — it's guidance, not a block.

### Why

The Focus/Supporting distinction was a mechanism to enforce the "one habit deeply" principle. But it introduced complexity (different visual treatments, different creation flows, different streak rules) that doesn't map to how people think. Nobody thinks "I have one Focus habit and two Supporting habits." They think "I'm becoming a reader, and here are the things I do for that." The goal container makes that relationship explicit and removes artificial distinctions between habits that are fundamentally the same thing — daily practices in service of an identity.

### What stays the same

- **Onboarding** still creates one goal with one habit through the becoming bridge. The user starts with one thing.
- **Worst-day gate** applies to all habits during onboarding (hard block for the first habit). For habits added post-onboarding, the gate is guidance, not a block.
- **Graduation** still works per-habit via SRHI. When a habit reaches the threshold, it moves to the Automatic Library.
- **Recovery flow** triggers for any habit with two consecutive misses. The modal names the specific habit.
- **3-per-goal soft cap** replaces the 3-active hard cap. The user is warned but not blocked.

### What changes

- **`habit_state`** values change from `focus | supporting | automatic` to `active | automatic`.
- **All habits in a goal group get equal visual treatment.** Same circle size, same row height, same interaction pattern. No gradient-vs-white circle distinction.
- **Identity streak copy is per-goal**, not per-habit. "You've been a reader for 12 days" reflects the oldest habit's streak in the goal group.
- **Consistency donut is per-goal**, calculated as the average consistency across all habits in the goal (done / (done + missed), skipped excluded, last 30 days). Per-habit consistency is on the detail screen.
- **Multi-goal is architecturally supported** but not built for beta. The goal container pattern stacks naturally. Building the "add new goal" flow is a post-beta feature.

### DB impact

Habits need a grouping key for goals. Options: (a) use `identity_phrase` as the grouping key directly (simplest, already exists on each habit), or (b) introduce a `goals` table with `id`, `identity_phrase`, `user_id`, and habits FK to `goal_id`. Option (b) is cleaner long-term but adds a migration. Decision: use option (a) for beta — group habits by their `identity_phrase`. Migrate to option (b) post-beta if multi-goal ships.

---

## Today screen redesign (locked 3 May 2026)

The Today screen is the most important surface in the app. Its job is to be the becoming bridge, every single day — not to show stats, not to display a checklist.

### Screen structure (top to bottom)

1. **Quiet header** — AppLogo (small, top-left) + date (top-right). No "Today" headline.
2. **Goal container** — a warm tonal surface (`surface` / `#f3f1eb`, border-radius 20px) that wraps each goal group. Contains:
   - **Identity anchor** — the becoming phrase (21px, weight 500, `text` color). This is the screen's emotional center.
   - **Identity streak** — sage italic copy below the becoming phrase. Randomized from 5 variants per render to keep the screen feeling alive:
     - Active streak (2+ days): "N days and counting" / "Showing up for N days" / "N days strong" / "Day N — keep going" / "N days of building"
     - Day 1: "Day 1 — it starts here" / "1 day and counting" / "Day 1 — keep going" / "The first day is done" / "1 day of building"
     - Day 0 (no logs): "Start showing up today" (single variant)
     - Streak broken: "Start a new streak" (single variant)
   - **Consistency donut** — 48px SVG donut chart, sage gradient fill on light track, percentage centered inside, "Consistency" label underneath in faint text. Positioned to the right of the identity anchor. Shows average consistency across all habits in the goal.
   - **Habits card** — white card (`surfaceCard`, border-radius 14px) nested inside the goal container. Contains habit rows.
3. **Habit rows** inside the card:
   - All habits are visually equal. Same circle size (38px), same row height, same interaction.
   - Each row: tap-to-done circle (sage border when pending) + Lucide SVG icon + habit name + cue text below + chevron.
   - Tap circle = log Done. Tap row = navigate to detail screen.
   - Done state: filled sage gradient circle with white checkmark + strikethrough name + reduced opacity (0.55).
   - Rows separated by 0.5px `surface` dividers.
4. **Skip access** — "Long-press circle to skip" hint text, centered below the card. Skip is not a button competing with Done.
5. **Post-completion state** — when all habits are logged, the screen shows "You showed up today." in muted text. No celebration, no confetti — just quiet acknowledgment.
6. **Miss banner** — MissBanner atom appears between goal containers (or inside the goal container above the habits card) when yesterday had a miss on any habit in the goal.

### What's NOT on this screen

- No heatmap (lives on detail screen only)
- No per-habit consistency or streak numbers (lives on detail screen)
- No numeric streak counter separate from the identity copy
- No "create another habit" CTA (that's settings)
- No weekly review prompt (deferred)

### Multi-goal stacking (future)

When multi-goal ships, goal containers stack vertically with `xl` (24px) gap between them. Each goal group is self-contained — its own identity anchor, donut, streak, and habits card. The scroll is natural. The user sees distinct identity projects, not a flat list of mixed habits.

---

## Revision log

- **1 May 2026 (rev 1)** — Initial draft. AI hints decision locked; multi-habit Today, Weekly Review beta scope, Backlog UI, RetroLog affordance, ReadOnlyBanner styling, and logo asset marked OPEN.
- **1 May 2026 (rev 2)** — Pre-S9 review fixes: added `primaryGradientEnd: #5a8a6e` token (PrimaryButton gradient end-stop, previously inline in canvas); clarified shadow implementation (RN 0.78+ native `boxShadow`, not `react-native-shadow-2`); corrected `primaryLight` description to reflect reserved-not-consumed state; locked the app name as **Habitapp** (single coined word, capital H only).
- **3 May 2026 (rev 3)** — Goal-based architecture locked: dissolved Focus/Supporting distinction, habits grouped by identity/goal, all habits visually equal peers, soft 3-per-goal cap. Today screen redesign locked: identity-anchored goal container with donut consistency chart, habits as equal rows, skip via long-press, quiet post-completion state. Weekly Review beta scope locked (option a: defer). Multi-habit Today OPEN resolved.
