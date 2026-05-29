jest.mock("react-native", () => {
  const listeners = new Set();
  const AppState = {
    currentState: "active",
    addEventListener: (event, listener) => {
      if (event === "change") listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    },
    __listeners: listeners,
  };
  return { AppState };
});

import { AppState as _MockAppState } from "react-native";
const mockAppState = _MockAppState as unknown as {
  currentState: string;
  __listeners: Set<(state: string) => void>;
};
const appStateListeners = mockAppState.__listeners;

import { renderHook, act } from "@testing-library/react-native";
import { setNowForTesting, resetClockForTesting } from "@/utils/clock";
import {
  useTodayDateString,
  useTodayAnchorDate,
  resetDayBoundaryForTesting,
  triggerDayBoundaryCheckForTesting,
} from "@/utils/dayBoundary";

afterEach(() => {
  resetDayBoundaryForTesting();
  resetClockForTesting();
  appStateListeners.clear();
});

describe("useTodayDateString", () => {
  it("returns the current local date string on first render", () => {
    setNowForTesting(new Date(2026, 4, 29, 10, 0, 0));
    const { result } = renderHook(() => useTodayDateString());
    expect(result.current).toBe("2026-05-29");
  });

  it("re-renders the consumer when the date changes", () => {
    setNowForTesting(new Date(2026, 4, 29, 23, 59, 0));
    const renderCounter = jest.fn();
    const { result } = renderHook(() => {
      renderCounter();
      return useTodayDateString();
    });
    expect(result.current).toBe("2026-05-29");
    expect(renderCounter).toHaveBeenCalledTimes(1);

    act(() => {
      setNowForTesting(new Date(2026, 4, 30, 0, 0, 5));
      triggerDayBoundaryCheckForTesting();
    });

    expect(result.current).toBe("2026-05-30");
    expect(renderCounter).toHaveBeenCalledTimes(2);
  });

  it("does NOT re-render when trigger fires with unchanged date", () => {
    setNowForTesting(new Date(2026, 4, 29, 10, 0, 0));
    const renderCounter = jest.fn();
    renderHook(() => {
      renderCounter();
      return useTodayDateString();
    });
    expect(renderCounter).toHaveBeenCalledTimes(1);

    act(() => {
      triggerDayBoundaryCheckForTesting();
      triggerDayBoundaryCheckForTesting();
    });

    expect(renderCounter).toHaveBeenCalledTimes(1);
  });
});

describe("useTodayAnchorDate", () => {
  it("returns a Date pinned to today 12:00:00 local", () => {
    setNowForTesting(new Date(2026, 4, 29, 23, 30, 0));
    const { result } = renderHook(() => useTodayAnchorDate());
    expect(result.current.getHours()).toBe(12);
    expect(result.current.getDate()).toBe(29);
  });

  it("returns referentially-equal value across re-renders within the same day", () => {
    setNowForTesting(new Date(2026, 4, 29, 10, 0, 0));
    const { result, rerender } = renderHook(() => useTodayAnchorDate());
    const first = result.current;
    rerender({});
    expect(result.current).toBe(first);
  });
});
