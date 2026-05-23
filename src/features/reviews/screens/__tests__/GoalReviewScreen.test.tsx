import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const mockRouterReplace = jest.fn();
const mockRouterBack = jest.fn(() => navigateBack());
const mockUseGoalWeekSummary = jest.fn();
const mockApplyTuneUpMutateAsync = jest.fn();
const mockUpsertGoalReviewsMutateAsync = jest.fn();
const mockGetLatestWeeklyReviewsForHabits = jest.fn();
const mockNavigationDispatch = jest.fn();
const mockNavigationListeners: ((event: unknown) => void)[] = [];
const mockActualPop = jest.fn();
const mockIsWeeklyReviewFirstRunCompleted = jest.fn();
const mockMarkWeeklyReviewFirstRunCompleted = jest.fn();
const mockTrackEvent = jest.fn();
const mockLoggerWarn = jest.fn();

function navigateBack(): void {
  let prevented = false;
  const event = {
    data: { action: { type: "POP" } },
    preventDefault: () => {
      prevented = true;
    },
  };
  for (const cb of mockNavigationListeners) cb(event);
  if (!prevented) mockActualPop();
}

// Direct beforeRemove fire — used by tests for hardware back / iOS
// swipe-back simulations that need to inspect whether preventDefault
// was called.
function emitBeforeRemove(): {
  preventDefault: jest.Mock;
  data: { action: unknown };
} {
  const event = {
    data: { action: { type: "POP" } },
    preventDefault: jest.fn(),
  };
  for (const cb of mockNavigationListeners) cb(event);
  return event;
}

jest.mock("expo-router", () => ({
  router: {
    back: () => mockRouterBack(),
    replace: (...args: unknown[]) => mockRouterReplace(...args),
  },
  useLocalSearchParams: () => ({
    identityPhrase: "a%20stoic",
    returnTo: "goalDetail",
  }),
  useNavigation: () => ({
    addListener: (event: string, cb: (e: unknown) => void) => {
      if (event === "beforeRemove") {
        mockNavigationListeners.push(cb);
        return () => {
          const i = mockNavigationListeners.indexOf(cb);
          if (i >= 0) mockNavigationListeners.splice(i, 1);
        };
      }
      return () => {};
    },
    dispatch: (...args: unknown[]) => mockNavigationDispatch(...args),
  }),
}));

jest.mock("@/features/auth/hooks", () => ({
  useAuthSession: () => ({ user: { id: "user-1" } }),
}));

jest.mock("@/features/reviews/useGoalWeekSummary", () => ({
  useGoalWeekSummary: (...args: unknown[]) => mockUseGoalWeekSummary(...args),
}));

jest.mock("@/features/reviews/api", () => ({
  getLatestWeeklyReviewsForHabits: (...args: unknown[]) =>
    mockGetLatestWeeklyReviewsForHabits(...args),
}));

jest.mock("@/features/reviews/hooks", () => ({
  useApplyTuneUpMutation: () => ({
    mutateAsync: (...args: unknown[]) => mockApplyTuneUpMutateAsync(...args),
    isPending: false,
  }),
  useUpsertGoalReviewsMutation: () => ({
    mutateAsync: (...args: unknown[]) =>
      mockUpsertGoalReviewsMutateAsync(...args),
    isPending: false,
  }),
}));

jest.mock("@/components/LucideIconPicker", () => ({
  LucideIcon: () => null,
  LucideIconPicker: () => null,
}));

jest.mock("@/features/reviews/onboardingStorage", () => ({
  isWeeklyReviewFirstRunCompleted: () => mockIsWeeklyReviewFirstRunCompleted(),
  markWeeklyReviewFirstRunCompleted: () =>
    mockMarkWeeklyReviewFirstRunCompleted(),
}));

jest.mock("@/services/analytics", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

jest.mock("@/services/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: jest.fn(),
  },
}));

import GoalReviewScreen from "@/features/reviews/screens/GoalReviewScreen";
import { getWeekStartDateString } from "@/utils/dates";

import type {
  GoalWeekSummary,
  HabitWeekSummary,
} from "@/features/reviews/buildGoalWeekSummary";

// The screen reads its weekStart from `getWeekStartDateString()` at
// runtime. Tests that fabricate persisted-review rows need to use the
// SAME value so the screen's `dbRow.week_start === weekStart` check
// recognizes them as current-week rows. Computed once at module load.
const CURRENT_WEEK_START = getWeekStartDateString();

function makeHabitSummary(
  overrides: Partial<HabitWeekSummary> = {},
): HabitWeekSummary {
  return {
    habitId: "h1",
    title: "Walk daily",
    icon: null,
    formula: "after coffee → put on shoes",
    cue: "after coffee",
    tinyAction: "put on shoes",
    identityPhrase: "stoic",
    activeDays: [1, 2, 3, 4, 5, 6, 7],
    weekLogs: [
      { date: "2026-04-27", dayOfWeek: 1, status: "done", isActiveDay: true },
      { date: "2026-04-28", dayOfWeek: 2, status: "done", isActiveDay: true },
      { date: "2026-04-29", dayOfWeek: 3, status: "done", isActiveDay: true },
      { date: "2026-04-30", dayOfWeek: 4, status: "done", isActiveDay: true },
      { date: "2026-05-01", dayOfWeek: 5, status: "done", isActiveDay: true },
      { date: "2026-05-02", dayOfWeek: 6, status: "done", isActiveDay: true },
      { date: "2026-05-03", dayOfWeek: 7, status: "done", isActiveDay: true },
    ],
    doneCount: 7,
    missCount: 0,
    skipCount: 0,
    activeDayCount: 7,
    weekConsistency: 1,
    isStrong: true,
    needsAttention: false,
    ...overrides,
  };
}

