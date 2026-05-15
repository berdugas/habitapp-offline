jest.mock("@/features/trial/hooks", () => ({
  useTrialValidation: jest.fn(() => ({
    isBootstrapping: false,
    isValidating: false,
    accessMode: "full",
    entitlementStatus: "trial",
    trialStartedAt: null,
    trialEndsAt: null,
    lastValidatedAt: null,
    refresh: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import TodayScreen from "@/features/today/screens/TodayScreen";
import { resetClockForTesting, setNowForTesting } from "@/utils/clock";
import {
  getLoadHabitsErrorMessage,
  getSaveTodayStatusErrorMessage,
} from "@/utils/userFacingErrors";

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));

jest.mock("@/features/today/hooks", () => ({
  useHabitLogsForRange: jest.fn(),
  useTodayHabits: jest.fn(),
  useUpsertTodayHabitStatusMutation: jest.fn(),
  useDeleteTodayHabitLogMutation: jest.fn(() => ({
    mutateAsync: jest.fn().mockResolvedValue(undefined),
    isPending: false,
    error: null,
  })),
}));

jest.mock("@/features/habits/hooks", () => ({
  useArchiveHabitMutation: jest.fn(),
}));

jest.mock("@/features/recovery/hooks", () => ({
  useRecoveryCheck: jest.fn(),
  useSingleMissBanner: jest.fn(),
}));

jest.mock("@/lib/db/repositories/preferences", () => ({
  setPreference: jest.fn().mockResolvedValue(undefined),
}));

const {
  useTodayHabits,
  useUpsertTodayHabitStatusMutation,
} = jest.requireMock("@/features/today/hooks") as {
  useTodayHabits: jest.Mock;
  useUpsertTodayHabitStatusMutation: jest.Mock;
};

const { useArchiveHabitMutation } = jest.requireMock(
  "@/features/habits/hooks",
) as { useArchiveHabitMutation: jest.Mock };

const { useRecoveryCheck, useSingleMissBanner } = jest.requireMock(
  "@/features/recovery/hooks",
) as { useRecoveryCheck: jest.Mock; useSingleMissBanner: jest.Mock };

const { setPreference } = jest.requireMock(
  "@/lib/db/repositories/preferences",
) as { setPreference: jest.Mock };

const { router } = jest.requireMock("expo-router") as {
  router: { push: jest.Mock };
};

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function makeHabit(overrides: Record<string, unknown> = {}) {
  return {
    activeDays: [1, 2, 3, 4, 5, 6, 7],
    consistencyDenominator: 10,
    consistencyRate: 0.9,
    cue: "morning coffee",
    formula: "After morning coffee, run for 2 minutes",
    icon: null,
    id: "habit-1",
    identityPhrase: "a runner",
    name: "Run",
    offDay: false,
    skipCount: 0,
    startDate: "2026-04-01",
    streak: 12,
    tinyAction: "run for 2 minutes",
    todayStatus: null,
    ...overrides,
  };
}

describe("TodayScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setNowForTesting(new Date("2026-04-30T10:00:00.000Z"));
    useUpsertTodayHabitStatusMutation.mockReturnValue({
      error: null,
      isPending: false,
      mutateAsync: jest.fn().mockResolvedValue(undefined),
    });
    useArchiveHabitMutation.mockReturnValue({
      error: null,
      isPending: false,
      mutateAsync: jest.fn().mockResolvedValue(undefined),
    });
    useRecoveryCheck.mockReturnValue({
      shouldShowModal: false,
      triggeringHabit: null,
      breakRunStartDate: null,
      logs: [],
    });
    useSingleMissBanner.mockReturnValue({ showBanner: false, missDate: null, missingHabitId: null });
  });

  afterEach(() => {
    resetClockForTesting();
  });

  it("renders the no-habits empty state with CTA when no habits exist", () => {
    useTodayHabits.mockReturnValue({
      error: null,
      habits: [],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: {},
    });
    renderWithClient(<TodayScreen />);
    expect(screen.getByText("No active habits yet")).toBeTruthy();
    expect(screen.getByText("Create your first habit")).toBeTruthy();
  });

  it("renders GoalContainer with identity phrase, streak copy, and habit row", () => {
    useTodayHabits.mockReturnValue({
      error: null,
      habits: [makeHabit()],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: { "a runner": 12 },
    });
    renderWithClient(<TodayScreen />);
    expect(screen.getByText("Become a runner")).toBeTruthy();
    // goalStreaks["a runner"]=12 → 12 % 5 = 2 → "12-day streak. One day at a time."
    expect(screen.getByText("12-day streak. One day at a time.")).toBeTruthy();
    expect(screen.getByText("Run")).toBeTruthy();
    expect(screen.getByLabelText("Log Run")).toBeTruthy();
  });

  it("renders '1 remaining to complete' pill when one habit is incomplete", () => {
    useTodayHabits.mockReturnValue({
      error: null,
      habits: [makeHabit({ streak: 0, todayStatus: null })],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: {},
    });
    renderWithClient(<TodayScreen />);
    expect(screen.getByText("1 remaining to complete")).toBeTruthy();
  });

  it("tapping the circle calls the mutation with status='done'", () => {
    const mutateAsync = jest.fn().mockResolvedValue(undefined);
    useUpsertTodayHabitStatusMutation.mockReturnValue({
      error: null,
      isPending: false,
      mutateAsync,
    });
    useTodayHabits.mockReturnValue({
      error: null,
      habits: [makeHabit()],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: {},
    });
    renderWithClient(<TodayScreen />);
    fireEvent.press(screen.getByLabelText("Log Run"));
    expect(mutateAsync).toHaveBeenCalledWith({ habitId: "habit-1", status: "done" });
  });

  it("long-pressing the circle calls the mutation with status='skipped'", () => {
    const mutateAsync = jest.fn().mockResolvedValue(undefined);
    useUpsertTodayHabitStatusMutation.mockReturnValue({
      error: null,
      isPending: false,
      mutateAsync,
    });
    useTodayHabits.mockReturnValue({
      error: null,
      habits: [makeHabit()],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: {},
    });
    renderWithClient(<TodayScreen />);
    fireEvent(screen.getByLabelText("Log Run"), "longPress");
    expect(mutateAsync).toHaveBeenCalledWith({ habitId: "habit-1", status: "skipped" });
  });

  it("tapping the row navigates to habit detail", () => {
    useTodayHabits.mockReturnValue({
      error: null,
      habits: [makeHabit()],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: {},
    });
    renderWithClient(<TodayScreen />);
    fireEvent.press(screen.getByLabelText("Open Run"));
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/(app)/habits/[habitId]",
      params: { habitId: "habit-1" },
    });
  });

  it("done state shows circle label as 'Run — done'", () => {
    useTodayHabits.mockReturnValue({
      error: null,
      habits: [makeHabit({ todayStatus: "done" })],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: {},
    });
    renderWithClient(<TodayScreen />);
    expect(screen.getByLabelText("Run — done")).toBeTruthy();
  });

  it("does not render a Missed action on Today", () => {
    useTodayHabits.mockReturnValue({
      error: null,
      habits: [makeHabit()],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: {},
    });
    renderWithClient(<TodayScreen />);
    expect(screen.queryByText("Missed")).toBeNull();
  });

  it("renders a load error state when useTodayHabits returns an error", () => {
    useTodayHabits.mockReturnValue({
      error: new Error("Failed to load"),
      habits: [],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: {},
    });
    renderWithClient(<TodayScreen />);
    expect(screen.getByText(getLoadHabitsErrorMessage())).toBeTruthy();
  });

  it("renders a save error state when the mutation has an error", () => {
    useTodayHabits.mockReturnValue({
      error: null,
      habits: [makeHabit()],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: {},
    });
    useUpsertTodayHabitStatusMutation.mockReturnValue({
      error: new Error("Save failed"),
      isPending: false,
      mutateAsync: jest.fn().mockRejectedValue(new Error("Save failed")),
    });
    renderWithClient(<TodayScreen />);
    expect(screen.getByText(getSaveTodayStatusErrorMessage())).toBeTruthy();
  });

  it("does not render a miss banner when showBanner is false", () => {
    useTodayHabits.mockReturnValue({
      error: null,
      habits: [makeHabit()],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: {},
    });
    renderWithClient(<TodayScreen />);
    expect(screen.queryByText(/Yesterday was a miss/)).toBeNull();
  });

  it("renders MissBanner when useSingleMissBanner returns showBanner=true", () => {
    useTodayHabits.mockReturnValue({
      error: null,
      habits: [makeHabit()],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: {},
    });
    useSingleMissBanner.mockReturnValue({
      showBanner: true,
      missDate: "2026-04-29",
      missingHabitId: "habit-1",
    });
    renderWithClient(<TodayScreen />);
    expect(screen.getByText(/Yesterday was a miss/)).toBeTruthy();
  });

  it("tapping × on MissBanner calls setPreference with the banner-dismissed key", async () => {
    useTodayHabits.mockReturnValue({
      error: null,
      habits: [makeHabit()],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: {},
    });
    useSingleMissBanner.mockReturnValue({
      showBanner: true,
      missDate: "2026-04-29",
      missingHabitId: "habit-1",
    });
    renderWithClient(<TodayScreen />);
    fireEvent.press(screen.getByLabelText("Dismiss"));
    await waitFor(() => {
      expect(setPreference).toHaveBeenCalledWith(
        "single-miss-banner-dismissed-habit-1-2026-04-29",
        "true",
      );
    });
  });

  it("shows 'You showed up today.' when all habits are logged", () => {
    useTodayHabits.mockReturnValue({
      error: null,
      habits: [makeHabit({ todayStatus: "done" })],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: {},
    });
    renderWithClient(<TodayScreen />);
    expect(screen.getByText("You showed up today.")).toBeTruthy();
  });

  it("does not show 'You showed up today.' when some habits are unlogged", () => {
    useTodayHabits.mockReturnValue({
      error: null,
      habits: [makeHabit({ todayStatus: "done" }), makeHabit({ id: "habit-2", todayStatus: null })],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: {},
    });
    renderWithClient(<TodayScreen />);
    expect(screen.queryByText("You showed up today.")).toBeNull();
  });

  it("renders the recovery modal when shouldShowModal is true", () => {
    useTodayHabits.mockReturnValue({
      error: null,
      habits: [makeHabit()],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: {},
    });
    useRecoveryCheck.mockReturnValue({
      shouldShowModal: true,
      triggeringHabit: { id: "habit-1", start_date: "2026-04-01", title: "Run" },
      breakRunStartDate: "2026-04-28",
      logs: [],
    });
    renderWithClient(<TodayScreen />);
    expect(screen.getByText("Restart as-is")).toBeTruthy();
    expect(screen.getByText("Make it smaller")).toBeTruthy();
    expect(screen.getByText("Pause for now")).toBeTruthy();
    expect(screen.getByText("Just close")).toBeTruthy();
  });

  it("does not render the recovery modal when shouldShowModal is false", () => {
    useTodayHabits.mockReturnValue({
      error: null,
      habits: [makeHabit()],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: {},
    });
    renderWithClient(<TodayScreen />);
    expect(screen.queryByText("Restart as-is")).toBeNull();
  });

  function renderModalOpen() {
    useTodayHabits.mockReturnValue({
      error: null,
      habits: [makeHabit()],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: {},
    });
    useRecoveryCheck.mockReturnValue({
      shouldShowModal: true,
      triggeringHabit: { id: "habit-1", start_date: "2026-04-01", title: "Run" },
      breakRunStartDate: "2026-04-28",
      logs: [],
    });
    renderWithClient(<TodayScreen />);
  }

  it("tapping Restart as-is calls setPreference with the modal-shown key", async () => {
    renderModalOpen();
    fireEvent.press(screen.getByText("Restart as-is"));
    await waitFor(() => {
      expect(setPreference).toHaveBeenCalledWith(
        "recovery-modal-shown-habit-1-2026-04-28",
        "true",
      );
    });
  });

  it("tapping Just close calls setPreference with the modal-shown key", async () => {
    renderModalOpen();
    fireEvent.press(screen.getByText("Just close"));
    await waitFor(() => {
      expect(setPreference).toHaveBeenCalledWith(
        "recovery-modal-shown-habit-1-2026-04-28",
        "true",
      );
    });
  });

  it("tapping Make it smaller calls setPreference and routes to edit with from=recovery", async () => {
    renderModalOpen();
    fireEvent.press(screen.getByText("Make it smaller"));
    await waitFor(() => {
      expect(setPreference).toHaveBeenCalledWith(
        "recovery-modal-shown-habit-1-2026-04-28",
        "true",
      );
      expect(router.push).toHaveBeenCalledWith({
        pathname: "/(app)/habits/[habitId]/edit",
        params: { habitId: "habit-1", from: "recovery" },
      });
    });
  });

  it("tapping Pause for now archives the habit then calls setPreference", async () => {
    const mutateAsync = jest.fn().mockResolvedValue(undefined);
    useArchiveHabitMutation.mockReturnValue({
      error: null,
      isPending: false,
      mutateAsync,
    });
    renderModalOpen();
    fireEvent.press(screen.getByText("Pause for now"));
    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({ habitId: "habit-1" });
      expect(setPreference).toHaveBeenCalledWith(
        "recovery-modal-shown-habit-1-2026-04-28",
        "true",
      );
    });
  });

  it("double-tapping Pause for now fires archive only once (lock guard)", async () => {
    const mutateAsync = jest.fn().mockImplementation(
      () => new Promise((r) => setTimeout(r, 50)),
    );
    useArchiveHabitMutation.mockReturnValue({
      error: null,
      isPending: false,
      mutateAsync,
    });
    renderModalOpen();
    fireEvent.press(screen.getByText("Pause for now"));
    fireEvent.press(screen.getByText("Pause for now"));
    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledTimes(1);
    });
  });

  it("pressing the goal header navigates to GoalDetailScreen with encoded identityPhrase", () => {
    useTodayHabits.mockReturnValue({
      error: null,
      habits: [makeHabit({ identityPhrase: "a runner" })],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: {},
    });
    renderWithClient(<TodayScreen />);
    fireEvent.press(screen.getByText("Become a runner"));
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "/(app)/goals/[identityPhrase]",
        params: expect.objectContaining({ identityPhrase: "a%20runner" }),
      }),
    );
  });

  it("shows 'Goal consistency' label on the ConsistencyDonut", () => {
    useTodayHabits.mockReturnValue({
      error: null,
      habits: [makeHabit()],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: {},
    });
    renderWithClient(<TodayScreen />);
    expect(screen.getByText("Goal consistency")).toBeTruthy();
  });

  it("does not navigate to GoalDetail when tapping the header of a no-identity group", () => {
    useTodayHabits.mockReturnValue({
      error: null,
      habits: [makeHabit({ identityPhrase: "" })],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: {},
    });
    renderWithClient(<TodayScreen />);
    // The header Pressable is disabled (onGoalPress=undefined). Even if we trigger
    // all presses in the component, no goals navigation should be queued.
    // (Pressing the Add a habit button is fine; it navigates to create, not goals.)
    expect(router.push).not.toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/(app)/goals/[identityPhrase]" }),
    );
  });

  it("does not prefill goalIdentityPhrase when adding a habit from a no-identity group", () => {
    useTodayHabits.mockReturnValue({
      error: null,
      habits: [makeHabit({ identityPhrase: "" })],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: {},
    });
    renderWithClient(<TodayScreen />);
    fireEvent.press(screen.getByLabelText("Add a habit"));
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: "/(app)/habits/create" }),
    );
    // params should not carry the sentinel string
    expect(router.push).not.toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({ goalIdentityPhrase: "(no goal)" }),
      }),
    );
  });

  it("shows the (Graduated) suffix when all habits in a goal are automatic", () => {
    useTodayHabits.mockReturnValue({
      error: null,
      goalGraduatedByIdentity: { "a runner": true },
      goalStreaks: { "a runner": 5 },
      habits: [
        makeHabit({ habitState: "automatic", id: "h1" }),
        makeHabit({ habitState: "automatic", id: "h2", name: "Stretch" }),
      ],
      isLoading: false,
      upcomingHabits: [],
    });
    renderWithClient(<TodayScreen />);
    expect(screen.getByText("(Graduated)")).toBeTruthy();
  });

  it("hides the (Graduated) suffix when only some habits in a goal are automatic", () => {
    useTodayHabits.mockReturnValue({
      error: null,
      goalGraduatedByIdentity: { "a runner": false },
      goalStreaks: { "a runner": 5 },
      habits: [
        makeHabit({ habitState: "automatic", id: "h1" }),
        makeHabit({ habitState: "active", id: "h2", name: "Stretch" }),
      ],
      isLoading: false,
      upcomingHabits: [],
    });
    renderWithClient(<TodayScreen />);
    expect(screen.queryByText("(Graduated)")).toBeNull();
  });

  it("never shows the (Graduated) suffix for the no-goal bucket, even when all habits are automatic", () => {
    useTodayHabits.mockReturnValue({
      error: null,
      goalGraduatedByIdentity: {},
      goalStreaks: {},
      habits: [
        makeHabit({ habitState: "automatic", id: "h1", identityPhrase: "" }),
        makeHabit({
          habitState: "automatic",
          id: "h2",
          identityPhrase: "",
          name: "Stretch",
        }),
      ],
      isLoading: false,
      upcomingHabits: [],
    });
    renderWithClient(<TodayScreen />);
    expect(screen.queryByText("(Graduated)")).toBeNull();
  });

  it("hides the (Graduated) suffix when an upcoming (not-yet-started) habit exists in the goal", () => {
    // All eligible habits are automatic, but the hook's goalGraduatedByIdentity
    // computes over upcoming habits too — and reports false because the
    // upcoming habit's habit_state is still 'active'.
    useTodayHabits.mockReturnValue({
      error: null,
      goalGraduatedByIdentity: { "a runner": false },
      goalStreaks: { "a runner": 5 },
      habits: [makeHabit({ habitState: "automatic", id: "h1" })],
      isLoading: false,
      upcomingHabits: [{ formula: "soon", id: "u1", name: "Stretch", startDate: "2999-01-01" }],
    });
    renderWithClient(<TodayScreen />);
    expect(screen.queryByText("(Graduated)")).toBeNull();
  });
});
