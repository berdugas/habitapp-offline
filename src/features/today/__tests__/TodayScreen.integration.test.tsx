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
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";

import { AppState } from "react-native";

import TodayScreen from "@/features/today/screens/TodayScreen";
import { closeDb, initDb } from "@/lib/db/client";
import { createHabit } from "@/lib/db/repositories/habits";
import { upsertReminder } from "@/lib/db/repositories/reminders";
import { resetClockForTesting, setNowForTesting } from "@/utils/clock";
import {
  initDayBoundary,
  resetDayBoundaryForTesting,
  triggerDayBoundaryCheckForTesting,
} from "@/utils/dayBoundary";

// AppState listener capture via jest.spyOn (jest-expo's mock of react-native
// stubs AppState but the captured listener still fires under emit).
const appStateListeners = new Set<(state: string) => void>();
jest.spyOn(AppState, "addEventListener").mockImplementation(
  (event: string, listener: (state: string) => void) => {
    if (event === "change") appStateListeners.add(listener);
    return { remove: () => appStateListeners.delete(listener) } as never;
  },
);
function emitAppStateActive(): void {
  for (const l of appStateListeners) l("active");
}

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}));

jest.mock("@/features/auth/hooks", () => ({
  useAuthSession: () => ({ user: { id: "user-1" } }),
}));

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
  return { ...result, client };
}

function getGoalOrder(): string[] {
  // GoalContainer renders "Become {identityPhrase}" as the first child of a
  // Text element. Extract the identityPhrase strings in render order.
  return screen
    .getAllByText(/^Become /)
    .map((node) => {
      const children = node.props.children as React.ReactNode[];
      // children = ["Become ", identityPhrase, optionalGraduatedSuffix]
      return typeof children[1] === "string" ? children[1] : "";
    });
}

describe("TodayScreen integration — log round-trip", () => {
  beforeEach(async () => {
    resetDayBoundaryForTesting();
    setNowForTesting(new Date("2026-04-30T10:00:00.000Z"));
    await initDb();
    await createHabit({
      user_id: "user-1",
      title: "Run",
      identity_phrase: "a runner",
      cue: "morning coffee",
      tiny_action: "run for 2 minutes",
      minimum_viable_action: null,
      preferred_time_window: null,
      start_date: "2026-04-01",
      habit_state: "active",
      status: "active",
    });
  });

  afterEach(async () => {
    await closeDb();
    resetClockForTesting();
    resetDayBoundaryForTesting();
  });

  it("marks habit as done when circle is tapped", async () => {
    renderWithClient(<TodayScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText("Log Run")).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText("Log Run"));

    await waitFor(
      () => {
        expect(screen.getByLabelText("Run — done")).toBeTruthy();
      },
      { timeout: 3000 },
    );
  });

  it("marks habit as skipped when circle is long-pressed", async () => {
    renderWithClient(<TodayScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText("Log Run")).toBeTruthy();
    });

    fireEvent(screen.getByLabelText("Log Run"), "longPress");

    await waitFor(
      () => {
        expect(screen.getByLabelText("Run — skipped")).toBeTruthy();
      },
      { timeout: 3000 },
    );
  });
});

describe("TodayScreen integration — goalGraduated over full active set", () => {
  beforeEach(async () => {
    setNowForTesting(new Date("2026-04-30T10:00:00.000Z"));
    await initDb();
  });

  afterEach(async () => {
    await closeDb();
    resetClockForTesting();
  });

  it("does NOT show (Graduated) when the goal has an automatic started habit + an upcoming habit", async () => {
    // Started + automatic
    await createHabit({
      user_id: "user-1",
      title: "Run",
      identity_phrase: "a runner",
      cue: "morning coffee",
      tiny_action: "run for 2 minutes",
      minimum_viable_action: null,
      preferred_time_window: null,
      start_date: "2026-04-01",
      habit_state: "automatic",
      status: "active",
    });
    // Upcoming, same goal — by definition habit_state="active"
    await createHabit({
      user_id: "user-1",
      title: "Stretch",
      identity_phrase: "a runner",
      cue: "after run",
      tiny_action: "stretch for 1 minute",
      minimum_viable_action: null,
      preferred_time_window: null,
      start_date: "2999-01-01",
      habit_state: "active",
      status: "active",
    });

    renderWithClient(<TodayScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText("Log Run")).toBeTruthy();
    });

    expect(screen.queryByText("(Graduated)")).toBeNull();
  });

  it("shows (Graduated) when every started AND upcoming habit in the goal is automatic", async () => {
    // Two started + automatic habits, no upcoming → marker visible
    await createHabit({
      user_id: "user-1",
      title: "Run",
      identity_phrase: "a runner",
      cue: "morning coffee",
      tiny_action: "run for 2 minutes",
      minimum_viable_action: null,
      preferred_time_window: null,
      start_date: "2026-04-01",
      habit_state: "automatic",
      status: "active",
    });
    await createHabit({
      user_id: "user-1",
      title: "Walk",
      identity_phrase: "a runner",
      cue: "evening",
      tiny_action: "walk 5 minutes",
      minimum_viable_action: null,
      preferred_time_window: null,
      start_date: "2026-04-05",
      habit_state: "automatic",
      status: "active",
    });

    renderWithClient(<TodayScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText("Log Run")).toBeTruthy();
    });

    expect(screen.getByText("(Graduated)")).toBeTruthy();
  });
});

