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

import EditHabitScreen from "@/features/habits/screens/EditHabitScreen";

const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn(() => true);
const mockUseLocalSearchParams = jest.fn();
const mockUseOwnedHabitQuery = jest.fn();
const mockUseUpdateHabitMutation = jest.fn();
const mockUseGenerateHabitRewriteMutation = jest.fn();
const mockMutateAsync = jest.fn();
const mockGenerateRewriteMutateAsync = jest.fn();
const aiRewriteHelperCopy =
  "AI can suggest a rewrite, but you stay in control. It will not change your habit unless you edit and save it.";

jest.mock("expo-router", () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
    back: (...args: unknown[]) => mockBack(...args),
    canGoBack: () => mockCanGoBack(),
  },
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

jest.mock("@/features/habits/hooks", () => ({
  useOwnedHabitQuery: (habitId: string | string[] | undefined) =>
    mockUseOwnedHabitQuery(habitId),
  useUpdateHabitMutation: () => mockUseUpdateHabitMutation(),
}));

jest.mock("@/features/recommendations/hooks", () => ({
  useGenerateHabitRewriteMutation: () => mockUseGenerateHabitRewriteMutation(),
}));

jest.mock("@/features/auth/hooks", () => ({
  useAuthSession: jest.fn(() => ({ user: { id: "user-1" } })),
}));

jest.mock("@/lib/db/repositories/reminders", () => ({
  getReminderByHabitId: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/features/reminders/notifications", () => ({
  scheduleReminder: jest.fn().mockResolvedValue(undefined),
  cancelReminder: jest.fn().mockResolvedValue(undefined),
  rescheduleAll: jest.fn().mockResolvedValue(undefined),
}));

const baseHabitData = {
  active_days: "[1,2,3,4,5,6,7]",
  id: "habit-1",
  title: "Reading",
  identity_phrase: "Become a reader",
  cue: "After I brush my teeth",
  tiny_action: "Read 1 page",
  minimum_viable_action: null,
  preferred_time_window: "Evening",
  habit_state: "active",
  status: "active",
  start_date: "2026-04-24",
};

