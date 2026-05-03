# S9 — Screen Reskin Implementation Tickets

> **Goal:** Apply the HTML design screens from `design/html screens/` to the existing React Native app.
> **Scope:** 9 screens across 2 flows: Entry (2), Onboarding (7). Today screen deferred to S14-new (multi-habit Today).
> **Approach:** Visual-only refactor — all functional logic (OnboardingProvider, mutations, navigation, auth) stays. Only JSX structure and StyleSheet changes.

---

## Ticket 0: Shared Components & Theme Prep

**Why first:** Every screen in the HTML designs shares layout patterns that don't exist in the current app. Building these once avoids duplication across the 10 screen tickets.

### 0A. New Theme Tokens

Add to `src/theme/colors.ts`:
```ts
// No new colors needed — HTML designs use exact same palette.
// Verify these exist (they do):
// bg: '#fbf9f5', surface: '#f5f2eb' (maps to HTML #f3f1eb — ADJUST to match),
// surfaceCard: '#ffffff', surfaceHigh: '#ede9e0' (maps to HTML #e8e5dd — ADJUST),
// text: '#31332f', textMuted: '#6b6e67' (HTML uses #6b6d68 — ADJUST),
// textFaint: '#9a9d96' (HTML uses #9a9c96 — ADJUST), primary: '#446655'
```

**Action required:** The HTML designs use slightly different hex values for several tokens. Align the theme file to match the HTML exactly:

| Token | Current | HTML Design | Action |
|-------|---------|-------------|--------|
| `surface` | `#f5f2eb` | `#f3f1eb` | **Update** |
| `surfaceHigh` | `#ede9e0` | `#e8e5dd` | **Update** |
| `textMuted` | `#6b6e67` | `#6b6d68` | **Update** |
| `textFaint` | `#9a9d96` | `#9a9c96` | **Update** |
| `primaryGradientEnd` | `#5a8a6e` | `#6b9e7d` | **Update** |

Also add a new token:
```ts
surfaceSection: '#f3f1eb',  // The warm gray used for guidance cards, chip bg, info boxes
```

Add to `src/theme/shadows.ts`:
```ts
cardFloat: '0 4px 24px rgba(68, 102, 85, 0.08)',  // Habit preview card in S6, S7
inputField: '0 4px 16px rgba(68, 102, 85, 0.06)', // Text input containers
```

### 0B. `OnboardingLayout` Component

**File:** `src/components/layouts/OnboardingLayout.tsx`

This is the wrapper every onboarding screen (S1–S7) uses. The HTML designs share a consistent structure: content at top, CTA pinned at bottom, `#fbf9f5` background.

```tsx
type OnboardingLayoutProps = {
  children: React.ReactNode;         // Main content area
  footer: React.ReactNode;           // Bottom CTA button(s)
  keyboardAware?: boolean;           // Wrap in KeyboardAvoidingView
};
```

**Layout structure (from HTML):**
```
<View style={{ flex: 1, backgroundColor: colors.bg }}>
  <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
    <View style={{ flex: 1, paddingHorizontal: 24 }}>
      {children}
    </View>
  </ScrollView>
  <View style={{ paddingHorizontal: 24, paddingBottom: 48 }}>
    {footer}
  </View>
</View>
```

Key details from the HTML:
- Horizontal padding: `24px` (not the current `spacing.xl` = 24, so same value — keep using `spacing.xl`)
- Bottom padding on footer: `48px` (`spacing.xxxl`)
- Content is `flexGrow: 1` so the CTA is always bottom-pinned
- When keyboard opens, the footer should scroll up with the content (set `keyboardAware` to use `KeyboardAvoidingView`)

### 0C. `ProgressBar` Component

**File:** `src/components/navigation/ProgressBar.tsx`

The step indicator used in S2–S6 (5 steps). The active step gets a wider bar.

```tsx
type ProgressBarProps = {
  currentStep: number;  // 1-indexed (1–5)
  totalSteps: number;   // 5 for onboarding
};
```

