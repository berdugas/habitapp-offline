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

import TodayScreen from "@/features/today/screens/TodayScreen";
import { closeDb, initDb } from "@/lib/db/client";
import { createHabit } from "@/lib/db/repositories/habits";
import { resetClockForTesting, setNowForTesting } from "@/utils/clock";

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
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("TodayScreen integration — log round-trip", () => {
  beforeEach(async () => {
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
  });

  it("shows 'Done ✓' after tapping Done", async () => {
    renderWithClient(<TodayScreen />);

    await waitFor(() => {
      expect(screen.getByText("Become a runner")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Done"));

    await waitFor(
      () => {
        expect(screen.getByText("Done ✓")).toBeTruthy();
      },
      { timeout: 3000 },
    );
  });

  it("shows 'Skipped ✓' after tapping Skip", async () => {
    renderWithClient(<TodayScreen />);

    await waitFor(() => {
      expect(screen.getByText("Become a runner")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Skip"));

    await waitFor(
      () => {
        expect(screen.getByText("Skipped ✓")).toBeTruthy();
      },
      { timeout: 3000 },
    );
  });
});
