# Sprint 10 — Followups

> Created: May 3, 2026 (S10 review)
> Owner: Tech Lead → Dev Team
> Format: same as sprint-8-followups.md

Items surfaced during S10 review that are non-critical. None are regressions — all are polish/optimization items acceptable for beta.

---

## F1 — Streak copy variants diverge from spec (P3, cosmetic)

**What:** The agreed spec (May 3 design session) defined 5 randomized variants for 2+ day streaks ("N days and counting" / "Showing up for N days" / "N days strong" / "Day N — keep going" / "N days of building"), 5 day-1 variants, "Start showing up today" for day 0, and "Start a new streak" for broken streaks. The implemented `streakCopy.ts` uses different copy ("Today is a fresh start", "Day one done. Come back tomorrow", "You've been at it for N days straight" etc.) and does not distinguish broken streak from day-0.

**Why acceptable for beta:** The implemented copy is warm and on-brand. The functional behavior (showing different copy per streak state) works correctly. The difference is cosmetic.

**Scope when it lands:** Update `streakCopy.ts` to match the spec variants if product review confirms the spec copy is preferred. Add broken-streak detection (streak was previously > 0, now 0) if the distinction matters for the identity anchor.

---

## F2 — Done-row opacity 0.6 vs spec 0.55 (P4, cosmetic)

**What:** `HabitRow` applies `opacity: 0.6` to logged rows. The design spec called for 0.55. Visual difference is negligible.

**Why acceptable for beta:** Imperceptible to users. Both values achieve the "recede when done" effect.

**Scope when it lands:** One-line change in `HabitRow.tsx` styles if 0.55 is confirmed.

---

## F3 — ConsistencyDonut uses flat color, not sage gradient stroke (P3, cosmetic)

**What:** The spec called for a "sage gradient stroke" on the consistency donut ring. The implementation uses a flat `colors.primary` stroke. Gradient strokes in `react-native-svg` require a `<LinearGradient>` `<Defs>` block inside the SVG, which is straightforward but wasn't implemented.

**Why acceptable for beta:** The flat sage color reads well. The gradient would be a subtle visual upgrade.

**Scope when it lands:** Add `<Defs><LinearGradient>` to `ConsistencyDonut.tsx` referencing the signature gradient (`#446655` → `#6b9e7d` at 135°). Small ticket.

---

## F4 — Lucide icon tree-shaking for bundle size (P3, optimization)

**What:** `HabitRow.tsx` imports `* as icons from "lucide-react-native"` and resolves icons by string name at runtime. This pulls the entire Lucide icon set into the bundle (~200+ icons). For beta this is fine. For production, either tree-shake to a curated subset or use a dynamic import strategy.

**Why acceptable for beta:** Bundle size impact is small relative to other Expo dependencies. No user-facing issue.

**Scope when it lands:** Create a `CURATED_ICONS` map in `src/features/onboarding/components/LucideIconPicker.tsx` (which already curates the picker list) and import only those icons. `HabitRow` resolves from the same map. Likely S20 (polish sprint) or post-launch.

---

## F5 — Sprint plan S12/S14 still reference Focus/Supporting model (P1, planning debt)

**What:** The sprint plan's S12 ("Supporting habit creation") and S14 ("Multi-habit Today") are written for the old Focus/Supporting paradigm that S10 dissolved. S12 references "Supporting worst-day gate as hard block", "Focus slot empty → Focus", and "habit_state IN ('focus','supporting')". S14 references "Focus gradient treatment vs Supporting subtle treatment" and "MissBanner triggers for Focus only". These specs are now invalid.

**Why flagged:** Not a code issue — the implemented code is correct. But these sprint plan entries will confuse anyone reading the plan. They need rewriting to reflect the goal-based peer-habit model before S12/S14 work begins.

**Action:** Rewrite S12 and S14 in sprint-plan.md when those sprints are scoped. S12 becomes "add habit to goal" (no Focus/Supporting distinction). S14 collapses into S10 (multi-habit Today is already implemented — S14 may be unnecessary or reduced to a polish pass).

---

*End of S10 followups.*
