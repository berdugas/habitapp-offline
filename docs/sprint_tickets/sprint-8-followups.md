# Sprint 8 — Followups

Deferred items from S8. None block S9 or the beta build. Priority ratings are relative to Core v1 completion.

---

## F1 — Bug #2 dual-card UX validation (P2, post-reviews-migration)

**What:** When both `tiny_action_too_hard` and `trigger_worked === false` fire, `HabitDetailScreen` now renders two separate suggestion cards in priority order. The fix is currently **inert in production** — `weekly_reviews` still queries the dropped Supabase table (see transitional state note in `PROJECT_BRAIN.md §11`), so `latestReview` is always null and no suggestion cards appear on real data. The layout has been verified at the screen-with-mocked-review level only.

**Action:** When weekly reviews migrates to local SQLite (Phase C, likely S11–S13), verify the two-card layout reads well with real data. If the card ordering or copy needs adjustment, promote this to a ticket in that sprint.

**Out of scope until then:** No code change needed in S9 or S10.

---

## F2 — AppState listener mock test for `useTrialValidationLifecycle` (P3, regression-triggered)

**What:** The foreground-revalidation path (AppState 'active' → stale cache → re-fetch) is exercised only via manual smoke. Adding a Jest case using a mock AppState event emitter would lock the path in CI.

**Action:** Add the test case to `src/features/trial/__tests__/hooks.test.tsx` when a regression on this path is suspected. Using `jest.spyOn(AppState, 'addEventListener')` + manually invoking the listener callback should be sufficient — see the existing spy pattern in that file.

---

## F3 — Onboarding under read-only edge case (P3, beta-triggered)

**What:** A user who signs up while offline will fail validation mid-onboarding. The spec says onboarding is not gated (recovery is a worse outcome than a slightly wrong read-only state), and the banner appears the moment they land on Today. This path has not been exercised manually.

**Action:** During beta smoke testing, test: sign up with airplane mode on → complete onboarding → verify banner appears on Today and onboarding flow was uninterrupted.

---

## F4 — Trial status copy review post-monetization (P3, monetization-sprint)

**What:** Settings shows `"Trial ended"` for `entitlement_status === 'expired'`. In Core v1 this is correct — trial expiry is not gated, so no action is required. When monetization ships (Phase D), a CTA ("Upgrade") should be considered.

**Action:** Revisit the trial status sub-line in Settings at the monetization sprint. At that point, loss-aversion framing (countdown or CTA) may earn its place because there's a real product action attached.

---

## F5 — ReadOnlyBanner animation polish (P3, S9 design pass)

**What:** The banner appears and disappears abruptly when `accessMode` flips. A subtle fade transition would align with the calm product voice.

**Action:** Consider adding a fade transition during the S9 visual design pass. Low priority — the banner's informational nature makes abrupt appearance acceptable for Core v1.
