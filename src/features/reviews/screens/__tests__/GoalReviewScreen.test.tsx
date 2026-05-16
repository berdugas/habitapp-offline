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

beforeEach(() => {
  jest.clearAllMocks();
  mockNavigationListeners.length = 0;
  // jest.clearAllMocks resets implementations on jest.fn(...), so restore
  // the back→navigateBack glue every test.
  mockRouterBack.mockImplementation(() => navigateBack());
});

describe("GoalReviewScreen", () => {
  it("shows loading state while summary is fetching", () => {
    mockUseGoalWeekSummary.mockReturnValue({ data: null, isLoading: true });
    renderScreen();
    expect(screen.queryByText(/Loading your week/)).toBeTruthy();
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
    renderScreen();

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
    renderScreen();

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
    renderScreen();

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
    renderScreen();

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
    renderScreen();

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
    renderScreen();

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

    renderScreen();

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
    renderScreen();

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
    renderScreen();

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

  it("allows beforeRemove to proceed (no preventDefault) when the flow is clean and there is no unsaved work", () => {
    const habit = makeHabitSummary();
    mockUseGoalWeekSummary.mockReturnValue({
      data: makeSummary(habit),
      isLoading: false,
    });
    renderScreen();

    // No diagnostics entered, no custom text → not dirty.
    const event = emitBeforeRemove();
    expect(event.preventDefault).not.toHaveBeenCalled();
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
    renderScreen();

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
    renderScreen();

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
});
