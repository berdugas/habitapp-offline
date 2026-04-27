const mockUseMutation = jest.fn();

jest.mock("@tanstack/react-query", () => ({
  useMutation: (options: unknown) => mockUseMutation(options),
}));

jest.mock("@/features/recommendations/aiRewriteApi", () => ({
  generateHabitRewrite: jest.fn(),
}));

import { generateHabitRewrite } from "@/features/recommendations/aiRewriteApi";
import { useGenerateHabitRewriteMutation } from "@/features/recommendations/hooks";

type MutationOptions = {
  mutationFn: (input: {
    habitId: string;
    suggestionType: "change_trigger";
  }) => Promise<unknown>;
};

describe("ai rewrite hooks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMutation.mockImplementation((options: unknown) => options);
  });

  it("blocks rewrite generation when the feature flag is disabled", async () => {
    useGenerateHabitRewriteMutation();

    const options = mockUseMutation.mock.calls[0][0] as MutationOptions;
    await expect(
      options.mutationFn({
        habitId: "habit-1",
        suggestionType: "change_trigger",
      }),
    ).rejects.toThrow("AI rewrite is disabled for the current product phase.");

    expect(generateHabitRewrite).not.toHaveBeenCalled();
  });

  it("creates a mutation function for the dormant rewrite path", () => {
    useGenerateHabitRewriteMutation();

    expect(mockUseMutation).toHaveBeenCalledWith({
      mutationFn: expect.any(Function),
    });
  });
});