function attentionHabit(
  overrides: Partial<HabitWeekSummary> = {},
): HabitWeekSummary {
  return makeHabitSummary({
    habitId: "h-attn",
    title: "Run",
    cue: "morning coffee",
    tinyAction: "run for 2 minutes",
    weekLogs: [
      { date: "2026-04-27", dayOfWeek: 1, status: "missed", isActiveDay: true },
      { date: "2026-04-28", dayOfWeek: 2, status: "missed", isActiveDay: true },
      { date: "2026-04-29", dayOfWeek: 3, status: "missed", isActiveDay: true },
      { date: "2026-04-30", dayOfWeek: 4, status: "missed", isActiveDay: true },
      { date: "2026-05-01", dayOfWeek: 5, status: "missed", isActiveDay: true },
      { date: "2026-05-02", dayOfWeek: 6, status: "done", isActiveDay: true },
      { date: "2026-05-03", dayOfWeek: 7, status: "done", isActiveDay: true },
    ],
    doneCount: 2,
    missCount: 5,
    skipCount: 0,
    weekConsistency: 2 / 7,
    isStrong: false,
    needsAttention: true,
    ...overrides,
  });
}

function makeSummary(habits: HabitWeekSummary[]): GoalWeekSummary {
  const strongHabits = habits.filter((h) => h.isStrong);
  const attentionHabits = habits.filter((h) => h.needsAttention);
  return {
    identityPhrase: "stoic",
    habits,
    overallDoneCount: habits.reduce((n, h) => n + h.doneCount, 0),
    overallActiveDayCount: habits.reduce((n, h) => n + h.activeDayCount, 0),
    overallConsistency: 0,
    strongHabits,
    attentionHabits,
    totalActiveDaysInWeek: 7,
    totalDaysShowedUp: 7,
    oldestActiveDaysCount: 42,
  };
}

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <GoalReviewScreen />
    </QueryClientProvider>,
  );
}

async function renderAndSettle() {
  const result = renderScreen();
  await act(async () => {
    await flushAsync();
  });
  return result;
}

async function flushAsync() {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  mockNavigationListeners.length = 0;
  mockRouterBack.mockImplementation(() => navigateBack());
  // Default: repeat-user world (no first-run banners). Individual tests
  // for the first-run path override these.
  mockIsWeeklyReviewFirstRunCompleted.mockResolvedValue(true);
  mockMarkWeeklyReviewFirstRunCompleted.mockResolvedValue(true);
  mockApplyTuneUpMutateAsync.mockResolvedValue({
    review: { habit_id: "h-attn", week_start: "2026-05-04" },
    habit: null,
  });
  mockUpsertGoalReviewsMutateAsync.mockResolvedValue([]);
  // Default: no persisted reviews exist (fresh review session).
  // Individual tests override for the re-entry case.
  mockGetLatestWeeklyReviewsForHabits.mockResolvedValue(new Map());
});

