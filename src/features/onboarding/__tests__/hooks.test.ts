import { act, renderHook } from "@testing-library/react-native";

import { useAuthSession } from "@/features/auth/hooks";

import { loadOnboardingDraft, saveOnboardingDraft } from "../storage";
import { EMPTY_DRAFT } from "../types";
import { useOnboardingDraft } from "../hooks";

// Prevent the transitive import chain onboarding/hooks → habits/hooks →
// reviews/api → supabase/client → @react-native-async-storage from breaking
// this isolated unit test.
jest.mock("@/features/habits/hooks", () => ({
  getEligibleHabitsQueryKey: jest.fn(),
  getUpcomingActiveHabitsQueryKey: jest.fn(),
}));
jest.mock("expo-router", () => ({ router: { replace: jest.fn() } }));
jest.mock("@tanstack/react-query", () => ({
  useMutation: jest.fn(),
  useQuery: jest.fn(),
  useQueryClient: jest.fn(),
}));
jest.mock("@/features/auth/hooks", () => ({ useAuthSession: jest.fn() }));
jest.mock("../OnboardingProvider", () => ({ useOnboarding: jest.fn() }));
jest.mock("../completion", () => ({ finalizeOnboarding: jest.fn() }));
jest.mock("@/utils/dates", () => ({ toDeviceDateString: jest.fn() }));

jest.mock("../storage");
const mockLoad = loadOnboardingDraft as jest.MockedFunction<
  typeof loadOnboardingDraft
>;
const mockSave = saveOnboardingDraft as jest.MockedFunction<
  typeof saveOnboardingDraft
>;
const mockUseAuthSession = useAuthSession as jest.MockedFunction<
  typeof useAuthSession
>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function authSession(userId: string | null): any {
  return {
    isBootstrapping: false,
    session: userId ? ({ access_token: "token" } as unknown) : null,
    user: userId ? { id: userId } : null,
  };
}

describe("useOnboardingDraft", () => {
  beforeEach(() => {
    // clearAllMocks before each test so any saveOnboardingDraft call that fired
    // during RNTL's cleanup of the previous test's component doesn't bleed in.
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockLoad.mockResolvedValue({ ...EMPTY_DRAFT });
    mockSave.mockResolvedValue(undefined);
    mockUseAuthSession.mockReturnValue(authSession("user-1"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("starts unhydrated and flips hydrated=true after load resolves", async () => {
    const { result } = renderHook(() => useOnboardingDraft());

    expect(result.current.hydrated).toBe(false);

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.hydrated).toBe(true);
    expect(result.current.draft).toEqual(EMPTY_DRAFT);
    expect(mockLoad).toHaveBeenCalledWith("user-1");
  });

  it("update synchronously patches the draft state", async () => {
    const { result } = renderHook(() => useOnboardingDraft());

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.update({ becomingPhrase: "a runner" });
    });

    expect(result.current.draft.becomingPhrase).toBe("a runner");
  });

  it("three rapid updates within the debounce window result in one write with the final value", async () => {
    const { result } = renderHook(() => useOnboardingDraft());

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.update({ becomingPhrase: "first" });
      result.current.update({ becomingPhrase: "second" });
      result.current.update({ becomingPhrase: "third" });
    });

    // No write yet — still inside debounce window.
    expect(mockSave).not.toHaveBeenCalled();

    // Advance past the 200ms debounce.
    await act(async () => {
      jest.advanceTimersByTime(200);
      await Promise.resolve();
    });

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ becomingPhrase: "third" }),
    );
  });

  it("fires the write after the debounce window elapses", async () => {
    const { result } = renderHook(() => useOnboardingDraft());

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.update({ dailyAction: "Run for 5 minutes" });
    });

    expect(mockSave).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(200);
      await Promise.resolve();
    });

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ dailyAction: "Run for 5 minutes" }),
    );
  });

  it("unmount before the debounce fires still flushes the latest write synchronously", async () => {
    const { result, unmount } = renderHook(() => useOnboardingDraft());

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.update({ becomingPhrase: "a writer" });
    });

    // Unmount before 200ms elapses.
    unmount();

    // The flush should have fired exactly once with the latest state under the current user.
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ becomingPhrase: "a writer" }),
    );
  });

  it("reloads under the new user, resets the draft, and never writes the previous draft to the new key when user.id changes", async () => {
    // Initial render under user-1; load resolves with a populated draft.
    mockLoad.mockResolvedValueOnce({
      ...EMPTY_DRAFT,
      becomingPhrase: "user-1 draft",
    });

    const { result, rerender } = renderHook(() => useOnboardingDraft());

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockLoad).toHaveBeenCalledTimes(1);
    expect(mockLoad).toHaveBeenLastCalledWith("user-1");
    expect(result.current.draft.becomingPhrase).toBe("user-1 draft");
    expect(result.current.hydrated).toBe(true);

    // Now swap the session to user-2 BEFORE any debounced write fires.
    mockUseAuthSession.mockReturnValue(authSession("user-2"));
    mockLoad.mockResolvedValueOnce({ ...EMPTY_DRAFT });

    rerender(undefined);

    // hydrated should reset immediately on session swap.
    expect(result.current.hydrated).toBe(false);
    expect(result.current.draft).toEqual(EMPTY_DRAFT);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockLoad).toHaveBeenCalledTimes(2);
    expect(mockLoad).toHaveBeenLastCalledWith("user-2");
    expect(result.current.hydrated).toBe(true);

    // Crucially, the previous user's draft was never persisted to either key.
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("does not load or save when there is no user session", async () => {
    mockUseAuthSession.mockReturnValue(authSession(null));

    const { result } = renderHook(() => useOnboardingDraft());

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockLoad).not.toHaveBeenCalled();
    expect(result.current.hydrated).toBe(false);

    // update() should be a no-op for writes; in-memory state still patches.
    act(() => {
      result.current.update({ becomingPhrase: "would be stale" });
    });
    expect(result.current.draft.becomingPhrase).toBe("would be stale");

    await act(async () => {
      jest.advanceTimersByTime(200);
      await Promise.resolve();
    });

    expect(mockSave).not.toHaveBeenCalled();
  });

  it("cancels the pending debounced write when user.id changes mid-debounce — no flush against either user", async () => {
    const { result, rerender } = renderHook(() => useOnboardingDraft());

    await act(async () => {
      await Promise.resolve();
    });

    // Enqueue a debounced write under user-1.
    act(() => {
      result.current.update({ becomingPhrase: "stale" });
    });

    // Swap session BEFORE the 200ms timer fires.
    mockUseAuthSession.mockReturnValue(authSession("user-2"));
    mockLoad.mockResolvedValueOnce({ ...EMPTY_DRAFT });
    rerender(undefined);

    // Now elapse the original debounce window. The cancelled timer must not
    // run, and no write should land against either user-1 or user-2.
    await act(async () => {
      jest.advanceTimersByTime(200);
      await Promise.resolve();
    });

    expect(mockSave).not.toHaveBeenCalled();

    // Confirm the reload landed under user-2 exactly once and the in-memory
    // draft was reset before reloading.
    expect(mockLoad).toHaveBeenCalledTimes(2);
    expect(mockLoad).toHaveBeenLastCalledWith("user-2");
    expect(result.current.draft).toEqual(EMPTY_DRAFT);
  });
});
