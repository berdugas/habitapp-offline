import { act, renderHook } from "@testing-library/react-native";

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

describe("useOnboardingDraft", () => {
  beforeEach(() => {
    // clearAllMocks before each test so any saveOnboardingDraft call that fired
    // during RNTL's cleanup of the previous test's component doesn't bleed in.
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockLoad.mockResolvedValue({ ...EMPTY_DRAFT });
    mockSave.mockResolvedValue(undefined);
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

    // The flush should have fired exactly once with the latest state.
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({ becomingPhrase: "a writer" }),
    );
  });
});