describe("EditHabitScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // clearAllMocks wipes implementations too — restore the default
    // canGoBack=true so handleSave's back-stack hygiene goes through
    // router.back() instead of the deep-link replace fallback.
    mockCanGoBack.mockReturnValue(true);
    mockUseLocalSearchParams.mockReturnValue({
      habitId: "habit-1",
    });
    mockUseOwnedHabitQuery.mockReturnValue({
      data: baseHabitData,
      error: null,
      isLoading: false,
    });
    mockUseUpdateHabitMutation.mockReturnValue({
      error: null,
      isPending: false,
      mutateAsync: mockMutateAsync,
    });
    mockUseGenerateHabitRewriteMutation.mockReturnValue({
      error: null,
      isPending: false,
      mutateAsync: mockGenerateRewriteMutateAsync,
    });
    mockMutateAsync.mockResolvedValue({
      id: "habit-1",
    });
    mockGenerateRewriteMutateAsync.mockResolvedValue({
      explanation:
        "This keeps the action small and tied to a clear daily moment.",
      suggestedStackTrigger: "After breakfast",
      suggestedTinyAction: "Read one paragraph",
    });
  });

  it("shows a loading state while the habit form is resolving", () => {
    mockUseOwnedHabitQuery.mockReturnValue({
      data: null,
      error: null,
      isLoading: true,
    });

    render(<EditHabitScreen />);

    expect(screen.getByText("Loading habit details...")).toBeTruthy();
  });

  it("shows a friendly error when the habit cannot be loaded", () => {
    mockUseOwnedHabitQuery.mockReturnValue({
      data: null,
      error: new Error("boom"),
      isLoading: false,
    });

    render(<EditHabitScreen />);

    expect(
      screen.getByText("We couldn't load this habit right now. Try again."),
    ).toBeTruthy();
  });

  it("prefills the editable fields from the current habit", () => {
    render(<EditHabitScreen />);

    expect(mockUseOwnedHabitQuery).toHaveBeenCalledWith("habit-1");
    expect(screen.queryByText("SUGGESTED ADJUSTMENT")).toBeNull();
    expect(screen.getByDisplayValue("Reading")).toBeTruthy();
    // identityPhrase is now a read-only card, not an editable input
    expect(screen.getByText("Become a reader")).toBeTruthy();
    expect(screen.getByDisplayValue("After I brush my teeth")).toBeTruthy();
    expect(screen.getByDisplayValue("Read 1 page")).toBeTruthy();
  });

  it("shows tiny-action suggestion guidance without changing hydrated fields", () => {
    mockUseLocalSearchParams.mockReturnValue({
      habitId: "habit-1",
      suggestionType: "make_tiny_action_smaller",
    });

    render(<EditHabitScreen />);

    expect(screen.getByText("SUGGESTED ADJUSTMENT")).toBeTruthy();
    expect(screen.getByText("Make the action smaller")).toBeTruthy();
    expect(screen.queryByText(aiRewriteHelperCopy)).toBeNull();
    expect(screen.queryByText("Generate rewrite")).toBeNull();
    expect(screen.queryByText("AI rewrite idea")).toBeNull();
    expect(screen.queryByText("Copy into fields")).toBeNull();
    expect(
      screen.getByText(
        "Try choosing a tiny action that feels almost effortless for one week.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Suggested draft")).toBeTruthy();
    expect(
      screen.getByText(
        "Look at your Tiny action field and make it smaller. For example, change a big action into one small step you can do in under two minutes.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Why this suggestion")).toBeTruthy();
    expect(
      screen.getByText("You answered that the tiny action was too hard."),
    ).toBeTruthy();
    expect(screen.getByDisplayValue("Read 1 page")).toBeTruthy();
    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(mockGenerateRewriteMutateAsync).not.toHaveBeenCalled();
  });

  it("shows trigger suggestion guidance for a valid suggestion type", () => {
    mockUseLocalSearchParams.mockReturnValue({
      habitId: "habit-1",
      suggestionType: "change_trigger",
    });

    render(<EditHabitScreen />);

    expect(screen.getByText("SUGGESTED ADJUSTMENT")).toBeTruthy();
    expect(screen.getByText("Choose a clearer trigger")).toBeTruthy();
    expect(screen.queryByText(aiRewriteHelperCopy)).toBeNull();
    expect(screen.queryByText("Generate rewrite")).toBeNull();
    expect(screen.queryByText("AI rewrite idea")).toBeNull();
    expect(screen.queryByText("Copy into fields")).toBeNull();
    expect(
      screen.getByText(
        "Try attaching this habit to a specific moment that already happens every day.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Suggested draft")).toBeTruthy();
    expect(
      screen.getByText(
        "Look at your Stack trigger field and make it more specific. Try a clear moment like after breakfast or after brushing your teeth.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Why this suggestion")).toBeTruthy();
    expect(
      screen.getByText("You answered that the trigger did not work."),
    ).toBeTruthy();
    expect(screen.getByDisplayValue("After I brush my teeth")).toBeTruthy();
  });

  it("shows action-shrink suggestion guidance when navigated with make_tiny_action_smaller", () => {
    mockUseLocalSearchParams.mockReturnValue({
      habitId: "habit-1",
      suggestionType: "make_tiny_action_smaller",
    });

    render(<EditHabitScreen />);

    expect(screen.getByText("SUGGESTED ADJUSTMENT")).toBeTruthy();
    expect(screen.getByText("Make the action smaller")).toBeTruthy();
    expect(
      screen.getByText(
        "Try choosing a tiny action that feels almost effortless for one week.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText("Generate rewrite")).toBeNull();
    expect(mockGenerateRewriteMutateAsync).not.toHaveBeenCalled();
  });

  it("hides suggestion guidance for an invalid suggestion type", () => {
    mockUseLocalSearchParams.mockReturnValue({
      habitId: "habit-1",
      suggestionType: "rewrite_everything",
    });

    render(<EditHabitScreen />);

    expect(screen.queryByText("SUGGESTED ADJUSTMENT")).toBeNull();
    expect(screen.queryByText("Make the action smaller")).toBeNull();
    expect(screen.queryByText("Why this suggestion")).toBeNull();
    expect(screen.queryByText("Suggested draft")).toBeNull();
    expect(screen.queryByText(aiRewriteHelperCopy)).toBeNull();
    expect(screen.queryByText("Generate rewrite")).toBeNull();
    expect(screen.queryByText("AI rewrite idea")).toBeNull();
    expect(screen.queryByText("Copy into fields")).toBeNull();
    expect(screen.getByDisplayValue("Read 1 page")).toBeTruthy();
  });

  it("does not duplicate After in the preview when manually typed", () => {
    render(<EditHabitScreen />);

    fireEvent.changeText(
      screen.getByDisplayValue("After I brush my teeth"),
      "After breakfast",
    );

    expect(
      screen.getByText("After breakfast, I will Read 1 page."),
    ).toBeTruthy();
    expect(
      screen.queryByText("After After breakfast, I will Read 1 page."),
    ).toBeNull();
  });

  it("blocks blank required edits before saving", async () => {
    render(<EditHabitScreen />);

    fireEvent.changeText(screen.getByDisplayValue("Reading"), "   ");
    fireEvent.press(screen.getByText("Save changes"));

    await waitFor(() => {
      expect(
        screen.getByText("Fix the highlighted fields before saving."),
      ).toBeTruthy();
    });

    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("submits trimmed setup values and routes back to detail on success", async () => {
    mockUseLocalSearchParams.mockReturnValue({
      habitId: "habit-1",
      suggestionType: "make_tiny_action_smaller",
    });

    render(<EditHabitScreen />);

    fireEvent.changeText(screen.getByDisplayValue("Reading"), "  Reading habit  ");
    fireEvent.changeText(
      screen.getByDisplayValue("After I brush my teeth"),
      "  After breakfast  ",
    );
    fireEvent.changeText(screen.getByDisplayValue("Read 1 page"), "  Read 2 pages  ");

    fireEvent.press(screen.getByText("Save changes"));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        habitId: "habit-1",
        payload: {
          activeDays: [1, 2, 3, 4, 5, 6, 7],
          title: "Reading habit",
          identityPhrase: "Become a reader",
          cue: "breakfast",
          tinyAction: "Read 2 pages",
          minimumViableAction: "",
          preferredTimeWindow: "Evening",
          icon: "",
        },
      });
    });

    // Save uses router.back() (not router.replace) when canGoBack=true so
    // the EditHabit entry is popped instead of swapping into a duplicate
    // HabitDetail entry — see EditHabitScreen-post-save-navigation tests.
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("preserves preferred_time_window from the original habit on save (P1 regression)", async () => {
    render(<EditHabitScreen />);

    fireEvent.press(screen.getByText("Save changes"));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            preferredTimeWindow: "Evening",
          }),
        }),
      );
    });
  });

  it("does not cancel an existing reminder when saving before reminder load completes (P2 regression)", async () => {
    const { cancelReminder } = require("@/features/reminders/notifications");
    const { getReminderByHabitId } = require("@/lib/db/repositories/reminders");
    // Never resolves — simulates save happening before DB read finishes
    getReminderByHabitId.mockReturnValue(new Promise(() => {}));

    render(<EditHabitScreen />);
    fireEvent.press(screen.getByText("Save changes"));

    await waitFor(() => { expect(mockMutateAsync).toHaveBeenCalled(); });

    expect(cancelReminder).not.toHaveBeenCalled();
  });

  it("does not cancel an existing reminder when the reminder load fails (P2 regression)", async () => {
    const { cancelReminder } = require("@/features/reminders/notifications");
    const { getReminderByHabitId } = require("@/lib/db/repositories/reminders");
    // Rejects — simulates DB read error
    getReminderByHabitId.mockRejectedValue(new Error("db error"));

    render(<EditHabitScreen />);

    await waitFor(() => { expect(getReminderByHabitId).toHaveBeenCalled(); });

    fireEvent.press(screen.getByText("Save changes"));

    await waitFor(() => { expect(mockMutateAsync).toHaveBeenCalled(); });

    expect(cancelReminder).not.toHaveBeenCalled();
  });

  it("preserves user input when save fails", async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error("save failed"));

    render(<EditHabitScreen />);

    fireEvent.changeText(screen.getByDisplayValue("Reading"), "Reading updated");
    fireEvent.changeText(
      screen.getByDisplayValue("Read 1 page"),
      "Read 2 pages",
    );
    fireEvent.press(screen.getByText("Save changes"));

    await waitFor(() => {
      expect(
        screen.getByText("We couldn't save your changes right now. Try again."),
      ).toBeTruthy();
    });

    expect(screen.getByDisplayValue("Reading updated")).toBeTruthy();
    expect(screen.getByDisplayValue("Read 2 pages")).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