**Visual spec from HTML:**
- Container: `flexDirection: 'row'`, `alignItems: 'center'`, `gap: 6`
- Inactive dot: `width: 8, height: 4, borderRadius: 2, backgroundColor: colors.surfaceHigh`
- Active dot: `width: 24, height: 4, borderRadius: 2, backgroundColor: colors.primary`
- Each step is a dot; the active one is wider

### 0D. `BackButton` Component

**File:** `src/components/navigation/BackButton.tsx`

Used in S2–S6 alongside the ProgressBar.

```tsx
type BackButtonProps = {
  onPress?: () => void;  // Defaults to router.back()
};
```

**Visual spec from HTML:**
- Circle: `width: 40, height: 40, borderRadius: 20`
- Background: `colors.surface` (`#f3f1eb`)
- Chevron icon: left-pointing, `stroke: colors.text`, `strokeWidth: 1.8`
- Use Lucide `ChevronLeft` icon, size 18

### 0E. `OnboardingHeader` Component

**File:** `src/components/navigation/OnboardingHeader.tsx`

Combines BackButton + ProgressBar in a row. Used in S2–S6.

```tsx
type OnboardingHeaderProps = {
  currentStep: number;
  totalSteps?: number;  // Default 5
  onBack?: () => void;
};
```

**Layout from HTML:**
```
<View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 44 }}>
  <BackButton onPress={onBack} />
  <ProgressBar currentStep={currentStep} totalSteps={totalSteps} />
</View>
```

### 0F. `GuidanceCard` Component

**File:** `src/components/cards/GuidanceCard.tsx`

The informational tip boxes used in S3, S4, S5. Warm background with title + body + optional example slots.

```tsx
type GuidanceCardProps = {
  title: string;
  body: string;
  children?: React.ReactNode;  // For example items
};
```

**Visual spec from HTML:**
- Container: `backgroundColor: colors.surface`, `borderRadius: radius.md` (24), `padding: 20`
- Title: `fontSize: 13, fontWeight: '500', color: colors.primary`
- Body: `fontSize: 14, lineHeight: 22.4, color: colors.textMuted`

### 0G. `GuidanceExample` Component

**File:** `src/components/cards/GuidanceExample.tsx`

The individual example rows inside GuidanceCard (e.g., "Becoming a reader → ✓ Read for 10 minutes / ✗ Read more books").

```tsx
type GuidanceExampleProps = {
  context?: string;      // e.g. "Becoming a reader"
  good: string;          // ✓ example
  bad?: string;          // ✗ example (optional, S3 has both, S4 doesn't)
  before?: string;       // For S4: "Run for 10 minutes →"
  after?: string;        // For S4: "Put on my running shoes"
};
```

**Visual spec from HTML:**
- Container: `backgroundColor: colors.surfaceHigh` (`#e8e5dd`), `borderRadius: 16`, `padding: 12 14`
- Context label: `fontSize: 12, color: colors.textFaint`
- Good example: `fontSize: 14, color: colors.text` with green checkmark
- Bad example: `fontSize: 14, color: colors.textFaint` with gray X

### 0H. `OnboardingInput` Component

**File:** `src/components/forms/OnboardingInput.tsx`

The "invisible input" pattern from DESIGN.md, used in S2–S5. White card with subtle shadow, edit icon, and text input.

```tsx
type OnboardingInputProps = {
  label: string;           // e.g. "Your answer", "Your action"
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
};
```