describe("GoalReviewScreen — new per-Tune-Up flow", () => {
  it("renders the loading state while the summary query is loading", () => {
    mockUseGoalWeekSummary.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });
    renderScreen();
    expect(screen.getByText("Loading your week...")).toBeTruthy();
  });

  it("renders an error state when the summary query errors", async () => {
    mockUseGoalWeekSummary.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error("boom"),
    });
    await renderAndSettle();
    expect(
      screen.getByText("We couldn't load your week. Try again."),
    ).toBeTruthy();
  });

  it("starts on Week Overview and shows the dynamic headline + agenda preview", async () => {
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary([makeHabitSummary(), attentionHabit()]),
      isLoading: false,
      error: null,
    });
    await renderAndSettle();
    expect(screen.getByText("YOUR WEEK")).toBeTruthy();
    // Dynamic headline reflects the mixed strong/attention split.
    expect(screen.getByText("A mixed week.")).toBeTruthy();
    // Agenda preview names the count of attention habits.
    expect(
      screen.getByText("Next: see what worked, then adjust 1 habit."),
    ).toBeTruthy();
  });

  it("advances Overview → What's Working → Tune-Up when a strong habit + attention habit are present", async () => {
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary([makeHabitSummary(), attentionHabit()]),
      isLoading: false,
      error: null,
    });
    await renderAndSettle();

    fireEvent.press(screen.getByText("Continue"));
    expect(screen.getByText("What's working")).toBeTruthy();

    fireEvent.press(screen.getByText("Continue"));
    // Tune-Up eyebrow names the in-loop position.
    expect(screen.getByText("TUNE-UP · 1 OF 1")).toBeTruthy();
    expect(screen.getByText("Did your trigger work?")).toBeTruthy();
    expect(screen.getByText("Was the tiny action too hard?")).toBeTruthy();
  });

  it("skips Step 2 'What's Working' when no strong habits", async () => {
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary([attentionHabit()]),
      isLoading: false,
      error: null,
    });
    await renderAndSettle();

    fireEvent.press(screen.getByText("Continue"));
    // Directly into the tune-up, no What's Working in between.
    expect(screen.queryByText("What's working")).toBeNull();
    expect(screen.getByText("TUNE-UP · 1 OF 1")).toBeTruthy();
  });

  it("skips the tune-up loop entirely when no attention habits (clean week)", async () => {
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary([makeHabitSummary()]),
      isLoading: false,
      error: null,
    });
    await renderAndSettle();

    fireEvent.press(screen.getByText("Continue")); // overview → whats_working
    expect(screen.getByText("What's working")).toBeTruthy();

    fireEvent.press(screen.getByText("Continue")); // whats_working → clean_week_affirmation
    // Clean-week flow surfaces a single Affirmation screen between
    // What's Working and Complete. Continue advances without writes;
    // catch-up at Complete fills empty rows for every habit.
    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
      await flushAsync();
    });
    expect(screen.getByText("WEEK REVIEWED")).toBeTruthy();
    // N=0 footnote variant.
    expect(
      screen.getByText("No changes this week — it's working."),
    ).toBeTruthy();
  });

  it("Apply on a Tune-Up calls the mutation and advances to the next step", async () => {
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary([attentionHabit()]),
      isLoading: false,
      error: null,
    });
    await renderAndSettle();
    fireEvent.press(screen.getByText("Continue")); // → tune-up

    // Answer both Y/N to enable Apply.
    // Yes/Yes produces make_tiny_action_smaller (mutable) for this habit's
    // weekConsistency, so the editable tiny-action field renders and the
    // Apply button is enabled without requiring free-text content.
    fireEvent.press(screen.getByLabelText("Did your trigger work?: Yes"));
    fireEvent.press(
      screen.getByLabelText("Was the tiny action too hard?: Yes"),
    );

    await act(async () => {
      fireEvent.press(screen.getByText("Apply & continue"));
      await flushAsync();
    });

    await waitFor(() => {
      expect(screen.getByText("WEEK REVIEWED")).toBeTruthy();
    });

    expect(mockApplyTuneUpMutateAsync).toHaveBeenCalledTimes(1);
    const payload = mockApplyTuneUpMutateAsync.mock.calls[0][0];
    expect(payload.habitId).toBe("h-attn");
    expect(payload.triggerWorked).toBe(true);
    expect(payload.tinyActionTooHard).toBe(true);
  });

  it("Skip on a Tune-Up writes a no-patch row and advances", async () => {
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary([attentionHabit()]),
      isLoading: false,
      error: null,
    });
    await renderAndSettle();
    fireEvent.press(screen.getByText("Continue")); // → tune-up

    // Answer both Y/N so the Skip becomes visible (it's inside the
    // revealed region per the placeholder pattern).
    // Yes/Yes produces make_tiny_action_smaller (mutable) for this habit's
    // weekConsistency, so the editable tiny-action field renders and the
    // Apply button is enabled without requiring free-text content.
    fireEvent.press(screen.getByLabelText("Did your trigger work?: Yes"));
    fireEvent.press(
      screen.getByLabelText("Was the tiny action too hard?: Yes"),
    );

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Skip this habit"));
      await flushAsync();
    });

    await waitFor(() => {
      expect(screen.getByText("WEEK REVIEWED")).toBeTruthy();
    });

    expect(mockApplyTuneUpMutateAsync).toHaveBeenCalledTimes(1);
    const payload = mockApplyTuneUpMutateAsync.mock.calls[0][0];
    expect(payload.habitId).toBe("h-attn");
    expect(payload.habitPatch).toBeUndefined();
    expect(payload.adjustmentNote).toBe("");
  });

  it("on Apply success during the first review, marks the first-run flag once", async () => {
    mockIsWeeklyReviewFirstRunCompleted
      .mockResolvedValueOnce(false) // mount-effect read
      .mockResolvedValueOnce(false); // apply-path authoritative re-read
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary([attentionHabit()]),
      isLoading: false,
      error: null,
    });
    await renderAndSettle();
    fireEvent.press(screen.getByText("Continue"));

    // Yes/Yes produces make_tiny_action_smaller (mutable) for this habit's
    // weekConsistency, so the editable tiny-action field renders and the
    // Apply button is enabled without requiring free-text content.
    fireEvent.press(screen.getByLabelText("Did your trigger work?: Yes"));
    fireEvent.press(
      screen.getByLabelText("Was the tiny action too hard?: Yes"),
    );

    await act(async () => {
      fireEvent.press(screen.getByText("Apply & continue"));
      await flushAsync();
    });

    expect(mockMarkWeeklyReviewFirstRunCompleted).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith(
      "weekly_review_first_run_completed",
    );
  });

  it("does NOT attempt the first-run mark for a repeat user (mount read returns completed)", async () => {
    mockIsWeeklyReviewFirstRunCompleted.mockResolvedValue(true);
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary([attentionHabit()]),
      isLoading: false,
      error: null,
    });
    await renderAndSettle();
    fireEvent.press(screen.getByText("Continue"));

    // Yes/Yes produces make_tiny_action_smaller (mutable) for this habit's
    // weekConsistency, so the editable tiny-action field renders and the
    // Apply button is enabled without requiring free-text content.
    fireEvent.press(screen.getByLabelText("Did your trigger work?: Yes"));
    fireEvent.press(
      screen.getByLabelText("Was the tiny action too hard?: Yes"),
    );

    await act(async () => {
      fireEvent.press(screen.getByText("Apply & continue"));
      await flushAsync();
    });

    expect(mockMarkWeeklyReviewFirstRunCompleted).not.toHaveBeenCalled();
  });

  it("Complete step shows the singular footnote after one Apply", async () => {
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary([attentionHabit()]),
      isLoading: false,
      error: null,
    });
    mockApplyTuneUpMutateAsync.mockResolvedValueOnce({
      review: { habit_id: "h-attn", week_start: CURRENT_WEEK_START },
      habit: { id: "h-attn" },
    });
    await renderAndSettle();
    fireEvent.press(screen.getByText("Continue"));

    // Yes/Yes produces make_tiny_action_smaller (mutable) for this habit's
    // weekConsistency, so the editable tiny-action field renders and the
    // Apply button is enabled without requiring free-text content.
    fireEvent.press(screen.getByLabelText("Did your trigger work?: Yes"));
    fireEvent.press(
      screen.getByLabelText("Was the tiny action too hard?: Yes"),
    );

    await act(async () => {
      fireEvent.press(screen.getByText("Apply & continue"));
      await flushAsync();
    });

    // New footnote — singular form for one applied change.
    expect(
      screen.getByText("One small change, made on purpose."),
    ).toBeTruthy();
  });

  it("chevron on a clean tune-up steps back to the previous step (does not exit)", async () => {
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary([makeHabitSummary(), attentionHabit()]),
      isLoading: false,
      error: null,
    });
    await renderAndSettle();
    fireEvent.press(screen.getByText("Continue")); // → whats_working
    fireEvent.press(screen.getByText("Continue")); // → tune-up

    expect(screen.getByText("TUNE-UP · 1 OF 1")).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Go back a step"));
      await flushAsync();
    });

    // Stepped back to What's Working — review still active, no exit.
    expect(screen.getByText("What's working")).toBeTruthy();
    expect(mockActualPop).not.toHaveBeenCalled();
  });

  it("chevron on a dirty tune-up shows a confirmation Alert before stepping back", async () => {
    const alertSpy = jest
      .spyOn(require("react-native").Alert, "alert")
      .mockImplementation(() => {});
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary([makeHabitSummary(), attentionHabit()]),
      isLoading: false,
      error: null,
    });
    await renderAndSettle();
    fireEvent.press(screen.getByText("Continue")); // → whats_working
    fireEvent.press(screen.getByText("Continue")); // → tune-up

    // Make the tune-up dirty.
    fireEvent.press(screen.getByLabelText("Did your trigger work?: No"));

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Go back a step"));
      await flushAsync();
    });

    expect(alertSpy).toHaveBeenCalled();
    expect(alertSpy.mock.calls[0][0]).toBe("Leave this tune-up?");
    // Still on the tune-up — the alert is asking; Leave hasn't been
    // tapped (the mock implementation is no-op).
    expect(screen.getByText("TUNE-UP · 1 OF 1")).toBeTruthy();

    alertSpy.mockRestore();
  });

  it("chevron on Complete steps back to the previous Tune-Up; the previous step's saved Y/N pre-fills", async () => {
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary([attentionHabit({ habitId: "h-attn" })]),
      isLoading: false,
      error: null,
    });
    await renderAndSettle();
    fireEvent.press(screen.getByText("Continue")); // → tune-up

    fireEvent.press(screen.getByLabelText("Did your trigger work?: No"));
    fireEvent.press(screen.getByLabelText("Was the tiny action too hard?: Yes"));
    await act(async () => {
      fireEvent.press(screen.getByText("Apply & continue"));
      await flushAsync();
    });
    await waitFor(() => {
      expect(screen.getByText("WEEK REVIEWED")).toBeTruthy();
    });

    // Step back from Complete.
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Go back a step"));
      await flushAsync();
    });

    // Back on the tune-up; saved diagnostics pre-fill (the No / Yes
    // selected states are present via the NullableBooleanField's
    // "selected" suffix in its accessibility label).
    expect(screen.getByText("TUNE-UP · 1 OF 1")).toBeTruthy();
    expect(
      screen.getByLabelText("Did your trigger work?: No selected"),
    ).toBeTruthy();
    expect(
      screen.getByLabelText("Was the tiny action too hard?: Yes selected"),
    ).toBeTruthy();
  });

  it("hardware back during pending catch-up is blocked by beforeRemove (preventDefault)", async () => {
    let resolveCatchUp: (v: unknown[]) => void = () => {};
    mockUpsertGoalReviewsMutateAsync.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCatchUp = resolve;
      }),
    );
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary([makeHabitSummary()]),
      isLoading: false,
      error: null,
    });
    await renderAndSettle();
    fireEvent.press(screen.getByText("Continue")); // → whats_working
    fireEvent.press(screen.getByText("Continue")); // → clean_week_affirmation
    await act(async () => {
      fireEvent.press(screen.getByText("Continue")); // → complete (catch-up fires)
      await flushAsync();
    });

    // Simulate hardware back / swipe-back (fires beforeRemove directly).
    const event = emitBeforeRemove();
    expect(event.preventDefault).toHaveBeenCalled();
    expect(mockActualPop).not.toHaveBeenCalled();

    // Resolve catch-up; a subsequent hardware-back should now allow exit.
    await act(async () => {
      resolveCatchUp([]);
      await flushAsync();
    });
    const cleanEvent = emitBeforeRemove();
    expect(cleanEvent.preventDefault).not.toHaveBeenCalled();
  });

  it("writes empty rows for every habit on a clean week (no attention habits) when entering Complete", async () => {
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary([
        makeHabitSummary({ habitId: "h-strong-1", title: "Drink water" }),
        makeHabitSummary({ habitId: "h-strong-2", title: "Stretch" }),
      ]),
      isLoading: false,
      error: null,
    });
    await renderAndSettle();
    fireEvent.press(screen.getByText("Continue")); // overview → whats_working
    fireEvent.press(screen.getByText("Continue")); // whats_working → clean_week_affirmation
    await act(async () => {
      fireEvent.press(screen.getByText("Continue")); // → complete (catch-up fires)
      await flushAsync();
    });

    await waitFor(() => {
      expect(mockUpsertGoalReviewsMutateAsync).toHaveBeenCalledTimes(1);
    });
    const payloads = mockUpsertGoalReviewsMutateAsync.mock.calls[0][0];
    expect(payloads).toHaveLength(2);
    expect(payloads.map((p: { habitId: string }) => p.habitId).sort()).toEqual([
      "h-strong-1",
      "h-strong-2",
    ]);
    for (const p of payloads) {
      expect(p.triggerWorked).toBeNull();
      expect(p.tinyActionTooHard).toBeNull();
      expect(p.adjustmentNote).toBe("");
    }
  });

  it("on a mixed week writes catch-up rows only for habits not covered by the Tune-Up loop", async () => {
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary([
        makeHabitSummary({ habitId: "h-strong", title: "Drink water" }),
        attentionHabit({ habitId: "h-attn" }),
      ]),
      isLoading: false,
      error: null,
    });
    await renderAndSettle();
    fireEvent.press(screen.getByText("Continue")); // → whats_working
    fireEvent.press(screen.getByText("Continue")); // → tune-up

    fireEvent.press(screen.getByLabelText("Did your trigger work?: Yes"));
    fireEvent.press(screen.getByLabelText("Was the tiny action too hard?: Yes"));
    await act(async () => {
      fireEvent.press(screen.getByText("Apply & continue"));
      await flushAsync();
    });

    await waitFor(() => {
      expect(mockUpsertGoalReviewsMutateAsync).toHaveBeenCalledTimes(1);
    });
    const payloads = mockUpsertGoalReviewsMutateAsync.mock.calls[0][0];
    expect(payloads).toHaveLength(1);
    expect(payloads[0].habitId).toBe("h-strong"); // attention habit already covered
  });

  it("hides the Done button while the catch-up write is pending and shows it on success", async () => {
    let resolveCatchUp: (v: unknown[]) => void = () => {};
    mockUpsertGoalReviewsMutateAsync.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCatchUp = resolve;
      }),
    );
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary([makeHabitSummary()]),
      isLoading: false,
      error: null,
    });
    await renderAndSettle();
    fireEvent.press(screen.getByText("Continue")); // → whats_working
    fireEvent.press(screen.getByText("Continue")); // → clean_week_affirmation
    await act(async () => {
      fireEvent.press(screen.getByText("Continue")); // → complete (catch-up fires)
      await flushAsync();
    });

    // Pending: saving indicator visible, Done hidden.
    expect(screen.getByText("Saving your review…")).toBeTruthy();
    expect(screen.queryByText("Done")).toBeNull();

    // Resolve the catch-up write. Done should appear.
    await act(async () => {
      resolveCatchUp([]);
      await flushAsync();
    });
    await waitFor(() => {
      expect(screen.getByText("Done")).toBeTruthy();
    });
    expect(screen.queryByText("Saving your review…")).toBeNull();
  });

  it("shows Retry on catch-up failure; retry replays the batch and surfaces Done on success", async () => {
    mockUpsertGoalReviewsMutateAsync
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce([]);
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary([makeHabitSummary()]),
      isLoading: false,
      error: null,
    });
    await renderAndSettle();
    fireEvent.press(screen.getByText("Continue")); // → whats_working
    fireEvent.press(screen.getByText("Continue")); // → clean_week_affirmation
    await act(async () => {
      fireEvent.press(screen.getByText("Continue")); // → complete (catch-up fails)
      await flushAsync();
    });

    await waitFor(() => {
      expect(
        screen.getByText("We couldn't save your review. Try again."),
      ).toBeTruthy();
    });
    expect(screen.queryByText("Done")).toBeNull();
    expect(mockUpsertGoalReviewsMutateAsync).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.press(screen.getByText("Retry"));
      await flushAsync();
    });
    await waitFor(() => {
      expect(screen.getByText("Done")).toBeTruthy();
    });
    expect(mockUpsertGoalReviewsMutateAsync).toHaveBeenCalledTimes(2);
  });

  it("attempts the first-run mark on the catch-up path when the mount read fails (defensive)", async () => {
    // Mount read rejects. Apply-path re-read returns false (incomplete).
    mockIsWeeklyReviewFirstRunCompleted
      .mockRejectedValueOnce(new Error("storage flaked"))
      .mockResolvedValueOnce(false);
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary([makeHabitSummary()]),
      isLoading: false,
      error: null,
    });
    await renderAndSettle();
    fireEvent.press(screen.getByText("Continue")); // → whats_working
    fireEvent.press(screen.getByText("Continue")); // → clean_week_affirmation
    await act(async () => {
      fireEvent.press(screen.getByText("Continue")); // → complete (catch-up fires)
      await flushAsync();
    });

    await waitFor(() => {
      expect(mockMarkWeeklyReviewFirstRunCompleted).toHaveBeenCalledTimes(1);
    });
  });

  it("hardware back during errored catch-up prompts the user before exit", async () => {
    const alertSpy = jest
      .spyOn(require("react-native").Alert, "alert")
      .mockImplementation(() => {});
    mockUpsertGoalReviewsMutateAsync.mockRejectedValueOnce(new Error("net"));
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary([makeHabitSummary()]),
      isLoading: false,
      error: null,
    });
    await renderAndSettle();
    fireEvent.press(screen.getByText("Continue")); // → whats_working
    fireEvent.press(screen.getByText("Continue")); // → clean_week_affirmation
    await act(async () => {
      fireEvent.press(screen.getByText("Continue")); // → complete (catch-up fails)
      await flushAsync();
    });

    const event = emitBeforeRemove();
    expect(event.preventDefault).toHaveBeenCalled();
    expect(alertSpy.mock.calls[0][0]).toBe(
      "Leave without finishing the save?",
    );

    alertSpy.mockRestore();
  });

  it("re-entering the review across sessions pre-fills Y/N + adjustment_note from the saved DB row", async () => {
    // Across-session re-entry: persisted row exists in the DB for the
    // current week (Y/N = No/Yes, free-text "Try later"). The user
    // re-opens the review and lands on the Tune-Up step — the saved
    // answers should pre-fill instead of starting empty.
    mockGetLatestWeeklyReviewsForHabits.mockResolvedValue(
      new Map([
        [
          "h-attn",
          {
            id: "r1",
            habit_id: "h-attn",
            user_id: "user-1",
            week_start: CURRENT_WEEK_START,
            trigger_worked: false,
            tiny_action_too_hard: true,
            adjustment_note: "Try later",
            created_at: "2026-05-04T08:00:00Z",
            updated_at: "2026-05-04T08:00:00Z",
          },
        ],
      ]),
    );
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary([attentionHabit({ habitId: "h-attn" })]),
      isLoading: false,
      error: null,
    });
    await renderAndSettle();
    fireEvent.press(screen.getByText("Continue")); // → tune-up

    // Saved diagnostics pre-fill — the "selected" suffix in the
    // NullableBooleanField accessibility label confirms the state seeded.
    expect(
      screen.getByLabelText("Did your trigger work?: No selected"),
    ).toBeTruthy();
    expect(
      screen.getByLabelText("Was the tiny action too hard?: Yes selected"),
    ).toBeTruthy();
  });

  it("catch-up at Complete does NOT overwrite habits that already have a persisted row from a previous session", async () => {
    // Two habits: one has a persisted row from a previous session,
    // one doesn't. On re-entry → straight to Complete (clean week,
    // both habits strong). The catch-up should write a row only for
    // the un-persisted habit; the saved row stays untouched.
    mockGetLatestWeeklyReviewsForHabits.mockResolvedValue(
      new Map([
        [
          "h-persisted",
          {
            id: "r1",
            habit_id: "h-persisted",
            user_id: "user-1",
            week_start: CURRENT_WEEK_START,
            trigger_worked: true,
            tiny_action_too_hard: false,
            adjustment_note: "Keep going",
            created_at: "2026-05-04T08:00:00Z",
            updated_at: "2026-05-04T08:00:00Z",
          },
        ],
      ]),
    );
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary([
        makeHabitSummary({ habitId: "h-persisted", title: "Drink water" }),
        makeHabitSummary({ habitId: "h-fresh", title: "Stretch" }),
      ]),
      isLoading: false,
      error: null,
    });
    await renderAndSettle();
    fireEvent.press(screen.getByText("Continue")); // → whats_working
    fireEvent.press(screen.getByText("Continue")); // → clean_week_affirmation
    await act(async () => {
      fireEvent.press(screen.getByText("Continue")); // → complete (catch-up fires)
      await flushAsync();
    });

    await waitFor(() => {
      expect(mockUpsertGoalReviewsMutateAsync).toHaveBeenCalledTimes(1);
    });
    const payloads = mockUpsertGoalReviewsMutateAsync.mock.calls[0][0];
    // ONLY the fresh habit is included in the catch-up — the
    // already-persisted one is preserved as-is.
    expect(payloads).toHaveLength(1);
    expect(payloads[0].habitId).toBe("h-fresh");
  });

  it("Complete renders the consistency percent + identity hero + day count", async () => {
    // makeHabitSummary() builds a strong habit with doneCount: 7,
    // activeDayCount: 7. makeSummary hardcodes overallConsistency: 0
    // by default, so override that here to a real 1.0 (100%) so the
    // Complete screen's `Math.round(consistency * 100)` renders 100%.
    mockUseGoalWeekSummary.mockReturnValue({
      data: {
        ...makeSummary([makeHabitSummary()]),
        overallConsistency: 1,
        overallActiveDayCount: 7,
        overallDoneCount: 7,
      },
      isLoading: false,
      error: null,
    });
    await renderAndSettle();
    fireEvent.press(screen.getByText("Continue")); // → whats_working
    fireEvent.press(screen.getByText("Continue")); // → clean_week_affirmation
    await act(async () => {
      fireEvent.press(screen.getByText("Continue")); // → complete
      await flushAsync();
    });

    expect(screen.getByText("100%")).toBeTruthy();
    expect(screen.getByText(/consistent this week\./)).toBeTruthy();
    expect(screen.getByText("Becoming stoic")).toBeTruthy();
    // Day count comes from oldestActiveDaysCount on the fixture summary.
    expect(screen.getByText("Day 42")).toBeTruthy();
  });

  it("Complete suppresses the percent and shows the 'first week' line when the goal has no active days yet", async () => {
    // Brand-new goal: zero active habit-days this week. We don't want
    // to render "0% consistent" — instead show a softer first-week
    // line. makeSummary lets the summary's overallActiveDayCount stay
    // computed from habits, so we override it here.
    const habit = makeHabitSummary({
      activeDayCount: 0,
      doneCount: 0,
      weekConsistency: 0,
    });
    mockUseGoalWeekSummary.mockReturnValue({
      data: {
        ...makeSummary([habit]),
        overallActiveDayCount: 0,
        overallConsistency: 0,
      },
      isLoading: false,
      error: null,
    });
    await renderAndSettle();
    fireEvent.press(screen.getByText("Continue")); // → whats_working (strong habit)
    fireEvent.press(screen.getByText("Continue")); // → clean_week_affirmation
    await act(async () => {
      fireEvent.press(screen.getByText("Continue")); // → complete
      await flushAsync();
    });

    expect(
      screen.getByText("Your first week is just getting going."),
    ).toBeTruthy();
    expect(screen.queryByText("0%")).toBeNull();
    expect(screen.queryByText(/consistent this week\./)).toBeNull();
  });

  it("reduce_friction renders the dynamic body with the habit's actual day count", async () => {
    // attentionHabit() has doneCount: 2, activeDayCount: 7, consistency 2/7
    // — both Y/N answers will say "fine," and consistency triggers
    // reduce_friction. Body should weave in "2 of 7 days."
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary([attentionHabit({ habitId: "h-attn" })]),
      isLoading: false,
      error: null,
    });
    await renderAndSettle();
    fireEvent.press(screen.getByText("Continue")); // → tune-up

    // Both fundamentals "fine" → reduce_friction.
    fireEvent.press(screen.getByLabelText("Did your trigger work?: Yes"));
    fireEvent.press(screen.getByLabelText("Was the tiny action too hard?: No"));

    await waitFor(() => {
      expect(screen.getByText("Something else is in the way")).toBeTruthy();
    });
    // Day count is woven into the body.
    expect(
      screen.getByText(
        /you only showed up 2 of 7 days this week/i,
      ),
    ).toBeTruthy();
  });

  it("hardware back during a mid-flight tune-up Apply is silently blocked by beforeRemove", async () => {
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary([attentionHabit()]),
      isLoading: false,
      error: null,
    });
    await renderAndSettle();
    fireEvent.press(screen.getByText("Continue")); // → tune-up

    fireEvent.press(screen.getByLabelText("Did your trigger work?: Yes"));
    fireEvent.press(
      screen.getByLabelText("Was the tiny action too hard?: Yes"),
    );

    // Kick off Apply but block its mutation so the writing state
    // stays active.
    mockApplyTuneUpMutateAsync.mockReturnValueOnce(
      new Promise(() => {
        /* never resolves */
      }),
    );
    fireEvent.press(screen.getByText("Apply & continue"));
    await act(async () => {
      await flushAsync();
    });

    // Simulate hardware back / swipe-back. beforeRemove should
    // preventDefault while the write is in flight (silent wait — no
    // alert; the user just tapped during a brief async window).
    const event = emitBeforeRemove();
    expect(event.preventDefault).toHaveBeenCalled();
    expect(mockActualPop).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────
  // Clean Week Affirmation step (clean-week-only)
  //
  // When the goal has zero struggling habits, the per-habit Tune-Up
  // loop runs zero iterations. The Affirmation screen confirms the
  // week was on track and advances without writes; catch-up at
  // Complete fills empty rows for every habit.
  // ─────────────────────────────────────────────────────────────

  it("Clean Week Affirmation step renders on a clean week between What's Working and Complete", async () => {
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary([makeHabitSummary()]),
      isLoading: false,
      error: null,
    });
    await renderAndSettle();
    fireEvent.press(screen.getByText("Continue")); // → whats_working
    fireEvent.press(screen.getByText("Continue")); // → clean_week_affirmation

    // The Affirmation step is on-screen; Complete is NOT yet.
    expect(screen.getByText("Solid week.")).toBeTruthy();
    expect(
      screen.getByText(
        "Every habit was on track. Take the win and keep showing up.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("WEEK REVIEWED")).toBeNull();
  });

  it("Continue advances to Complete; catch-up writes empty rows for every habit", async () => {
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary([
        makeHabitSummary({ habitId: "h-1" }),
        makeHabitSummary({ habitId: "h-2" }),
      ]),
      isLoading: false,
      error: null,
    });
    await renderAndSettle();
    fireEvent.press(screen.getByText("Continue")); // → whats_working
    fireEvent.press(screen.getByText("Continue")); // → clean_week_affirmation

    await act(async () => {
      fireEvent.press(screen.getByText("Continue")); // → complete
      await flushAsync();
    });

    // Catch-up at Complete entry writes ONE empty-row batch for both habits.
    await waitFor(() => {
      expect(mockUpsertGoalReviewsMutateAsync).toHaveBeenCalledTimes(1);
    });
    const payloads = mockUpsertGoalReviewsMutateAsync.mock.calls[0][0];
    expect(payloads).toHaveLength(2);
    for (const p of payloads) {
      expect(p.adjustmentNote).toBe("");
    }
    expect(screen.getByText("WEEK REVIEWED")).toBeTruthy();
  });

  it("does NOT render Clean Week Affirmation on a mixed week (attention habits present)", async () => {
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary([makeHabitSummary(), attentionHabit()]),
      isLoading: false,
      error: null,
    });
    await renderAndSettle();
    fireEvent.press(screen.getByText("Continue")); // → whats_working
    fireEvent.press(screen.getByText("Continue")); // → tune-up (NOT affirmation)

    expect(screen.queryByText("Solid week.")).toBeNull();
    // Tune-Up's diagnostic prompt confirms we routed to tune-up not affirmation.
    expect(screen.getByText("Did your trigger work?")).toBeTruthy();
  });

  // ─────────────────────────────────────────────────────────────
  // Analytics events
  //
  // The Tune-Up flow fires a sequence of trackEvent calls so we can
  // measure how users move through it: which suggestion types fire,
  // whether suggested text is accepted as-is, how clean weeks
  // compare to mixed weeks, etc. These assertions lock the payload
  // shape — downstream dashboards depend on the field names.
  // ─────────────────────────────────────────────────────────────

  it("fires weekly_review_tune_up_started when a Tune-Up step is entered", async () => {
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary([attentionHabit({ habitId: "h-attn" })]),
      isLoading: false,
      error: null,
    });
    await renderAndSettle();
    mockTrackEvent.mockClear();

    fireEvent.press(screen.getByText("Continue")); // → tune-up

    expect(mockTrackEvent).toHaveBeenCalledWith(
      "weekly_review_tune_up_started",
      { habitId: "h-attn" },
    );
  });

  it("fires weekly_review_tune_up_applied with mutatedFields + textKept + Y/N state", async () => {
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary([attentionHabit({ habitId: "h-attn" })]),
      isLoading: false,
      error: null,
    });
    await renderAndSettle();
    fireEvent.press(screen.getByText("Continue")); // → tune-up

    // Yes/Yes → make_tiny_action_smaller (mutates tinyAction).
    fireEvent.press(screen.getByLabelText("Did your trigger work?: Yes"));
    fireEvent.press(
      screen.getByLabelText("Was the tiny action too hard?: Yes"),
    );

    mockTrackEvent.mockClear();
    await act(async () => {
      fireEvent.press(screen.getByText("Apply & continue"));
      await flushAsync();
    });

    const call = mockTrackEvent.mock.calls.find(
      (c) => c[0] === "weekly_review_tune_up_applied",
    );
    expect(call).toBeDefined();
    expect(call![1]).toMatchObject({
      habitId: "h-attn",
      hasHabitPatch: true,
      mutatedFields: ["tinyAction"],
      triggerWorked: true,
      tinyActionTooHard: true,
    });
    // textKept is `true` because the user didn't modify the pre-filled
    // tinyAction — accepting the default counts as a kept text.
    expect(call![1].textKept).toBe(true);
  });

  it("fires weekly_review_tune_up_skipped with the Y/N state at skip time", async () => {
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary([attentionHabit({ habitId: "h-attn" })]),
      isLoading: false,
      error: null,
    });
    await renderAndSettle();
    fireEvent.press(screen.getByText("Continue")); // → tune-up

    // Answer Y/N before Skipping — distinguishes "engaged but chose
    // not to commit" from "skipped without engaging."
    fireEvent.press(screen.getByLabelText("Did your trigger work?: No"));
    fireEvent.press(
      screen.getByLabelText("Was the tiny action too hard?: No"),
    );

    mockTrackEvent.mockClear();
    await act(async () => {
      fireEvent.press(screen.getByText("Skip this habit"));
      await flushAsync();
    });

    expect(mockTrackEvent).toHaveBeenCalledWith(
      "weekly_review_tune_up_skipped",
      {
        habitId: "h-attn",
        triggerWorked: false,
        tinyActionTooHard: false,
      },
    );
  });

  it("fires weekly_review_completed with tuned/skipped counts and week shape", async () => {
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary([
        makeHabitSummary({ habitId: "h-strong" }),
        attentionHabit({ habitId: "h-attn" }),
      ]),
      isLoading: false,
      error: null,
    });
    await renderAndSettle();
    fireEvent.press(screen.getByText("Continue")); // → whats_working
    fireEvent.press(screen.getByText("Continue")); // → tune-up

    fireEvent.press(screen.getByLabelText("Did your trigger work?: Yes"));
    fireEvent.press(
      screen.getByLabelText("Was the tiny action too hard?: Yes"),
    );

    mockTrackEvent.mockClear();
    await act(async () => {
      fireEvent.press(screen.getByText("Apply & continue"));
      await flushAsync();
    });

    // Completed event fires with the session's outcome counts and
    // the goal's week shape.
    const completedCall = mockTrackEvent.mock.calls.find(
      (c) => c[0] === "weekly_review_completed",
    );
    expect(completedCall).toBeDefined();
    expect(completedCall![1]).toMatchObject({
      attentionCount: 1,
      strongCount: 1,
      tunedCount: 1,
      skippedCount: 0,
      hasMutation: true,
    });
  });

  it("fires weekly_review_clean_week_affirmation_continued when Continue is pressed on the affirmation step", async () => {
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary([makeHabitSummary()]),
      isLoading: false,
      error: null,
    });
    await renderAndSettle();
    fireEvent.press(screen.getByText("Continue")); // → whats_working
    fireEvent.press(screen.getByText("Continue")); // → clean_week_affirmation

    mockTrackEvent.mockClear();
    await act(async () => {
      fireEvent.press(screen.getByText("Continue")); // → complete
      await flushAsync();
    });

    expect(mockTrackEvent).toHaveBeenCalledWith(
      "weekly_review_clean_week_affirmation_continued",
    );
  });
});
