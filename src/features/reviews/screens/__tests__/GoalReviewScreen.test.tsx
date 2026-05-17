import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

const mockRouterReplace = jest.fn();
const mockUseGoalWeekSummary = jest.fn();
const mockMutateAsync = jest.fn();
const mockNavigationDispatch = jest.fn();
const mockNavigationListeners: ((event: unknown) => void)[] = [];
const mockActualPop = jest.fn();
const mockIsWeeklyReviewFirstRunCompleted = jest.fn();
const mockMarkWeeklyReviewFirstRunCompleted = jest.fn();
const mockTrackEvent = jest.fn();
const mockLoggerWarn = jest.fn();

// Simulate real React Navigation: a back navigation fires beforeRemove first.
// If any listener calls preventDefault, the pop is cancelled; otherwise the
// pop actually happens (recorded as mockActualPop).
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

const mockRouterBack = jest.fn(() => navigateBack());

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

jest.mock("@/features/auth/hooks", () => ({
  useAuthSession: () => ({ user: { id: "user-1" } }),
}));

jest.mock("@/features/reviews/useGoalWeekSummary", () => ({
  useGoalWeekSummary: (...args: unknown[]) => mockUseGoalWeekSummary(...args),
}));

jest.mock("@/features/reviews/hooks", () => ({
  useUpsertGoalReviewsMutation: () => ({
    mutateAsync: (...args: unknown[]) => mockMutateAsync(...args),
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

import type { GoalWeekSummary, HabitWeekSummary } from "@/features/reviews/buildGoalWeekSummary";

function makeHabitSummary(
  overrides: Partial<HabitWeekSummary> = {},
): HabitWeekSummary {
  return {
    habitId: "h1",
    title: "Walk daily",
    icon: null,
    formula: "after coffee → put on shoes",
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

function makeSummary(habit: HabitWeekSummary): GoalWeekSummary {
  return {
    identityPhrase: "stoic",
    habits: [habit],
    overallDoneCount: habit.doneCount,
    overallActiveDayCount: habit.activeDayCount,
    overallConsistency: habit.weekConsistency,
    strongHabits: habit.isStrong ? [habit] : [],
    attentionHabits: habit.needsAttention ? [habit] : [],
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

// Settles the first-run flag loading gate so tests can immediately drive
// the multi-step UI. The screen now renders a loading state until
// isWeeklyReviewFirstRunCompleted() resolves — without this, a test that
// presses "Continue" right after render fails because the screen still
// shows "Loading your week...". The loading-state test that intentionally
// mocks isLoading: true continues to use renderScreen() directly.
async function renderAndSettle() {
  const result = renderScreen();
  await act(async () => {
    await flushAsync();
  });
  return result;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockNavigationListeners.length = 0;
  // jest.clearAllMocks resets implementations on jest.fn(...), so restore
  // the back→navigateBack glue every test.
  mockRouterBack.mockImplementation(() => navigateBack());
  // Default: existing tests assume a repeat-user world (no first-run
  // banners, no first-run write). Individual tests can override.
  mockIsWeeklyReviewFirstRunCompleted.mockResolvedValue(true);
  // Mark helper now returns Promise<boolean> indicating persist success.
  // Default to true (write succeeded) — tests for the persist-failure
  // path override to false explicitly.
  mockMarkWeeklyReviewFirstRunCompleted.mockResolvedValue(true);
});

async function flushAsync() {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

describe("GoalReviewScreen", () => {
  it("shows loading state while summary is fetching", async () => {
    mockUseGoalWeekSummary.mockReturnValue({ data: null, isLoading: true });
    renderScreen();
    expect(screen.queryByText(/Loading your week/)).toBeTruthy();
    // Settle pending state updates from the first-run useEffect before the
    // test ends, so React's act() warning doesn't fire on the unawaited
    // setState that lands after the synchronous assertion.
    await act(async () => {
      await flushAsync();
    });
  });

  it("skips Step 2 'What's Working' when no strong habits", async () => {
    const habit = makeHabitSummary({
      doneCount: 3,
      missCount: 4,
      weekConsistency: 3 / 7,
      isStrong: false,
      needsAttention: true,
    });
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary(habit),
      isLoading: false,
    });
    await renderAndSettle();

    // Step 1 → Continue should go to needs_attention (no whats_working)
    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });
    expect(screen.queryByText(/What's working/i)).toBeNull();
    expect(screen.queryByText(/needs attention/i)).toBeTruthy();
  });

  it("won't advance past Step 3 until both diagnostics are answered", async () => {
    const habit = makeHabitSummary({
      doneCount: 3,
      missCount: 4,
      weekConsistency: 3 / 7,
      isStrong: false,
      needsAttention: true,
    });
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary(habit),
      isLoading: false,
    });
    mockMutateAsync.mockResolvedValue([]);
    await renderAndSettle();

    // Step 1 → Step 3 (no Step 2 since habit is not strong)
    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });
    expect(screen.queryByText(/needs attention/i)).toBeTruthy();

    // Pressing Continue with no diagnostic answers should not advance.
    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });
    expect(screen.queryByText(/needs attention/i)).toBeTruthy();
    expect(screen.queryByText(/One thing to try/i)).toBeNull();

    // Answer both questions, then Continue → advances to adjustment step.
    await act(async () => {
      fireEvent.press(screen.getAllByText("Yes")[0]!);
    });
    await act(async () => {
      fireEvent.press(screen.getAllByText("No")[1]!);
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });
    await waitFor(() => {
      expect(screen.queryByText(/One thing to try/i)).toBeTruthy();
    });
  });

  it("calls the batch mutation once and advances to complete on success", async () => {
    const habit = makeHabitSummary(); // all strong, no attention
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary(habit),
      isLoading: false,
    });
    mockMutateAsync.mockResolvedValue([]);
    await renderAndSettle();

    // Step sequence with all-strong: week_overview → whats_working → adjustment → complete
    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });
    // Now on adjustment step
    await act(async () => {
      fireEvent.press(screen.getByText("Save & finish"));
    });

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });
    // Single batch payload, one entry per habit
    const payloadArg = mockMutateAsync.mock.calls[0]![0];
    expect(Array.isArray(payloadArg)).toBe(true);
    expect(payloadArg).toHaveLength(1);
    expect(payloadArg[0].habitId).toBe("h1");

    // Complete step renders
    await waitFor(() => {
      expect(screen.queryByText(/Week reviewed/i)).toBeTruthy();
    });
  });

  it("persists the keep_going suggestion as the adjustment note on every habit in the all-strong path", async () => {
    const h1 = makeHabitSummary({ habitId: "h1", title: "Walk" });
    const h2 = makeHabitSummary({ habitId: "h2", title: "Read" });
    const summary = {
      ...makeSummary(h1),
      habits: [h1, h2],
      strongHabits: [h1, h2],
    };
    mockUseGoalWeekSummary.mockReturnValue({ data: summary, isLoading: false });
    mockMutateAsync.mockResolvedValue([]);
    await renderAndSettle();

    // week_overview → whats_working → adjustment → save
    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Save & finish"));
    });

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });
    const payloads = mockMutateAsync.mock.calls[0]![0];
    // Both habits get the keep_going note — input not silently dropped.
    expect(payloads).toHaveLength(2);
    expect(payloads[0].habitId).toBe("h1");
    expect(payloads[1].habitId).toBe("h2");
    expect(payloads[0].adjustmentNote.length).toBeGreaterThan(0);
    expect(payloads[1].adjustmentNote.length).toBeGreaterThan(0);
    expect(payloads[0].adjustmentNote).toBe(payloads[1].adjustmentNote);
  });

  it("persists a custom 'I'll try something else' note across all habits when no attention habits exist", async () => {
    const h1 = makeHabitSummary({ habitId: "h1", title: "Walk" });
    const h2 = makeHabitSummary({ habitId: "h2", title: "Read" });
    const summary = {
      ...makeSummary(h1),
      habits: [h1, h2],
      strongHabits: [h1, h2],
    };
    mockUseGoalWeekSummary.mockReturnValue({ data: summary, isLoading: false });
    mockMutateAsync.mockResolvedValue([]);
    await renderAndSettle();

    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });
    // On adjustment step: toggle to custom + type a note.
    await act(async () => {
      fireEvent.press(screen.getByText("I'll try something else"));
    });
    await act(async () => {
      fireEvent.changeText(
        screen.getByPlaceholderText(/One small change for next week/i),
        "Meditate for 5 minutes after coffee",
      );
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Save & finish"));
    });

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });
    const payloads = mockMutateAsync.mock.calls[0]![0];
    expect(payloads).toHaveLength(2);
    expect(payloads[0].adjustmentNote).toBe(
      "Meditate for 5 minutes after coffee",
    );
    expect(payloads[1].adjustmentNote).toBe(
      "Meditate for 5 minutes after coffee",
    );
  });

  it("advances to Step 5 with a retry option when the batch save fails", async () => {
    const habit = makeHabitSummary();
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary(habit),
      isLoading: false,
    });
    mockMutateAsync.mockRejectedValue(new Error("DB write failed"));
    await renderAndSettle();

    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Save & finish"));
    });

    // Step 5 renders the error + retry; the celebratory "Week reviewed"
    // card stays hidden because save didn't actually succeed.
    await waitFor(() => {
      expect(screen.queryByText(/couldn't save your review/i)).toBeTruthy();
    });
    expect(screen.queryByText("Retry")).toBeTruthy();
    expect(screen.queryByText(/Week reviewed/i)).toBeNull();
  });

  it("during a retry, shows a saving state (not the success card) until the write actually returns, and a close attempt is ignored mid-flight", async () => {
    const habit = makeHabitSummary();
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary(habit),
      isLoading: false,
    });

    // First save fails so we land on Step 5 with Retry.
    // Second save is a controllable promise so we can inspect the in-flight state.
    let resolveSecond: (value: unknown) => void = () => {};
    const secondCall = new Promise((resolve) => {
      resolveSecond = resolve;
    });
    mockMutateAsync
      .mockRejectedValueOnce(new Error("DB write failed"))
      .mockReturnValueOnce(secondCall);

    await renderAndSettle();

    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Save & finish"));
    });

    await waitFor(() => {
      expect(screen.queryByText("Retry")).toBeTruthy();
    });

    // Trigger the retry — but DON'T resolve the promise yet.
    await act(async () => {
      fireEvent.press(screen.getByText("Retry"));
    });

    // While the write is in flight, the UI must NOT pretend the save succeeded.
    expect(screen.queryByText(/Week reviewed/i)).toBeNull();
    expect(screen.queryByText("Done")).toBeNull();
    expect(screen.getByText(/Saving your review/)).toBeTruthy();

    // Tapping close mid-flight must be ignored (no Alert, no actual exit).
    // router.back() is called, but beforeRemove intercepts and the screen
    // does NOT pop while the save is in flight.
    const popCountBefore = mockActualPop.mock.calls.length;
    fireEvent.press(screen.getByLabelText("Close review"));
    expect(mockActualPop.mock.calls.length).toBe(popCountBefore);

    // Resolve the in-flight save → Done appears.
    await act(async () => {
      resolveSecond([]);
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(screen.queryByText(/Week reviewed/i)).toBeTruthy();
    });
    expect(screen.queryByText("Done")).toBeTruthy();
  });

  it("close button: shows exactly one confirmation Alert with unsaved work, and tapping Leave actually exits without a second prompt", async () => {
    const habit = makeHabitSummary();
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary(habit),
      isLoading: false,
    });
    mockMutateAsync.mockRejectedValue(new Error("DB write failed"));
    // Capture buttons from the first Alert so we can simulate the user
    // tapping "Leave" and then verify no second Alert fires.
    type AlertButton = { text: string; onPress?: () => void };
    let capturedButtons: AlertButton[] | null = null;
    const alertSpy = jest
      .spyOn(Alert, "alert")
      .mockImplementation((_title, _msg, buttons) => {
        capturedButtons = (buttons ?? null) as AlertButton[] | null;
      });
    await renderAndSettle();

    // Walk through to Step 4 and trigger a save that fails so we land on
    // Step 5 with saveError=true, but no successful save yet.
    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });
    await act(async () => {
      fireEvent.press(screen.getByText("I'll try something else"));
    });
    await act(async () => {
      fireEvent.changeText(
        screen.getByPlaceholderText(/One small change for next week/i),
        "Try mornings",
      );
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Save & finish"));
    });

    await waitFor(() => {
      expect(screen.queryByText("Retry")).toBeTruthy();
    });

    // Tap the close (X) button — must show exactly one Alert and must not
    // pop the screen.
    const closeBtn = screen.getByLabelText("Close review");
    await act(async () => {
      fireEvent.press(closeBtn);
    });
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(mockActualPop).not.toHaveBeenCalled();
    expect(capturedButtons).not.toBeNull();

    // Now simulate the user tapping "Leave". This must actually exit the
    // screen (single dispatch), NOT trigger a second confirmation dialog.
    const leaveBtn = capturedButtons!.find((b) => b.text === "Leave");
    expect(leaveBtn).toBeTruthy();
    await act(async () => {
      leaveBtn!.onPress?.();
    });
    expect(alertSpy).toHaveBeenCalledTimes(1); // no second prompt
    expect(mockNavigationDispatch).toHaveBeenCalledTimes(1); // actual exit

    alertSpy.mockRestore();
  });

  it("intercepts Android back / iOS swipe-back via beforeRemove when there is unsaved work, instead of letting the navigation proceed", async () => {
    const habit = makeHabitSummary({
      doneCount: 3,
      missCount: 4,
      weekConsistency: 3 / 7,
      isStrong: false,
      needsAttention: true,
    });
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary(habit),
      isLoading: false,
    });
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await renderAndSettle();

    // Advance to Step 3 and answer a diagnostic so state is dirty.
    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });
    await act(async () => {
      fireEvent.press(screen.getAllByText("Yes")[0]!);
    });

    // Simulate the OS firing beforeRemove (hardware back / iOS swipe).
    const event = emitBeforeRemove();

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(mockNavigationDispatch).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledTimes(1);

    alertSpy.mockRestore();
  });

  it("allows beforeRemove to proceed (no preventDefault) when the flow is clean and there is no unsaved work", async () => {
    const habit = makeHabitSummary();
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary(habit),
      isLoading: false,
    });
    renderScreen();

    // No diagnostics entered, no custom text → not dirty.
    const event = emitBeforeRemove();
    expect(event.preventDefault).not.toHaveBeenCalled();
    // Settle pending state updates from the first-run useEffect.
    await act(async () => {
      await flushAsync();
    });
  });

  it("prompts for confirmation when closing after a failed save on the all-strong path (no diagnostics, no custom text)", async () => {
    // All-strong path means diagnostics is empty AND customAdjustment is "".
    // saveError must by itself be enough to trigger the confirmation prompt,
    // otherwise the user can lose an unsaved review with a single tap.
    const habit = makeHabitSummary(); // strong
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary(habit),
      isLoading: false,
    });
    mockMutateAsync.mockRejectedValue(new Error("DB write failed"));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    await renderAndSettle();

    // Walk: week_overview → whats_working → adjustment → Save & finish
    // No diagnostic answers, no custom note — accept default keep_going.
    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Save & finish"));
    });

    await waitFor(() => {
      expect(screen.queryByText("Retry")).toBeTruthy();
    });

    // Now close — must prompt, not silently navigate.
    fireEvent.press(screen.getByLabelText("Close review"));
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(mockActualPop).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it("retrying after a save failure succeeds and shows the Done state", async () => {
    const habit = makeHabitSummary();
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary(habit),
      isLoading: false,
    });
    mockMutateAsync
      .mockRejectedValueOnce(new Error("DB write failed"))
      .mockResolvedValueOnce([]);
    await renderAndSettle();

    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Save & finish"));
    });

    await waitFor(() => {
      expect(screen.queryByText("Retry")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByText("Retry"));
    });

    await waitFor(() => {
      expect(screen.queryByText(/Week reviewed/i)).toBeTruthy();
    });
    expect(screen.queryByText("Done")).toBeTruthy();
    expect(mockMutateAsync).toHaveBeenCalledTimes(2);
  });

  // --- First-run onboarding tip banners ---

  const NEEDS_ATTENTION_TIP_COPY =
    /That's a clue, not a verdict/;
  const ADJUSTMENT_TIP_COPY = /Honest 'no' answers are the most useful/;

  function setupAttentionFlow() {
    const habit = makeHabitSummary({
      doneCount: 3,
      missCount: 4,
      weekConsistency: 3 / 7,
      isStrong: false,
      needsAttention: true,
    });
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary(habit),
      isLoading: false,
    });
    mockMutateAsync.mockResolvedValue([]);
  }

  it("shows both first-run banners during the first review and hides them on dismiss", async () => {
    mockIsWeeklyReviewFirstRunCompleted.mockResolvedValue(false);
    setupAttentionFlow();
    await renderAndSettle();
    // Let the mount-effect read resolve before we drive the flow.
    await act(async () => {
      await flushAsync();
    });

    // Advance week_overview → needs_attention
    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });
    expect(screen.queryByText(NEEDS_ATTENTION_TIP_COPY)).toBeTruthy();

    // Dismiss the needs-attention banner.
    await act(async () => {
      fireEvent.press(
        screen.getByTestId("needs-attention-first-run-tip").findByProps({
          accessibilityLabel: "Dismiss tip",
        }),
      );
    });
    expect(screen.queryByText(NEEDS_ATTENTION_TIP_COPY)).toBeNull();
    expect(mockTrackEvent).toHaveBeenCalledWith(
      "weekly_review_tip_dismissed",
      { step: "needs_attention" },
    );

    // Answer diagnostics so Continue advances to adjustment.
    await act(async () => {
      fireEvent.press(screen.getAllByText("Yes")[0]!);
    });
    await act(async () => {
      fireEvent.press(screen.getAllByText("No")[1]!);
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });

    expect(screen.queryByText(ADJUSTMENT_TIP_COPY)).toBeTruthy();

    await act(async () => {
      fireEvent.press(
        screen.getByTestId("adjustment-first-run-tip").findByProps({
          accessibilityLabel: "Dismiss tip",
        }),
      );
    });
    expect(screen.queryByText(ADJUSTMENT_TIP_COPY)).toBeNull();
    expect(mockTrackEvent).toHaveBeenCalledWith(
      "weekly_review_tip_dismissed",
      { step: "adjustment" },
    );
  });

  it("marks first run completed exactly once on save success during the first review", async () => {
    mockIsWeeklyReviewFirstRunCompleted.mockResolvedValue(false);
    setupAttentionFlow();
    await renderAndSettle();
    await act(async () => {
      await flushAsync();
    });

    // Drive through to save success.
    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });
    await act(async () => {
      fireEvent.press(screen.getAllByText("Yes")[0]!);
    });
    await act(async () => {
      fireEvent.press(screen.getAllByText("No")[1]!);
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Save & finish"));
    });
    await act(async () => {
      await flushAsync();
    });

    expect(mockMarkWeeklyReviewFirstRunCompleted).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith(
      "weekly_review_first_run_completed",
    );
  });

  it("does NOT show banners or mark the first-run flag when isWeeklyReviewFirstRunCompleted resolves true (repeat user)", async () => {
    // Default beforeEach sets this to true; reassert for clarity.
    mockIsWeeklyReviewFirstRunCompleted.mockResolvedValue(true);
    setupAttentionFlow();
    await renderAndSettle();
    await act(async () => {
      await flushAsync();
    });

    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });
    expect(screen.queryByText(NEEDS_ATTENTION_TIP_COPY)).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getAllByText("Yes")[0]!);
    });
    await act(async () => {
      fireEvent.press(screen.getAllByText("No")[1]!);
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });
    expect(screen.queryByText(ADJUSTMENT_TIP_COPY)).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByText("Save & finish"));
    });
    await act(async () => {
      await flushAsync();
    });

    expect(mockMarkWeeklyReviewFirstRunCompleted).not.toHaveBeenCalled();
  });

  it("save-path uses authoritative storage, not the in-memory mirror", async () => {
    // Mount-effect read returns true so the screen unblocks the loading
    // gate AND the in-memory mirror reflects "first run done" (banners
    // hidden). But the save-path re-read returns false (e.g. another
    // process wrote, or the storage truth differs from the mount snapshot).
    // The save-path must use the storage truth, not the in-memory mirror,
    // and therefore write the flag — proving the in-memory boolean is
    // for rendering only, never for guarding persistence.
    mockIsWeeklyReviewFirstRunCompleted
      .mockResolvedValueOnce(true) // mount-effect read
      .mockResolvedValueOnce(false); // save-path re-read
    setupAttentionFlow();
    await renderAndSettle();

    // Banners should NOT be visible (mount-effect mirror says first run done).
    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });
    expect(screen.queryByText(NEEDS_ATTENTION_TIP_COPY)).toBeNull();

    // Drive through to save success.
    await act(async () => {
      fireEvent.press(screen.getAllByText("Yes")[0]!);
    });
    await act(async () => {
      fireEvent.press(screen.getAllByText("No")[1]!);
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Save & finish"));
    });
    await act(async () => {
      await flushAsync();
    });

    // The save-path re-read saw "not completed" and wrote the flag,
    // independent of the in-memory mirror.
    expect(mockMarkWeeklyReviewFirstRunCompleted).toHaveBeenCalledTimes(1);
  });

  it("logs and stays banner-less when the mount-effect read rejects", async () => {
    mockIsWeeklyReviewFirstRunCompleted.mockRejectedValue(
      new Error("db locked"),
    );
    setupAttentionFlow();
    await renderAndSettle();
    await act(async () => {
      await flushAsync();
    });

    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });
    expect(screen.queryByText(NEEDS_ATTENTION_TIP_COPY)).toBeNull();

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "GoalReviewScreen: first-run read failed on mount",
      expect.objectContaining({ err: expect.any(Error) }),
    );
  });

  it("suppresses 'first_run_completed' analytics when the mark write fails to persist", async () => {
    mockIsWeeklyReviewFirstRunCompleted.mockResolvedValue(false);
    mockMarkWeeklyReviewFirstRunCompleted.mockResolvedValue(false); // persistence failure
    setupAttentionFlow();
    await renderAndSettle();

    // Drive through to save success.
    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });
    await act(async () => {
      fireEvent.press(screen.getAllByText("Yes")[0]!);
    });
    await act(async () => {
      fireEvent.press(screen.getAllByText("No")[1]!);
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Save & finish"));
    });
    await act(async () => {
      await flushAsync();
    });

    // mark was called (we tried to persist), but analytics is suppressed
    // because the write didn't actually land — next session will still
    // see the user as in first-run state, so claiming "completed" would
    // create an inconsistency.
    expect(mockMarkWeeklyReviewFirstRunCompleted).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).not.toHaveBeenCalledWith(
      "weekly_review_first_run_completed",
    );
  });

  it("skips the first-run write and logs when the save-path read rejects", async () => {
    // First call (mount) resolves false; second call (save-path) rejects.
    mockIsWeeklyReviewFirstRunCompleted
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(new Error("db locked"));
    setupAttentionFlow();
    await renderAndSettle();
    await act(async () => {
      await flushAsync();
    });

    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });
    await act(async () => {
      fireEvent.press(screen.getAllByText("Yes")[0]!);
    });
    await act(async () => {
      fireEvent.press(screen.getAllByText("No")[1]!);
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Continue"));
    });
    await act(async () => {
      fireEvent.press(screen.getByText("Save & finish"));
    });
    await act(async () => {
      await flushAsync();
    });

    expect(mockMarkWeeklyReviewFirstRunCompleted).not.toHaveBeenCalled();
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "GoalReviewScreen: first-run save-path read failed",
      expect.objectContaining({ err: expect.any(Error) }),
    );
    // Save success path still completed — user reaches the complete step.
    await waitFor(() => {
      expect(screen.queryByText(/Week reviewed/i)).toBeTruthy();
    });
  });
});
