import { renderHook, act, waitFor } from "@testing-library/react-native";

import { useTrialEndingNotification } from "@/features/paywall/useTrialEndingNotification";

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