**Visual spec from HTML:**
- Label: `fontSize: 13, fontWeight: '500', color: colors.primary, marginBottom: 8, paddingLeft: 4`
- Input container: `backgroundColor: colors.surfaceCard` (#ffffff), `borderRadius: 24`, `padding: 16 18`, `flexDirection: 'row'`, `alignItems: 'center'`, `gap: 12`, `boxShadow: shadows.inputField`
- Edit icon: Lucide `PenLine` icon, `size: 18, color: colors.primary, strokeWidth: 1.5`
- Input text: `fontSize: 15, color: colors.text`, single-line (not multiline like current)

### 0I. `ChipSelector` Component

**File:** `src/components/forms/ChipSelector.tsx`

The tappable suggestion pills used in S2 (Becoming screen).

```tsx
type ChipSelectorProps = {
  options: string[];
  selectedValue: string | null;
  onSelect: (value: string) => void;
};
```

**Visual spec from HTML:**
- Container: `flexDirection: 'row', flexWrap: 'wrap', gap: 8`
- Default chip: `backgroundColor: colors.surface`, `borderRadius: 999`, `paddingVertical: 10, paddingHorizontal: 18`, `fontSize: 14, color: colors.text`
- Selected chip: `backgroundColor: colors.primary`, `color: '#fff'`
- On select, the value is also populated into the text input above it

### 0J. `AppLogo` Component

**File:** `src/components/branding/AppLogo.tsx`

The 4-quadrant SVG mark used in S1 (onboarding welcome) and signup_s1.

```tsx
type AppLogoProps = {
  size?: number;        // Default 56 for onboarding, 24 for header
  animated?: boolean;   // True for signup_s1 scatter→assemble animation
};
```

**Visual spec from HTML (static version):**
- 4 elements in a 2×2 grid: 3 rounded squares (stroke only) + 1 filled circle (top-right per S9c)
- Stroke color: `#5b8a72`, strokeWidth: 2.8, fill on squares: `colors.surface`
- Circle: `fill: #5b8a72`

**Animated version (signup_s1):** Each quadrant starts scattered/rotated and assembles to position. CSS keyframe loop, 4s duration. Translate to Reanimated or Animated API.

### 0K. Update `PrimaryButton` to support trailing arrow icon

The HTML designs show all CTA buttons with a trailing arrow SVG → icon. Update PrimaryButton:

```tsx
type PrimaryButtonProps = {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  showArrow?: boolean;  // NEW — default true for onboarding, false elsewhere
};
```

When `showArrow` is true, add Lucide `ArrowRight` icon (size 16, color white) after the label with `gap: 10`.

Also update disabled state to match HTML: instead of `opacity: 0.55`, change to `backgroundColor: colors.surfaceHigh` (#d3d1c7), `color: colors.textFaint` (#9a9c96). This means the gradient is removed when disabled, not just faded.

---

## Ticket 1: Entry Welcome Screen (`signup_s1`)

**File:** `src/features/entry/screens/WelcomeScreen.tsx`

### Current state
Center-justified ScrollView with a ZenCard containing eyebrow + title + body, plus CTA buttons below.

### Target state (from `habitapp_signup_s1.html`)
Top-anchored layout with logo in header, large headline, animated logo mark in center, two bottom-pinned buttons.

### Layout structure
```
<View style={{ flex: 1, bg: colors.bg }}>
  <View style={{ padding: '20 24 0' }}>
    {/* Header: small logo + "HABITAPP" label */}
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 48 }}>
      <AppLogo size={24} />
      <Text style={{ fontFamily: displaySemi, fontSize: 14, color: primary,
                     letterSpacing: 0.06*14, textTransform: 'uppercase' }}>
        Habitapp
      </Text>
    </View>

    {/* Headline block */}
    <Text style={headline}>Small actions.{'\n'}Real habits.</Text>
    <Text style={subhead}>Start with one small habit.{'\n'}We'll guide you every day.</Text>
  </View>

  {/* Centered animated logo */}
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <AppLogo size={120} animated />
  </View>

  {/* Bottom CTAs */}
  <View style={{ paddingHorizontal: 24, paddingBottom: 40 }}>
    <PrimaryButton label="Start building" showArrow onPress={→ sign-up} />
    <SecondaryButton label="Log in" onPress={→ sign-in} style={{ marginTop: 12 }} />
  </View>
</View>
```

### Typography
- Headline: `displayBold`, `fontSize: 32`, `lineHeight: 36.8`, `color: text`
- Subhead: `body`, `fontSize: 16`, `lineHeight: 25.6`, `color: textMuted`, `letterSpacing: 0.32`

### No logic changes
Navigation stays: "Start building" → `/(auth)/sign-up`, "Log in" → `/(auth)/sign-in`.

---

## Ticket 2: Sign-Up Screen (`signup_s2`)

**File:** `src/features/auth/screens/SignUpScreen.tsx`

### Current state
Top-aligned header text + ZenCard with email/password fields + PrimaryButton + SecondaryButton.

### Target state (from `habitapp_signup_s2.html`)
OnboardingHeader (back + 3-dot progress, step 2 active) → Large headline → Warm card (`surface`) with email/password fields and sign-up button → "I already have an account" text link below.

### Layout structure
```
OnboardingLayout:
  header: OnboardingHeader with 3-step progress (step 2 active), custom back
  content:
    <Text headline>The person you want to be starts here.</Text>
    <Text subhead>One habit at a time.</Text>

    <View style={{ bg: colors.surface, borderRadius: radius.lg, padding: '28 24 32' }}>
      TextField(label="Email", placeholder="you@example.com")
      TextField(label="Password", placeholder="Choose a password", secureTextEntry, showEyeIcon)
      PrimaryButton(label="Sign up", showArrow)
    </View>

    <Pressable center>
      <Text style={{ fontSize: 14, color: primary, fontWeight: '500' }}>
        I already have an account
      </Text>
    </Pressable>
```

### Typography
- Headline: `displayBold`, `fontSize: 30`, `lineHeight: 35.4`, `color: text`
- Subhead: `body`, `fontSize: 15`, `lineHeight: 23.25`, `color: textMuted`
- Field labels: `fontSize: 13, fontWeight: '500', color: textMuted`

### TextField style update needed
Current `TextField` uses a basic `surface` background input. Update to match the HTML "invisible input" pattern: `backgroundColor: surfaceHigh` (`#e8e5dd`), `borderRadius: 24`, `padding: 14 18`, no border.

### Logic changes: None
All auth logic (validation, signUpWithPassword, error handling, submit lock) stays identical.

---

## Ticket 3: Onboarding Welcome (`onboarding_s1`)

**File:** `src/features/onboarding/screens/WelcomeScreen.tsx`

### Current state
Center-justified ZenCard with "This is a tool for becoming" + body text + Begin button.

### Target state (from `habitapp_onboarding_s1.html`)
Logo centered at top (180px paddingTop), then headline + two lines of body copy pushed toward bottom-third, CTA bottom-pinned.

### Layout structure
```
OnboardingLayout:
  footer: PrimaryButton(label="Begin", showArrow, onPress=handleBegin)
  content:
    <View style={{ alignItems: 'center', paddingTop: 180, marginBottom: 80 }}>
      <AppLogo size={56} />
    </View>

    <Text headline>Let's build your first habit.</Text>
    <Text subhead>We'll walk you through it — step by step.</Text>
    <Text micro>Takes about a minute.</Text>
```

### Typography
- Headline: `displayBold`, `fontSize: 30`, `lineHeight: 35.4`, `color: text`
- Subhead: `body`, `fontSize: 16`, `lineHeight: 25.6`, `color: textMuted`, `letterSpacing: 0.32`
- Micro: `body`, `fontSize: 14`, `lineHeight: 21`, `color: textFaint`

### Logic changes: None

---

## Ticket 4: Becoming Screen (`onboarding_s2`)

**File:** `src/features/onboarding/screens/BecomingScreen.tsx`

### Current state
ZenCard with header + multiline TextInput + plain text examples list.

### Target state (from `habitapp_onboarding_s2.html`)
OnboardingHeader (step 1/5) → green eyebrow → headline → OnboardingInput → ChipSelector.

### Layout structure
```
OnboardingLayout:
  footer: PrimaryButton(label="Continue", showArrow, disabled=becomingPhrase<2)
  content:
    OnboardingHeader(currentStep=1)

    <Text eyebrow>Habits stick when they connect to who you want to be.</Text>
    <Text headline>Who do you want to become?</Text>

    OnboardingInput(
      label="Your answer",
      placeholder="Describe who you are becoming...",
      value=becomingPhrase,
      onChangeText=update
    )

    <Text chipsLabel>Try one of these</Text>
    ChipSelector(
      options=["a runner", "someone who reads daily", "a calmer person",
               "a better partner", "someone who saves consistently",
               "a writer", "a present parent"],
      selectedValue=...,
      onSelect=(v) => { update({ becomingPhrase: v }) }
    )
```

### Typography
- Eyebrow: `bodyMedium`, `fontSize: 14`, `lineHeight: 21`, `color: primary`, `fontWeight: '500'`
- Headline: `displayBold`, `fontSize: 28`, `lineHeight: 33`
- Chips label: `bodyMedium`, `fontSize: 13`, `color: textFaint`, `fontWeight: '500'`

### Logic changes
- Replace plain text example list with interactive `ChipSelector`
- When a chip is tapped, it both selects visually AND populates the input field
- The Continue button enables when `becomingPhrase.trim().length >= 2` (currently `> 0`)

---

## Ticket 5: Daily Action Screen (`onboarding_s3`)

**File:** `src/features/onboarding/screens/DailyActionScreen.tsx`

### Current state
ZenCard with header + reflection text + multiline TextInput + helper text.

### Target state (from `habitapp_onboarding_s3.html`)
OnboardingHeader (step 2/5) → headline + body → OnboardingInput → GuidanceCard with two examples.

### Layout structure
```
OnboardingLayout:
  footer: PrimaryButton(label="Continue", showArrow, disabled=dailyAction<2)
  content:
    OnboardingHeader(currentStep=2)

    <Text headline>What action will you take to become who you want to be?</Text>
    <Text body>Write a concrete action — something small and repeatable you can track.</Text>

    OnboardingInput(
      label="Your action",
      placeholder="e.g. Read for 10 minutes",
      value=dailyAction,
      onChangeText=update
    )

    GuidanceCard(
      title="What makes a good habit action?",
      body="Think about one small thing that brings you closer to who you described. Make it specific enough that you'll know you did it."
    ):
      GuidanceExample(context="Becoming a reader", good="Read for 10 minutes", bad="Read more books")
      GuidanceExample(context="Becoming physically fit", good="Exercise for 15 minutes", bad="Be healthier")
```

### Logic changes
- Remove the `reflection` line showing "Becoming: {becomingPhrase}"
- Copy changes only — same navigation, same draft update
- Minimum 2 chars to enable button (currently `> 0`)

---

## Ticket 6: Shrink Screen (`onboarding_s4`)

**File:** `src/features/onboarding/screens/ShrinkScreen.tsx`

### Current state
ZenCard with dynamic header (based on worstDayPassed) + multiline TextInput + coaching paragraph + plain text examples.

### Target state (from `habitapp_onboarding_s4.html`)
OnboardingHeader (step 3/5) → headline + body → context chip (showing user's action) → OnboardingInput → GuidanceCard with 3 before→after examples.

### Layout structure
```
OnboardingLayout:
  footer: PrimaryButton(label="Continue", showArrow, disabled=tinyAction<2)
  content:
    OnboardingHeader(currentStep=3)

    <Text headline>Now make the action laughably small.</Text>
    <Text body>The goal is showing up, not achieving. Start so small you can't say no.</Text>

    {/* Context chip showing the user's daily action */}
    <View style={{ bg: surface, borderRadius: 16, padding: '12 16', flexDirection: 'row', gap: 10 }}>
      <Lucide:CheckCircle size=16 color=primary />
      <Text>Your action: <Text bold>{draft.dailyAction}</Text></Text>
    </View>

    OnboardingInput(
      label="Your tiny version",
      placeholder="Make it even smaller...",
      value=tinyAction,
      onChangeText=update
    )

    GuidanceCard(
      title="How small is small enough?",
      body="Shrink it until you could do it on your worst, most exhausting day — and still say 'I showed up.'"
    ):
      GuidanceExample(before="Run for 10 minutes →", after="Put on my running shoes")
      GuidanceExample(before="Read for 30 minutes →", after="Read one page")
      GuidanceExample(before="Meditate for 20 minutes →", after="Sit quietly for one breath")
```

### Logic changes
- Remove the dynamic `headerCopy` based on `worstDayPassed` — that conditional is now handled differently since worst-day is folded into S6
- Keep the pre-seed logic: if `tinyAction` is empty when entering, pre-fill from `dailyAction`

---

## Ticket 7: Cue Screen (`onboarding_s5`)

**File:** `src/features/onboarding/screens/CueScreen.tsx`

### Current state
ZenCard with "After I" / "I will" text inputs + coaching paragraph + plain text example routines.

### Target state (from `habitapp_onboarding_s5.html`)
OnboardingHeader (step 4/5) → eyebrow + headline → structured "After I ___ / I will ___" card → GuidanceCard with 2 trigger→action examples.

### Layout structure
```
OnboardingLayout:
  footer: PrimaryButton(label="Continue", showArrow, disabled=cueExisting<2)
  content:
    OnboardingHeader(currentStep=4)

    <Text eyebrow>Attach it to something you already do — no willpower needed.</Text>
    <Text headline>What will trigger it?</Text>

    {/* Structured After I / I will card */}
    <View style={{ bg: surface, borderRadius: 24, padding: '24 20' }}>
      <Text fieldLabel>After I</Text>
      OnboardingInput(
        placeholder="something you already do...",
        value=cueExisting,
        onChangeText=update
      )

      <Text fieldLabel style={{ marginTop: 20 }}>I will</Text>
      <View style={{ bg: surfaceHigh, borderRadius: 24, padding: '16 18' }}>
        <Text style={{ fontSize: 15, color: text, fontWeight: '500' }}>
          {draft.tinyAction}
        </Text>
      </View>
    </View>

    GuidanceCard(
      title="Why a routine trigger?",
      body="A routine cue beats a clock cue. Pick something you already do reliably — the previous action becomes your reminder."
    ):
      {/* Two formatted examples with trigger/action badges */}
      ExampleWithBadges(
        trigger="finish my morning coffee",
        action="read one page"
      )
      ExampleWithBadges(
        trigger="brush my teeth",
        action="meditate for one breath"
      )
```

### Key changes
- The "I will" field is now **read-only** — it displays `draft.tinyAction` from the previous step, not an editable input
- Examples use colored badges: "trigger" badge (primary bg, white text), "action" badge (primaryLight bg, primary text)
- Remove the `EXAMPLE_ROUTINES` plain text list

---

## Ticket 8: Personalize + Worst-Day Screen (`onboarding_s6`) — MERGED

**File:** `src/features/onboarding/screens/PersonalizeScreen.tsx` (NEW, replaces `WorstDayCheckScreen.tsx`)

This is the most complex screen — it has **two phases** that transition in-place.

### Phase 1: Personalize (name + icon)

```
OnboardingLayout:
  footer: PrimaryButton(label="Looks good", showArrow, disabled=name<2)
  content:
    OnboardingHeader(currentStep=5)

    <Text headline>Personalize your habit.</Text>
    <Text body>Give it a name and an icon to make it yours.</Text>

    {/* Habit preview card */}
    <View style={{ bg: surfaceCard, borderRadius: 32, padding: '28 24', shadow: cardFloat }}>
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        {/* Icon button — opens Lucide icon picker */}
        <IconPickerButton selectedIcon={icon} onSelect={setIcon} />

        <View>
          <Text micro>Give it a name</Text>
          <TextInput
            placeholder="Tap to name your habit"
            style={{ fontFamily: displayBold, fontSize: 18 }}
            value={name}
            onChangeText={setName}
          />
        </View>
      </View>

      {/* Icon picker grid — shown/hidden on tap */}
      {showPicker && <LucideIconPicker onSelect={setIcon} selected={icon} />}

      <Text style={{ fontSize: 15, color: textMuted }}>
        After I <Text bold>{draft.cueExisting}</Text>, I will <Text bold>{draft.tinyAction}</Text>
      </Text>
    </View>

    <Text micro>You can rename or change the icon anytime.</Text>
```

### Phase 2: Worst-Day Check (appears after tapping "Looks good")

When the user taps "Looks good":
1. Hide the headline + subtitle
2. Lock the name input and icon button (readOnly)
3. Show the "reassurance" text
4. Animate in Phase 2 content below the card:

```
    <Text headline>One last check.</Text>
    <Text eyebrow>Most people start too big and quit. This check helps you set a habit you'll actually keep.</Text>

    <Text headlineSm>Could you still do this on your worst day?</Text>
    <Text body>Imagine a low-energy day. Would this still feel doable?</Text>

    PrimaryButton(label="Yes, I could", showArrow, onPress=handlePass)
    SecondaryButton(label="Probably not — let me make it smaller", onPress=handleFail)
```

### OnboardingDraft changes

Add to `types.ts`:
```ts
export type OnboardingDraft = {
  // ... existing fields ...
  habitName: string;        // NEW
  habitIcon: string | null; // NEW — Lucide icon component name, e.g. "BookOpen"
};
```

Update `EMPTY_DRAFT`:
```ts
habitName: "",
habitIcon: null,
```

Update `KNOWN_DRAFT_KEYS` and `OnboardingStep`:
```ts
// Remove 'worst-day' step, replace with 'personalize'
export type OnboardingStep =
  | "welcome"
  | "becoming"
  | "daily-action"
  | "shrink"
  | "cue"
  | "personalize"  // was "worst-day"
  | "confirmation";
```

### LucideIconPicker sub-component

**File:** `src/features/onboarding/components/LucideIconPicker.tsx`

Grid layout following `docs/icon-set.md`:
- 4 columns
- Section headers for each category (8 categories, 60 icons total)
- Container: `bg: surface, borderRadius: 16, padding: 12`
- Each icon cell: `width: 38, height: 38, borderRadius: 10`
- Selected state: `bg: primarySoft` (#e8f5ee) background circle
- All icons rendered at `size: 18, color: primary, strokeWidth: 1.8`

### Navigation changes

**Router:** Rename `app/(onboarding)/worst-day.tsx` → `app/(onboarding)/personalize.tsx`

**CueScreen:** Update navigation target from `/(onboarding)/worst-day` to `/(onboarding)/personalize`

**Personalize handlePass:** Navigate to `/(onboarding)/confirmation`
**Personalize handleFail:** `router.replace("/(onboarding)/shrink")` (same as current worst-day)

### Files to delete
- `src/features/onboarding/screens/WorstDayCheckScreen.tsx` — replaced by PersonalizeScreen
- `src/features/onboarding/components/WorstDayCheck.tsx` — worst-day check is now inline in PersonalizeScreen

---

## Ticket 9: Confirmation Screen (`onboarding_s7`)

**File:** `src/features/onboarding/screens/ConfirmationScreen.tsx`

### Current state
ZenCard with RowLV label/value pairs + PrimaryButton.

### Target state (from `habitapp_onboarding_s7.html`)
Centered layout with logo, headline, summary card with icon + structured fields.

### Layout structure
```
OnboardingLayout:
  footer: PrimaryButton(label="Let's go", showArrow, onPress=handleStart)
  content:
    <View style={{ flex: 1, justifyContent: 'center' }}>
      {/* Centered header */}
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <AppLogo size={56} style={{ marginBottom: 20 }} />
        <Text headline center>Your first habit is ready.</Text>
        <Text body center>Everything you need to start becoming who you want to be — one small action at a time.</Text>
      </View>

      {/* Summary card */}
      <View style={{ bg: surfaceCard, borderRadius: 32, padding: 24, shadow: cardFloat }}>

        {/* Icon + name header */}
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 20 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, bg: primaryLight }}>
            <LucideIcon name={draft.habitIcon} size={20} color={primary} />
          </View>
          <View>
            <Text micro>Habit name</Text>
            <Text style={{ fontFamily: displayBold, fontSize: 17 }}>{draft.habitName}</Text>
          </View>
        </View>

        {/* Structured fields */}
        <SummaryField label="BECOMING" value={draft.becomingPhrase} />
        <SummaryField label="YOUR FORMULA"
          value={`After I ${draft.cueExisting}, I will ${draft.tinyAction}`}
          boldParts={[draft.cueExisting, draft.tinyAction]}
        />
        <SummaryField label="STARTS" value="Today" bold />
      </View>
    </View>
```

### Typography for summary fields
- Label: `fontSize: 11, color: primary, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.66`
- Value: `fontSize: 15, color: text, lineHeight: 21.75`

### Logic changes
- `handleStart` should now also persist `habitName` and `habitIcon` from the draft when calling `finalizeMutation`
- The finalization logic in `completion.ts` needs to pass `name` and `icon` to the habit insert

---

## Today Screen — DEFERRED

The `habitapp_today.html` design is deferred to S14-new (multi-habit Today). The Today screen reskin will ship alongside the multi-habit card structure, avoiding a double-refactor.

---

## Implementation Order

Recommended sequence for the dev team:

1. **Ticket 0** — Shared components + theme updates (blocks everything else)
2. **Ticket 3** — Onboarding Welcome (simplest screen, validates OnboardingLayout)
3. **Ticket 4** — Becoming (validates ChipSelector + OnboardingInput)
4. **Ticket 5** — Daily Action (validates GuidanceCard)
5. **Ticket 6** — Shrink
6. **Ticket 7** — Cue
7. **Ticket 8** — Personalize (most complex — new screen, merged flows, icon picker)
8. **Ticket 9** — Confirmation
9. **Ticket 1** — Entry Welcome (independent of onboarding)
10. **Ticket 2** — Sign-Up

---

## Testing Notes

- All existing onboarding tests should pass after reskin (logic unchanged)
- Add snapshot tests for new shared components (ProgressBar, BackButton, etc.)
- Manual test the full onboarding flow end-to-end after each screen ticket merges
- Verify keyboard behavior on input screens (S2–S5) — the bottom-pinned CTA should not be occluded
- Test chip selection → input population flow on Becoming screen
- Test the two-phase transition on Personalize screen (Phase 1 → Phase 2)
- Verify Lucide icon picker renders all 60 icons in correct categories
- Verify `habitName` and `habitIcon` persist through finalization and appear in Today screen

---

## Files Affected Summary

### New files
- `src/components/layouts/OnboardingLayout.tsx`
- `src/components/navigation/ProgressBar.tsx`
- `src/components/navigation/BackButton.tsx`
- `src/components/navigation/OnboardingHeader.tsx`
- `src/components/cards/GuidanceCard.tsx`
- `src/components/cards/GuidanceExample.tsx`
- `src/components/forms/OnboardingInput.tsx`
- `src/components/forms/ChipSelector.tsx`
- `src/components/branding/AppLogo.tsx`
- `src/features/onboarding/screens/PersonalizeScreen.tsx`
- `src/features/onboarding/components/LucideIconPicker.tsx`
- `app/(onboarding)/personalize.tsx`

### Modified files
- `src/theme/colors.ts` — token value updates
- `src/theme/shadows.ts` — new shadow tokens
- `src/components/buttons/PrimaryButton.tsx` — arrow icon, disabled style
- `src/features/entry/screens/WelcomeScreen.tsx` — full reskin
- `src/features/auth/screens/SignUpScreen.tsx` — full reskin
- `src/features/onboarding/screens/WelcomeScreen.tsx` — full reskin
- `src/features/onboarding/screens/BecomingScreen.tsx` — full reskin
- `src/features/onboarding/screens/DailyActionScreen.tsx` — full reskin
- `src/features/onboarding/screens/ShrinkScreen.tsx` — full reskin
- `src/features/onboarding/screens/CueScreen.tsx` — full reskin + nav target change
- `src/features/onboarding/screens/ConfirmationScreen.tsx` — full reskin
- `src/features/onboarding/types.ts` — new fields, step rename
- `src/features/onboarding/hooks.ts` — handle new draft fields
- `src/features/onboarding/completion.ts` — pass name + icon to habit insert

### Deleted files
- `src/features/onboarding/screens/WorstDayCheckScreen.tsx`
- `src/features/onboarding/components/WorstDayCheck.tsx`
- `app/(onboarding)/worst-day.tsx`
