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

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@/tests/setup/render";

import TodayScreen from "@/features/today/screens/TodayScreen";
import { groupAndSortForToday } from "@/features/today/ordering";
import { resetClockForTesting, setNowForTesting } from "@/utils/clock";
import {
  getLoadHabitsErrorMessage,
  getSaveTodayStatusErrorMessage,
} from "@/utils/userFacingErrors";

import type { TodayHabitCardData } from "@/features/today/types";

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
    createdAt: "2025-01-01T00:00:00.000Z",
    cue: "morning coffee",
    formula: "After morning coffee, run for 2 minutes",
    habitState: "active",
    icon: null,
    id: "habit-1",
    identityPhrase: "a runner",
    name: "Run",
    offDay: false,
    reminderTime: null,
    reminderType: "none",
    skipCount: 0,
    startDate: "2026-04-01",
    streak: 12,
    tinyAction: "run for 2 minutes",
    todayStatus: null,
    ...overrides,
  };
}

// Test helper: forwards to mockTodayHabits while auto-deriving
// the `groups` field from `habits` (via the production ordering module) when
// the caller does not supply one. Lets tests keep the original
// `{ habits, isLoading, ... }` shape without manually computing groups every
// time.
function mockTodayHabits(value: Record<string, unknown>) {
  const habits = (value.habits as TodayHabitCardData[] | undefined) ?? [];
  const groups = value.groups ?? groupAndSortForToday(habits);
  (useTodayHabits as jest.Mock).mockReturnValue({ groups, ...value });
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
    mockTodayHabits({
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
    mockTodayHabits({
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

  it("renders the goal consistency donut with the pooled rate from consistencyByIdentity (regression for 1-of-2-done → 50%)", () => {
    mockTodayHabits({
      consistencyByIdentity: { "a runner": 0.5 },
      error: null,
      habits: [makeHabit()],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: { "a runner": 12 },
    });
    renderWithClient(<TodayScreen />);
    expect(screen.getByText("50%")).toBeTruthy();
  });

  it("shows the 'Weekly review' pill on the GoalContainer when reviewDue is true for the identity", () => {
    mockTodayHabits({
      error: null,
      habits: [makeHabit()],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: { "a runner": 12 },
      reviewDueByIdentity: { "a runner": true },
    });
    renderWithClient(<TodayScreen />);
    // accessibilityLabel disambiguates from the title-row Pressable that
    // shares the same onGoalPress handler; also serves as the screen-reader
    // name for the CTA.
    expect(screen.getByLabelText("Open weekly review")).toBeTruthy();
  });

  it("hides the 'Weekly review' pill when reviewDue is false for the identity", () => {
    mockTodayHabits({
      error: null,
      habits: [makeHabit()],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: { "a runner": 12 },
      reviewDueByIdentity: { "a runner": false },
    });
    renderWithClient(<TodayScreen />);
    expect(screen.queryByLabelText("Open weekly review")).toBeNull();
    // No dot-absence assertion here: this test doesn't seed
    // consistencyByIdentity, so consistencyRate is null and the donut isn't
    // rendered at all (GoalContainer.tsx:102) — a queryByTestId would pass
    // trivially. The silent-breakage guard for showAttentionDot lives in
    // GoalContainer.test.tsx, where baseProps() sets consistencyRate: 0.8.
  });

  it("shows 'Review status unavailable' (not a false-positive due hint) when the goal-status query errored", () => {
    mockTodayHabits({
      error: null,
      habits: [makeHabit()],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: { "a runner": 12 },
      reviewDueByIdentity: { "a runner": false },
      reviewStatusErrorByIdentity: { "a runner": true },
    });
    renderWithClient(<TodayScreen />);
    // Distinct copy: the user must not be misled into thinking a review is
    // actually due when we couldn't verify status.
    expect(screen.getByText("Review status unavailable")).toBeTruthy();
    expect(screen.queryByLabelText("Open weekly review")).toBeNull();
  });

  it("error state wins over a stale cached reviewDue when both are true", () => {
    // React Query retains the last-known data when a refetch fails, so this
    // pairing (data.isDue=true AND isError=true) is reachable: the goal's
    // status was due, then a later refetch errored. The error tone is the
    // honest read.
    mockTodayHabits({
      error: null,
      habits: [makeHabit()],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: { "a runner": 12 },
      reviewDueByIdentity: { "a runner": true },
      reviewStatusErrorByIdentity: { "a runner": true },
    });
    renderWithClient(<TodayScreen />);
    expect(screen.getByText("Review status unavailable")).toBeTruthy();
    expect(screen.queryByLabelText("Open weekly review")).toBeNull();
  });

  it("stacks the 'Weekly review' pill above the daily pill when reviewDue and remainingCount > 0", () => {
    // Both pills coexist when a habit is still incomplete and a review is
    // due. The review pill is the louder CTA; the daily "X remaining" pill
    // remains for state context. With one habit and one GoalContainer in
    // the mock, global queries are unambiguous — no within() needed (YAGNI).
    mockTodayHabits({
      error: null,
      habits: [makeHabit({ streak: 0, todayStatus: null })],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: { "a runner": 12 },
      reviewDueByIdentity: { "a runner": true },
    });
    renderWithClient(<TodayScreen />);
    expect(screen.getByText("1 remaining to complete")).toBeTruthy();
    expect(screen.getByLabelText("Open weekly review")).toBeTruthy();
  });

  it("renders '1 remaining to complete' pill when one habit is incomplete", () => {
    mockTodayHabits({
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
    mockTodayHabits({
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
    mockTodayHabits({
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
    mockTodayHabits({
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
    mockTodayHabits({
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
    mockTodayHabits({
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
    mockTodayHabits({
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
    mockTodayHabits({
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
    mockTodayHabits({
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
    mockTodayHabits({
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
    mockTodayHabits({
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

  it("does not render a 'You showed up today.' affirmation when all habits are logged (redundant with the All done pill and the goal subhead)", () => {
    mockTodayHabits({
      error: null,
      habits: [makeHabit({ todayStatus: "done" })],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: {},
    });
    renderWithClient(<TodayScreen />);
    // The "All done ✓" pill (inside GoalContainer) and the streak subhead
    // already cover the all-logged state; the standalone affirmation was
    // removed to avoid the same signal stamping N times across N goal
    // cards on an all-done day.
    expect(screen.queryByText("You showed up today.")).toBeNull();
  });

  it("renders the recovery modal when shouldShowModal is true", () => {
    mockTodayHabits({
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
    mockTodayHabits({
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
    mockTodayHabits({
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
    // This test stops at the mutation boundary because useArchiveHabitMutation
    // is mocked away. The reminder-teardown half of "Pause for now" is
    // asserted at the API layer in api.test.ts → describe('archiveHabit') →
    // 'cancels the OS reminder for active habits before flipping status'.
    // That test exists specifically because this entry point used to bypass
    // reminder cancellation (the screen-layer handler in HabitDetailScreen
    // owned it). Don't move the cancelReminder call out of api.ts without
    // failing both tests in tandem.
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
    mockTodayHabits({
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

  it("shows 'Consistency' label on the ConsistencyDonut", () => {
    mockTodayHabits({
      consistencyByIdentity: { "a runner": 0.9 },
      error: null,
      habits: [makeHabit()],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: {},
    });
    renderWithClient(<TodayScreen />);
    expect(screen.getByText("Consistency")).toBeTruthy();
  });

  it("filters orphan habits (empty identityPhrase) out of the Today view", () => {
    // Previously the no-identity bucket rendered as the "(no goal)"
    // GoalContainer. After action-first ordering, orphan habits are filtered
    // at the hook boundary and never reach the render tree.
    mockTodayHabits({
      error: null,
      habits: [makeHabit({ identityPhrase: "" })],
      isLoading: false,
      upcomingHabits: [],
      goalStreaks: {},
    });
    renderWithClient(<TodayScreen />);
    expect(screen.queryByText(/^Become /)).toBeNull();
    expect(screen.queryByText("Run")).toBeNull();
  });

  it("shows the (Graduated) suffix when all habits in a goal are automatic", () => {
    mockTodayHabits({
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
    mockTodayHabits({
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

  it.skip("(legacy) never shows the (Graduated) suffix for the no-goal bucket — superseded by the orphan-filter test above", () => {
    mockTodayHabits({
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
    mockTodayHabits({
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

  // Ported from legacy src/tests/screen/TodayScreen.test.tsx (deleted in the
  // same change that landed Today ordering — see design spec
  // design/superpowers-specs/2026-05-28-today-ordering-design.md, B7).
  it("shows a loading state while today data is still resolving", () => {
    mockTodayHabits({
      error: null,
      goalStreaks: {},
      habits: [],
      isLoading: true,
      upcomingHabits: [],
    });

    renderWithClient(<TodayScreen />);

    expect(screen.getByText("Loading your Today view...")).toBeTruthy();
    expect(screen.queryByText("No active habits yet")).toBeNull();
  });

  it("routes to Create Habit from the empty state CTA", () => {
    mockTodayHabits({
      error: null,
      goalStreaks: {},
      habits: [],
      isLoading: false,
      upcomingHabits: [],
    });

    renderWithClient(<TodayScreen />);

    fireEvent.press(screen.getByText("Create your first habit"));

    expect(router.push).toHaveBeenCalledWith("/(app)/habits/create");
  });

  it("prevents a second status write while the first one is still in flight", async () => {
    let resolveMutation: (() => void) | undefined;
    const deferred = new Promise<void>((resolve) => {
      resolveMutation = resolve;
    });
    const mockMutateAsync = jest.fn().mockReturnValue(deferred);
    useUpsertTodayHabitStatusMutation.mockReturnValue({
      error: null,
      isPending: false,
      mutateAsync: mockMutateAsync,
    });
    mockTodayHabits({
      error: null,
      goalStreaks: { "a runner": 5 },
      habits: [makeHabit()],
      isLoading: false,
      upcomingHabits: [],
    });

    renderWithClient(<TodayScreen />);

    fireEvent.press(screen.getByLabelText("Log Run"));
    fireEvent.press(screen.getByLabelText("Log Run"));

    expect(mockMutateAsync).toHaveBeenCalledTimes(1);

    if (resolveMutation) resolveMutation();
  });
});