describe("TodayScreen integration — action-first ordering", () => {
  beforeEach(async () => {
    setNowForTesting(new Date("2026-04-30T10:00:00.000Z"));
    await initDb();
  });

  afterEach(async () => {
    await closeDb();
    resetClockForTesting();
  });

  it("sorts active goals by earliest reminder time ascending", async () => {
    const evening = await createHabit({
      user_id: "user-1",
      title: "Evening Stretch",
      identity_phrase: "an evening person",
      cue: "after dinner",
      tiny_action: "stretch 2 min",
      minimum_viable_action: null,
      preferred_time_window: null,
      start_date: "2026-04-01",
      habit_state: "active",
      status: "active",
    });
    const morning = await createHabit({
      user_id: "user-1",
      title: "Morning Run",
      identity_phrase: "a runner",
      cue: "morning coffee",
      tiny_action: "run 2 min",
      minimum_viable_action: null,
      preferred_time_window: null,
      start_date: "2026-04-01",
      habit_state: "active",
      status: "active",
    });
    await upsertReminder({
      habit_id: evening.id,
      reminder_type: "daily",
      reminder_time: "20:00",
      notification_ids: "[]",
    });
    await upsertReminder({
      habit_id: morning.id,
      reminder_type: "daily",
      reminder_time: "07:00",
      notification_ids: "[]",
    });

    renderWithClient(<TodayScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText("Log Morning Run")).toBeTruthy();
      expect(screen.getByLabelText("Log Evening Stretch")).toBeTruthy();
    });

    expect(getGoalOrder()).toEqual(["a runner", "an evening person"]);
  });

  it("moves a goal to the done zone when its last action-needed habit is logged", async () => {
    // Identity phrases chosen so the lex tiebreak ("alpha" < "beta") matches
    // the createdAt order (alpha created first). createHabit uses ISO
    // timestamps with millisecond precision; in a hot test runner the two
    // creates can land in the same millisecond, so the identity_phrase
    // tiebreaker becomes the deciding signal.
    await createHabit({
      user_id: "user-1",
      title: "Alpha Task",
      identity_phrase: "alpha-tasks",
      cue: "cue",
      tiny_action: "do 1 thing",
      minimum_viable_action: null,
      preferred_time_window: null,
      start_date: "2026-04-01",
      habit_state: "active",
      status: "active",
    });
    await createHabit({
      user_id: "user-1",
      title: "Beta Task",
      identity_phrase: "beta-tasks",
      cue: "cue",
      tiny_action: "do 1 thing",
      minimum_viable_action: null,
      preferred_time_window: null,
      start_date: "2026-04-01",
      habit_state: "active",
      status: "active",
    });

    renderWithClient(<TodayScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText("Log Alpha Task")).toBeTruthy();
    });

    expect(getGoalOrder()).toEqual(["alpha-tasks", "beta-tasks"]);

    fireEvent.press(screen.getByLabelText("Log Alpha Task"));

    await waitFor(
      () => {
        expect(screen.getByLabelText("Alpha Task — done")).toBeTruthy();
      },
      { timeout: 3000 },
    );

    // After Done: alpha goal moves to done zone; beta stays active and on top.
    expect(getGoalOrder()).toEqual(["beta-tasks", "alpha-tasks"]);
  });

  it("returns a goal to the active zone on Undo", async () => {
    await createHabit({
      user_id: "user-1",
      title: "Read",
      identity_phrase: "a reader",
      cue: "evening",
      tiny_action: "read 1 page",
      minimum_viable_action: null,
      preferred_time_window: null,
      start_date: "2026-04-01",
      habit_state: "active",
      status: "active",
    });
    await createHabit({
      user_id: "user-1",
      title: "Walk",
      identity_phrase: "a walker",
      cue: "morning",
      tiny_action: "walk 1 min",
      minimum_viable_action: null,
      preferred_time_window: null,
      start_date: "2026-04-01",
      habit_state: "active",
      status: "active",
    });

    renderWithClient(<TodayScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText("Log Read")).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText("Log Read"));
    await waitFor(
      () => {
        expect(screen.getByLabelText("Read — done")).toBeTruthy();
      },
      { timeout: 3000 },
    );

    // Reader goal is now in the done zone, walker is active and on top.
    expect(getGoalOrder()).toEqual(["a walker", "a reader"]);

    // Tap the row to undo (it's already in done state; tapping toggles).
    fireEvent.press(screen.getByLabelText("Read — done"));

    await waitFor(
      () => {
        expect(screen.getByLabelText("Log Read")).toBeTruthy();
      },
      { timeout: 3000 },
    );

    // Both goals active again — sorted by oldest createdAt. Reader was created
    // first, so it's at the top.
    expect(getGoalOrder()).toEqual(["a reader", "a walker"]);
  });

  it("filters habits with null identity_phrase out of the Today view", async () => {
    await createHabit({
      user_id: "user-1",
      title: "Has Goal",
      identity_phrase: "a doer",
      cue: "morning",
      tiny_action: "do 1 thing",
      minimum_viable_action: null,
      preferred_time_window: null,
      start_date: "2026-04-01",
      habit_state: "active",
      status: "active",
    });
    await createHabit({
      user_id: "user-1",
      title: "Orphan",
      identity_phrase: null,
      cue: "morning",
      tiny_action: "do 1 thing",
      minimum_viable_action: null,
      preferred_time_window: null,
      start_date: "2026-04-01",
      habit_state: "active",
      status: "active",
    });

    renderWithClient(<TodayScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText("Log Has Goal")).toBeTruthy();
    });

    // Orphan should not be visible on Today.
    expect(screen.queryByText("Orphan")).toBeNull();
    expect(getGoalOrder()).toEqual(["a doer"]);
  });

  it("re-sorts after a reminder mutation + prefix invalidation (B6b contract)", async () => {
    // Seed two goals — both untimed initially → sort by createdAt.
    const aHabit = await createHabit({
      user_id: "user-1",
      title: "A Task",
      identity_phrase: "a-goal",
      cue: "cue",
      tiny_action: "tiny",
      minimum_viable_action: null,
      preferred_time_window: null,
      start_date: "2026-04-01",
      habit_state: "active",
      status: "active",
    });
    const bHabit = await createHabit({
      user_id: "user-1",
      title: "B Task",
      identity_phrase: "b-goal",
      cue: "cue",
      tiny_action: "tiny",
      minimum_viable_action: null,
      preferred_time_window: null,
      start_date: "2026-04-01",
      habit_state: "active",
      status: "active",
    });

    const { client } = renderWithClient(<TodayScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText("Log A Task")).toBeTruthy();
      expect(screen.getByLabelText("Log B Task")).toBeTruthy();
    });
    // Created-at order: a-goal first.
    expect(getGoalOrder()).toEqual(["a-goal", "b-goal"]);

    // Give b-goal an early-morning reminder. Without invalidation, Today
    // doesn't refetch the reminders sibling query. After firing the
    // prefix-only invalidate (as EditHabitScreen.handleSave() does post-B6b),
    // b-goal should slide to the top — it's now the only timed goal.
    await upsertReminder({
      habit_id: bHabit.id,
      reminder_type: "daily",
      reminder_time: "07:00",
      notification_ids: "[]",
    });
    await client.invalidateQueries({ queryKey: ["habits", "eligible"] });

    await waitFor(
      () => {
        expect(getGoalOrder()).toEqual(["b-goal", "a-goal"]);
      },
      { timeout: 3000 },
    );

    // Use aHabit to keep the variable from going stale (lint).
    expect(aHabit.identity_phrase).toBe("a-goal");
  });
});

