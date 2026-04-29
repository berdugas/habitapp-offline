# Habits App — Product Strategy

> **Status:** Source of truth for product direction.
> **Date:** April 29, 2026
> **Owner:** Product Lead
> **Companion documents:** `core-v1-requirements.md`, `tech-handoff-core-v1.md`

---

## 1. What this product is

A calm, evidence-informed habit formation product that helps adults bridge the gap between who they want to become and what they actually do tomorrow morning. It is not a tracker. It is not a productivity app. It is not an AI coach. It is a thoughtful guide that translates aspiration into the smallest sustainable action — and supports the user as they build, one habit deeply, then another, for as long as they are growing.

## 2. The core insight

People do not fail to build habits because they lack a checklist; they fail because they have no bridge between who they want to be and what they do tomorrow morning.

Most habit apps offer the checklist. They ask "what do you want to track?" before they ask "who do you want to become?" — and they treat the daily mark of completion as the product's value. The science of habit formation suggests the opposite: the value lives in internalization over time, the gradual shift from conscious effort to automaticity, and the durable sense of becoming the kind of person who does this thing without thinking.

This product is built around that internalization, not around the act of tracking.

## 3. Who we serve

Our core user is an adult, self-improvement-aware person who has tried habit apps before and abandoned them. She does not want a game, a productivity cult, or another checklist. She wants a calm, thoughtful product that helps her translate who she wants to become into a small action she can actually repeat.

She is allergic to:
- Shallow gamification (badges, levels, mascots, sparkles)
- Hustle rhetoric ("crush your goals," "unlock potential")
- Engagement-maximizing mechanics
- Empty motivational copy

She values:
- Dignified design that talks to her like an adult
- Evidence over hype
- Calm, intentional progress
- The feeling of becoming someone, not completing tasks

We are explicitly not building, in this release, for: teenagers, users in clinical crisis, or gamification-loving casual users. They can be served later if at all.

## 4. The job-to-be-done

> Help me become the person I want to be, by translating that aspiration into the smallest possible action I can do tomorrow — and supporting me as I build, one habit deeply, then another, forever.

## 5. Our point of view

The habit-app category is crowded with products that look the same: lists of trackable behaviors, streak counters, charts, optional gamification. Most retain a small fraction of users past the first month. We take five contrarian positions:

**1. Most people fail at habits because they aspire too big and start too fast.** Our onboarding actively shrinks the user's starting ambition until the habit feels almost laughably small.

**2. The streak is broken by design in most apps.** A single missed day collapses 47 days of work to zero, triggering the "what-the-hell" effect. Our streak forgives one isolated miss; only consecutive misses break it. This matches what habit-formation research actually shows.

**3. Tracking many habits at once is correlated with building none of them.** We default to one focus habit. The architecture is a deliberate product constraint based on the belief that active habit formation requires limited attention.

**4. Habits are not destinations; they are foundations.** Once a habit becomes automatic, it does not graduate the user out of the product. It moves to a permanent library — a growing record of who the user has become. The next habit then begins.

**5. Identity drives sustained behavior more reliably than outcomes.** "Lose 10 pounds" is fragile. "Become someone who moves their body daily" is durable. We frame everything around the becoming.

## 6. Product principles

These are non-negotiable. Every feature decision flows from them.

1. **Becoming over tracking.** The product centers who the user is becoming, not what she is tracking.
2. **Forgiving momentum.** No fragile streaks. The streak survives one isolated miss; it breaks only on two consecutive misses.
3. **One habit, deeply.** Default to one focus habit. Recommend at most three active habits total.
4. **Compound, do not graduate.** Once a habit becomes automatic, it joins the user's permanent library and the next focus begins.
5. **Cue design is a first-class feature.** Every habit is anchored to an existing routine, not a clock time.
6. **Smaller than she thinks.** Onboarding shrinks ambition to a starting size that feels almost laughably easy.
7. **Make invisible progress visible.** Identity-flavored feedback, heatmap, history. Not just numbers.
8. **Built for real life.** Sick days, travel, hard weeks are expected, not punished.
9. **Ruthlessly low log friction.** One tap to log. No required mood scores or notes.
10. **Honest about limits.** When patterns suggest something deeper than habits, surface it gently — without pretending to be therapy.
11. **No casino mechanics.** No streak-loss anxiety, no FOMO, no engagement-maximizing notifications.
12. **Private by default.** The user's habit history is personal. In Core v1, habit data lives on the user's device — not on our servers. The server handles account access and trial validation only. This is a product principle, not just a feature.

