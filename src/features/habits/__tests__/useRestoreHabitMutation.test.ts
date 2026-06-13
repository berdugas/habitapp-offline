jest.mock("@/features/reminders/notifications", () => ({
  cancelReminder: jest.fn().mockResolvedValue(undefined),
  materializePendingReminder: jest.fn().mockResolvedValue(true),
  persistReminderIntent: jest.fn(),
  scheduleReminder: jest.fn(),
}));

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
import { renderHook, waitFor } from "@testing-library/react-native";
import React from "react";

import {
  getArchivedGoalDetailQueryKey,
  useDeleteHabitMutation,
  useRestoreHabitMutation,
} from "@/features/habits/hooks";
import { archiveHabit } from "@/features/habits/api";
import { closeDb, initDb } from "@/lib/db/client";
import { createHabit as repoCreateHabit } from "@/lib/db/repositories/habits";
import { resetClockForTesting, setNowForTesting } from "@/utils/clock";

jest.mock("@/features/auth/hooks", () => ({
  useAuthSession: () => ({ user: { id: "user-1" } }),
}));

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

async function seedArchivedHabit(identity_phrase: string) {
  const habit = await repoCreateHabit({
    user_id: "user-1",
    title: "Read",
    identity_phrase,
    cue: "after coffee",
    tiny_action: "read 1 page",
    minimum_viable_action: null,
    preferred_time_window: null,
    start_date: "2026-04-01",
    habit_state: "active",
    status: "active",
  });
  await archiveHabit("user-1", habit.id, "full");
  return habit;
}

describe("per-habit mutation cache invalidation — archived-goal-detail prefix", () => {
  beforeEach(async () => {
    await initDb();
    setNowForTesting(new Date("2026-05-18T12:00:00.000Z"));
  });

  afterEach(async () => {
    await closeDb();
    resetClockForTesting();
  });

  it("restoring a single habit invalidates the archived-goal-detail query for its phrase — back-nav into the parent goal screen sees fresh data", async () => {
    // Reviewer-flagged regression: without prefix invalidation, the cache for
    // the parent ArchivedGoalDetailScreen keeps the pre-mutation 'fully
    // archived' snapshot and the user back-navs into a stale view.
    const habit = await seedArchivedHabit("a writer");
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    // Seed the archived-goal-detail query in cache so we can observe whether
    // it gets invalidated. The query data shape doesn't matter for the
    // assertion — only the cache entry's invalidation state does.
    const detailKey = getArchivedGoalDetailQueryKey("user-1", "a writer");
    client.setQueryData(detailKey, []);
    expect(client.getQueryState(detailKey)?.isInvalidated).toBe(false);

    const { result } = renderHook(() => useRestoreHabitMutation(), {
      wrapper: makeWrapper(client),
    });

    await result.current.mutateAsync({ habitId: habit.id });

    await waitFor(() => {
      expect(client.getQueryState(detailKey)?.isInvalidated).toBe(true);
    });
  });

  it("deleting a single habit invalidates the archived-goal-detail query for its phrase", async () => {
    const habit = await seedArchivedHabit("a writer");
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const detailKey = getArchivedGoalDetailQueryKey("user-1", "a writer");
    client.setQueryData(detailKey, []);

    const { result } = renderHook(() => useDeleteHabitMutation(), {
      wrapper: makeWrapper(client),
    });

    await result.current.mutateAsync({ habitId: habit.id });

    await waitFor(() => {
      expect(client.getQueryState(detailKey)?.isInvalidated).toBe(true);
    });
  });

  it("invalidation is broad-prefix — hits every cached identity_phrase, not just the habit's own", async () => {
    // The mutation hook doesn't know the habit's phrase ahead of time (the
    // variables are { habitId } only). Prefix invalidation ensures every
    // cached archived-goal-detail entry refreshes, even ones for unrelated
    // phrases that might also be displayed in the back stack.
    const habit = await seedArchivedHabit("a writer");
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const writerKey = getArchivedGoalDetailQueryKey("user-1", "a writer");
    const runnerKey = getArchivedGoalDetailQueryKey("user-1", "a runner");
    client.setQueryData(writerKey, []);
    client.setQueryData(runnerKey, []);

    const { result } = renderHook(() => useRestoreHabitMutation(), {
      wrapper: makeWrapper(client),
    });

    await result.current.mutateAsync({ habitId: habit.id });

    await waitFor(() => {
      expect(client.getQueryState(writerKey)?.isInvalidated).toBe(true);
      expect(client.getQueryState(runnerKey)?.isInvalidated).toBe(true);
    });
  });
});
