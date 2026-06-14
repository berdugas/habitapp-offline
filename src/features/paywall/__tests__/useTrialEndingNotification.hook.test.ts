import { renderHook, act, waitFor } from "@testing-library/react-native";

import { useTrialEndingNotification } from "@/features/paywall/useTrialEndingNotification";
import { logger } from "@/services/logger";
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

it("a superseded non-trial cleanup does not clobber the newer window's stored id", async () => {
  // Effect A (non-trial) reads "end1|id1" and parks inside cancel(id1). The deps
  // flip to a NEW trial window (effect B). Runs are serialized, so B waits for A;
  // when A resumes it must BAIL (superseded) without clearing storage. Then B
  // runs and stores id2. If A's clear weren't ownership-guarded it would orphan
  // id2.
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

  // Effect A is now parked inside cancel("id1"); effect B is queued behind it.
  await waitFor(() => expect(mockCancel).toHaveBeenCalledWith("id1"));
  rerender({ status: "trial", ends: END2 });

  // Let A resume (bails, no clear) → then serialized B runs and stores id2.
  mockSetStored.mockClear();
  await act(async () => {
    resolveCancel();
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });

  // A never cleared storage, and the newer window's id is what's persisted.
  expect(mockSetStored).not.toHaveBeenCalledWith(KEY, "");
  await waitFor(() => expect(mockSetStored).toHaveBeenCalledWith(KEY, `${END2}|id2`));
});

it("serializes sync runs so an older in-flight write can't precede a newer one", async () => {
  // Effect A (window1) is parked mid storage-WRITE of its id. Effect B (window2)
  // must NOT start its own schedule/write until A's write settles — otherwise
  // A's write could land after B's and leave B's notification untracked.
  mockGetStored.mockResolvedValue(null);
  let resolveWriteA!: () => void;
  mockSetStored.mockImplementationOnce(
    () => new Promise<void>((r) => (resolveWriteA = r)),
  );
  mockSchedule.mockResolvedValueOnce("idA").mockResolvedValueOnce("idB");

  const ENDB = new Date("2026-06-19T12:00:00.000Z").toISOString();
  const { rerender } = renderHook(
    ({ ends }: { ends: string | null }) => useTrialEndingNotification("trial", ends),
    { initialProps: { ends: ENDS_AT as string | null } },
  );

  // A scheduled idA and is parked writing "ENDS_AT|idA".
  await waitFor(() => expect(mockSetStored).toHaveBeenCalledWith(KEY, `${ENDS_AT}|idA`));
  expect(mockSchedule).toHaveBeenCalledTimes(1);

  // B mounts while A's write is in flight — it must be blocked behind A.
  rerender({ ends: ENDB });
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
  expect(mockSchedule).toHaveBeenCalledTimes(1); // B has NOT started yet

  // A's write settles → serialized B now runs and writes its own id last.
  await act(async () => {
    resolveWriteA();
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
  await waitFor(() => expect(mockSchedule).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(mockSetStored).toHaveBeenCalledWith(KEY, `${ENDB}|idB`));
});

it("does not leak an unhandled rejection when the storage read fails", async () => {
  // getStoredItem rejects OUTSIDE the inner try blocks; the serialized chain's
  // terminal catch must absorb it and log, not let it escape sync()'s
  // fire-and-forget call.
  mockGetStored.mockRejectedValueOnce(new Error("storage down"));

  renderHook(() => useTrialEndingNotification("trial", ENDS_AT));

  await waitFor(() =>
    expect(logger.warn).toHaveBeenCalledWith(
      "Trial-ending notification sync failed",
      expect.objectContaining({ err: expect.any(Error) }),
    ),
  );
});
