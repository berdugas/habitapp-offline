import { renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useActiveHabitCountQuery } from "@/features/habits/hooks";

const mockListHabits = jest.fn();
jest.mock("@/lib/db/repositories/habits", () => ({
  listHabits: (...a: unknown[]) => mockListHabits(...a),
}));

jest.mock("@/features/auth/hooks", () => ({
  useAuthSession: () => ({ user: { id: "user-1" } }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => mockListHabits.mockReset());

it("returns active count and active+backlog (manageable) count", async () => {
  mockListHabits.mockResolvedValue([
    { id: "a", status: "active", habit_state: "active" },
    { id: "b", status: "active", habit_state: "active" },
    { id: "c", status: "backlog", habit_state: "active" },
    { id: "d", status: "active", habit_state: "automatic" }, // graduated — excluded
  ]);

  const { result } = renderHook(() => useActiveHabitCountQuery(), { wrapper });
  await waitFor(() => expect(result.current.data).toBeDefined());

  expect(result.current.data).toEqual({
    activeCount: 2,
    manageable: 3,
    soleActiveHabitId: null,
  });
});

it("reports the sole active habit id when exactly one exists", async () => {
  mockListHabits.mockResolvedValue([
    { id: "a", status: "active", habit_state: "active" },
    { id: "c", status: "backlog", habit_state: "active" },
  ]);
  const { result } = renderHook(() => useActiveHabitCountQuery(), { wrapper });
  await waitFor(() => expect(result.current.data).toBeDefined());
  expect(result.current.data).toEqual({
    activeCount: 1,
    manageable: 2,
    soleActiveHabitId: "a",
  });
});