## 7. The core product loop

The full product experience, in one line:

> Become → Shrink → Cue → Show up → Recover → Become automatic → Choose next

Expanded:

1. **Become.** The user articulates who she wants to become.
2. **Shrink.** She translates that into a daily action, then we help her shrink it.
3. **Cue.** She anchors the action to an existing routine.
4. **Show up.** She does it daily, logs it in one tap, gets identity-flavored feedback.
5. **Recover.** When she misses, the product reframes the miss as normal and supports return — not panic.
6. **Become automatic.** When the habit feels effortless, she completes a brief reflection ceremony.
7. **Choose next.** The habit moves to her Automatic Library; she picks the next becoming step.

The Automatic Library is the long-term emotional core of the product. Many habit apps lose meaning once the user stops tracking. Ours grows in meaning over time — it is the user's living record of who she has become.

## 8. Brand voice

We sit at the intersection of: evidence-based, adult, quiet, dignified, warm.

We use language like:
- "Show up as someone who runs."
- "What does the version of you who reads do tomorrow morning?"
- "You've been a runner for 47 days."
- "You missed yesterday. The science says it didn't matter. Keep going."
- "This habit feels automatic now. Ready for what's next?"

We do not use:
- "Crush your goals." "Unlock your potential." "You got this!"
- Streak-loss panic copy.
- Cute mascots, achievement badges, levels, sparkles.

The product talks to the user the way a thoughtful, well-read friend would. Not a coach. Not a cheerleader. Not a parent.

## 9. What we will not be

To stay clear about what we are, here is what we will not become:

- **A gamified daily challenge app.** Badges, streaks-as-currency, leaderboards, and avatars are not on our roadmap for Core v1. Future proposals in this category must prove they support calm habit formation rather than addictive engagement.
- **A productivity tool.** This is not a to-do app. We do not handle errands, projects, or one-off tasks.
- **A coach masquerading as software.** The product surfaces evidence-grounded suggestions, but it does not pretend to be a person. It does not adopt a personality. It does not give unsolicited advice.
- **A therapy app.** When user behavior suggests something deeper than habits — chronic struggle, signs of distress — we surface that gently. We never claim to treat or diagnose.
- **An AI wrapper.** AI is not part of Core v1. It may be added later, and only where it improves habit design, reflection, or support — never as a marketing veneer.
- **A cloud-data product (in Core v1).** Your habits, logs, and library live on your device. We do not upload them. Account access and trial validation are the only things we keep server-side. Optional cloud backup may come later as an opt-in feature, never as a default.

## 10. Strategic horizon

**Core v1** is the first complete non-AI product release. It validates that the becoming-bridge thesis works for real users at scale and earns the right to expand the surface later. Full requirements are in `core-v1-requirements.md`.

**Private Beta** is the first stage of Core v1 — a smaller surface delivered in 2–3 weeks to invited testers. Its purpose is fast learning before the full Core v1 release.

**Beyond Core v1** (not in scope of this document):
- Optional cloud backup of habit data — preserves the local-first model, adds resilience for users who lose devices
- Optional AI features that genuinely support habit design and reflection
- Expanded Automatic Library views (yearly, lifetime, identity categories)
- Habit suggestions and templates
- Reflection prompts beyond the weekly review
- Possible accountability features that respect the no-comparison principle

We will not roadmap these in detail until Core v1 has proven the core thesis with real users.

---

*End of strategy. Living document — update when material direction changes.*
