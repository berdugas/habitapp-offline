# Design System Document: Habitapp

## 1. Overview & Creative North Star
The objective of this design system is to transform habit tracking from a chore into a ritual. Most productivity apps create "checklist anxiety" through dense grids and high-contrast borders. We are moving in the opposite direction.

**Creative North Star: Habitapp.**
This system treats the mobile screen as an editorial layout—think high-end wellness periodicals. It rejects the "app-y" look of boxes and buttons in favor of organic flow, intentional asymmetry, and extreme breathing room. We prioritize the "Single Primary Action" (SPA) philosophy: every screen exists to serve one breath, one thought, or one action.

By leveraging sophisticated tonal layering and a dual-typeface system, we create an experience that feels quiet, premium, and low-pressure.

---

## 2. Colors & Surface Philosophy
The palette is rooted in nature and warmth, moving away from clinical whites toward a "paper-like" tactile quality.

### The "No-Line" Rule
To maintain a high-end editorial feel, **1px solid borders are strictly prohibited for sectioning.** Boundaries must be created through:
*   **Tonal Shifts:** Placing a `surface-container-low` element against a `surface` background.
*   **Negative Space:** Using the Spacing Scale to create "islands" of content.

### Surface Hierarchy & Nesting
We treat the UI as physical layers of fine paper. 
*   **Base:** `surface` (#fbf9f5)
*   **Sections:** Use `surface-container-low` for large content blocks.
*   **Interactive Cards:** Use `surface-container-lowest` (#ffffff) to make habit cards feel like they are floating slightly above the page.

### The "Glass & Gradient" Rule
Standard flat colors can feel sterile. For primary actions and progress indicators, use a subtle linear gradient:
*   **Signature Gradient:** `primary` (#446655) transitioning to `primary-container` (#c6ebd5) at a 135-degree angle.
*   **Glassmorphism:** For floating navigation or modal overlays, use `surface` at 80% opacity with a `20px` backdrop blur to allow the warm background tones to bleed through.

---

## 3. Typography: The Editorial Voice
We use two distinct typefaces to balance character with extreme readability.

*   **Display & Headlines (Plus Jakarta Sans):** These are our "Editorial" voices. Use `display-lg` and `headline-lg` with generous bottom margins to introduce screens. This typeface provides a modern, geometric confidence that feels premium.
*   **Body & Titles (Manrope):** This is our "Functional" voice. Manrope is highly legible at small sizes. For `body-lg`, increase the letter-spacing by `+0.02rem` to enhance the "spacious" feel requested.

**Hierarchy Note:** 
Always lead with a `headline-lg` that summarizes the user's state (e.g., "Good morning, stay grounded.") followed by `body-lg` for secondary context. Never crowd the headline; let it own the top 25% of the screen.

---

## 4. Elevation & Depth: Tonal Layering
Traditional shadows are often too "heavy" for a calm aesthetic. We utilize **Ambient Depth.**

*   **The Layering Principle:** Instead of shadows, nest containers. A `surface-container-highest` element inside a `surface-container` provides enough contrast to denote hierarchy without visual noise.
*   **Ambient Shadows:** Where floating is required (e.g., a primary Floating Action Button), use a shadow color tinted with the primary hue: `rgba(68, 102, 85, 0.08)` with a `32px` blur and `8px` vertical offset. This creates a soft "glow" rather than a dark drop-shadow.
*   **The Ghost Border Fallback:** If high-contrast accessibility is required, use a "Ghost Border": `outline-variant` (#b2b2ad) at **15% opacity**. It should be felt, not seen.

---

## 5. Components

### Buttons
*   **Primary:** Pill-shaped (`rounded-full`). Use the Signature Gradient. Padding should be a generous `1.25rem` vertical and `2.5rem` horizontal.
*   **Secondary:** `surface-container-highest` background with `on-surface` text. No border.
*   **Tertiary:** Text-only in `primary` weight, used for "Skip" or "Cancel" to minimize pressure.

### Habit Cards
*   **Styling:** Use `rounded-lg` (2rem). Avoid dividers.
*   **Interaction:** On tap, the card should scale down slightly (`scale-95`) and transition to a slightly deeper tonal surface (`surface-container-high`) to provide tactile feedback without harsh color changes.

### Progress Indicators
*   Avoid the "loading bar" look. Use organic, soft-edged circles or thick, rounded lines (`rounded-full`) in `secondary-fixed-dim`. 

### Input Fields
*   **The "Invisible" Input:** Instead of a boxed field, use a `surface-container-low` background with a `rounded-md` (1.5rem) corner. The label should use `label-md` in `on-surface-variant`, sitting `0.5rem` above the field.

### Specialized Component: The "Zen Focus" Header
A large-format component for the home screen. A `display-sm` headline on the left, and a single, large `primary` icon button on the right representing the "Habit of the Day." This enforces the "Single Primary Action" rule.

---

## 6. Do's and Don'ts

### Do
*   **Do** use `surface-container-lowest` (#ffffff) to highlight the single most important card on a screen.
*   **Do** embrace asymmetry. An off-center headline can make the app feel like a bespoke journal rather than a generic tool.
*   **Do** provide at least `24px` of padding between the screen edge and any content.

### Don't
*   **Don't** use pure black (#000000) for text. Always use `on-background` (charcoal) to maintain the gentle aesthetic.
*   **Don't** use standard "Success Green" (#00FF00) for completed habits. Use the muted `primary` (#446655).
*   **Don't** use dividers or lines to separate list items. Use vertical white space (`1.5rem` to `2rem`) to create natural groupings.
*   **Don't** crowd the screen. If more than three tasks are visible, use a "See more" tonal shift to hide complexity.

---

## 7. Token Reference Summary

| Token | Value | Usage |
| :--- | :--- | :--- |
| Background | #fbf9f5 | Main app canvas |
| Primary | #446655 | Signature actions / Success states |
| On-Surface | #31332f | All primary reading text |
| Rounded-XL | 3rem | Oversized "Zen" containers |
| Rounded-MD | 1.5rem | Standard cards and inputs |
| Shadow (Soft) | 8px 16px 32px rgba(49, 51, 47, 0.05) | Ambient lift for interactive elements |
