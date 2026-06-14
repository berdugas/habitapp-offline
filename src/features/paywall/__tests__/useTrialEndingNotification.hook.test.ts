import { renderHook, act, waitFor } from "@testing-library/react-native";

import { useTrialEndingNotification } from "@/features/paywall/useTrialEndingNotification";
import type { TrialEntitlementStatus } from "@/features/trial/types";

const mockGetPerms = jest.fn();
const mockSchedule = jest.fn();
const mockCancel = jest.fn();
const mockGetStored = jest.fn();
const mockSetStored = jest.fn();
const mockNow = jest.fn();

jest.mock("expo-notifications", () => ({
  getPermissionsAsync: (...a: unknown[]) => mockGetPerms(...a),
  scheduleNotificationAsync: (...a: unknown[]) => mockSchedule(...a),
  cancelScheduledNotificationAsync: (...a: unknown[]) => mockCancel(...a),
  SchedulableTriggerInputTypes: { DATE: "date" },
}));
jest.mock("@/lib/storage", () => ({
  getStoredItem: (...a: unknown[]) => mockGetStored(...a),
  setStoredItem: (...a: unknown[]) => mockSetStored(...a),
}));
jest.mock("@/utils/clock", () => ({ now: () => mockNow() }));
jest.mock("@/services/logger", () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

const NOW = new Date("2026-06-14T12:00:00.000Z");
const ENDS_AT = new Date("2026-06-17T12:00:00.000Z").toISOString(); // +72h → fire +24h (future)
const KEY = "paywall_ending_notif";

beforeEach(() => {
  jest.clearAllMocks();
  mockNow.mockReturnValue(NOW);
  mockGetStored.mockResolvedValue(null);
  mockSetStored.mockResolvedValue(undefined);
  mockGetPerms.mockResolvedValue({ status: "granted" });
  mockCancel.mockResolvedValue(undefined);
});

it("schedules + stores the id when permission is granted and nothing raced", async () => {
  mockSchedule.mockResolvedValue("notif-2");
  renderHook(() => useTrialEndingNotification("trial", ENDS_AT));
  await waitFor(() =>
    expect(mockSetStored).toHaveBeenCalledWith(KEY, `${ENDS_AT}|notif-2`),
  );
  expect(mockCancel).not.toHaveBeenCalled();
});

it("cancels the previous window's notification when the trial end changes (extension / account switch)", async () => {
  // stored belongs to a DIFFERENT trial end (a trial extension, or a switch
  // between two trial accounts sharing this device-global key). The old
  // window's reminder must be cancelled before scheduling its replacement,
  // not left to fire as an orphan.
  const OLD_ENDS_AT = new Date("2026-06-20T12:00:00.000Z").toISOString();
  mockGetStored.mockResolvedValue(`${OLD_ENDS_AT}|old-id`);
  mockSchedule.mockResolvedValue("new-id");

  renderHook(() => useTrialEndingNotification("trial", ENDS_AT));

  await waitFor(() => expect(mockCancel).toHaveBeenCalledWith("old-id"));
  // ...and the replacement is scheduled + stored for the NEW window.
  await waitFor(() =>
    expect(mockSetStored).toHaveBeenCalledWith(KEY, `${ENDS_AT}|new-id`),
  );
});

it("cancels the just-scheduled notification if cleanup races scheduling (no orphan)", async () => {
  let resolveSchedule!: (id: string) => void;
  mockSchedule.mockReturnValue(new Promise((r) => (resolveSchedule = r)));

  const { unmount } = renderHook(() =>
    useTrialEndingNotification("trial", ENDS_AT),
  );
  await waitFor(() => expect(mockSchedule).toHaveBeenCalled());

  // Account/status change tears the effect down BEFORE the schedule resolves.
  unmount();
  await act(async () => {
    resolveSchedule("notif-1");
    await Promise.resolve();
    await Promise.resolve();
  });

  // The orphan we couldn't store must be cancelled, not left dangling.
  expect(mockCancel).toHaveBeenCalledWith("notif-1");
  expect(mockSetStored).not.toHaveBeenCalledWith(
    KEY,
    expect.stringContaining("notif-1"),
  );
});

it("cancels the scheduled notification if persisting its id fails (no untracked orphan)", async () => {
  // schedule succeeds, but the storage write rejects. Without cancelling, the
  // notification stays scheduled with an id nobody recorded — it can never be
  // found or cancelled again.
  mockSchedule.mockResolvedValue("id-x");
  mockSetStored.mockRejectedValueOnce(new Error("storage full"));

  renderHook(() => useTrialEndingNotification("trial", ENDS_AT));

  await waitFor(() => expect(mockCancel).toHaveBeenCalledWith("id-x"));
});

it("a superseded non-trial cleanup does not erase a newer effect's stored id", async () => {
  // Effect A (non-trial) reads "end1|id1" and parks inside cancel(id1). While
  // it's parked, the deps flip to a NEW trial window: effect B schedules id2
  // and stores "end2|id2". When A resumes it must NOT clear storage — it has
  // been superseded, and clearing would orphan id2.
  const END2 = new Date("2026-06-18T12:00:00.000Z").toISOString(); // fire is future
  mockGetStored.mockResolvedValue("end1|id1");
  let resolveCancel!: () => void;
  mockCancel.mockImplementationOnce(
    () => new Promise<void>((r) => (resolveCancel = r)),
  );
  mockSchedule.mockResolvedValue("id2");

  const { rerender } = renderHook(
    ({ status, ends }: { status: TrialEntitlementStatus | null; ends: string | null }) =>
      useTrialEndingNotification(status, ends),
    { initialProps: { status: "paid" as TrialEntitlementStatus | null, ends: null as string | null } },
  );

  // Effect A is now parked inside cancel("id1").
  await waitFor(() => expect(mockCancel).toHaveBeenCalledWith("id1"));

  // Deps flip to a new trial window → effect B schedules + stores id2.
  rerender({ status: "trial", ends: END2 });
  await waitFor(() => expect(mockSetStored).toHaveBeenCalledWith(KEY, `${END2}|id2`));

  // A resumes: it must bail without clearing the storage B just wrote.
  mockSetStored.mockClear();
  await act(async () => {
    resolveCancel();
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(mockSetStored).not.toHaveBeenCalledWith(KEY, "");
});