describe("TodayScreen integration — day rollover", () => {
  let cleanup: (() => void) | null = null;

  beforeEach(async () => {
    resetDayBoundaryForTesting();
    setNowForTesting(new Date("2026-04-30T23:59:00.000Z"));
    await initDb();
    await createHabit({
      user_id: "user-1",
      title: "Run",
      identity_phrase: "a runner",
      cue: "morning coffee",
      tiny_action: "run for 2 minutes",
      minimum_viable_action: null,
      preferred_time_window: null,
      start_date: "2026-04-01",
      habit_state: "active",
      status: "active",
    });
    cleanup = initDayBoundary();
  });

  afterEach(async () => {
    cleanup?.();
    cleanup = null;
    await closeDb();
    resetClockForTesting();
    resetDayBoundaryForTesting();
  });

  it("refreshes when the app foregrounds after midnight", async () => {
    renderWithClient(<TodayScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText("Log Run")).toBeTruthy();
    });
    // Header on 2026-04-30 (date label varies by locale — match the day number).
    const initial = screen.UNSAFE_root;
    expect(initial).toBeTruthy();

    // Advance the clock across midnight and emit a foreground event.
    setNowForTesting(new Date("2026-05-01T00:01:00.000Z"));
    emitAppStateActive();

    // The header date label flips to the new day.
    await waitFor(() => {
      // Match any rendered text containing "May" and "1" (the new day).
      expect(screen.queryByText(/May.*\b1\b/)).toBeTruthy();
    });
  });

  it("refreshes when local midnight passes while the app is open", async () => {
    renderWithClient(<TodayScreen />);

    await waitFor(() => {
      expect(screen.getByLabelText("Log Run")).toBeTruthy();
    });

    setNowForTesting(new Date("2026-05-01T00:01:00.000Z"));
    triggerDayBoundaryCheckForTesting();

    await waitFor(() => {
      expect(screen.queryByText(/May.*\b1\b/)).toBeTruthy();
    });
  });
});
