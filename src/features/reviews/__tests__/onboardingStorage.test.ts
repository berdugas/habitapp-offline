const mockGetPreference = jest.fn();
const mockSetPreference = jest.fn();
const mockDeletePreference = jest.fn();
const mockLoggerWarn = jest.fn();

jest.mock("@/lib/db/repositories/preferences", () => ({
  getPreference: (...args: unknown[]) => mockGetPreference(...args),
  setPreference: (...args: unknown[]) => mockSetPreference(...args),
  deletePreference: (...args: unknown[]) => mockDeletePreference(...args),
}));

jest.mock("@/services/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    error: jest.fn(),
  },
}));

jest.mock("@/utils/clock", () => ({
  nowIso: () => "2026-05-17T12:00:00.000Z",
}));

import {
  clearWeeklyReviewIntroSeen,
  isWeeklyReviewFirstRunCompleted,
  isWeeklyReviewIntroSeen,
  markWeeklyReviewFirstRunCompleted,
  markWeeklyReviewIntroSeen,
} from "@/features/reviews/onboardingStorage";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("isWeeklyReviewIntroSeen", () => {
  it("returns false when the key is absent", async () => {
    mockGetPreference.mockResolvedValue(null);
    await expect(isWeeklyReviewIntroSeen()).resolves.toBe(false);
    expect(mockGetPreference).toHaveBeenCalledWith(
      "weekly_review.intro_seen_at",
    );
  });

  it("returns true when the key has any value", async () => {
    mockGetPreference.mockResolvedValue("2026-05-17T12:00:00.000Z");
    await expect(isWeeklyReviewIntroSeen()).resolves.toBe(true);
  });

  it("propagates a read failure (no internal swallow)", async () => {
    mockGetPreference.mockRejectedValue(new Error("db locked"));
    await expect(isWeeklyReviewIntroSeen()).rejects.toThrow("db locked");
  });
});

describe("markWeeklyReviewIntroSeen", () => {
  it("writes the ISO timestamp under the right key and resolves to true", async () => {
    mockSetPreference.mockResolvedValue(undefined);
    await expect(markWeeklyReviewIntroSeen()).resolves.toBe(true);
    expect(mockSetPreference).toHaveBeenCalledWith(
      "weekly_review.intro_seen_at",
      "2026-05-17T12:00:00.000Z",
    );
  });

  it("resolves to false when the write fails, and logs", async () => {
    mockSetPreference.mockRejectedValue(new Error("disk full"));
    await expect(markWeeklyReviewIntroSeen()).resolves.toBe(false);
    expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
  });
});

describe("clearWeeklyReviewIntroSeen", () => {
  it("deletes the intro-seen key and resolves to true", async () => {
    mockDeletePreference.mockResolvedValue(undefined);
    await expect(clearWeeklyReviewIntroSeen()).resolves.toBe(true);
    expect(mockDeletePreference).toHaveBeenCalledWith(
      "weekly_review.intro_seen_at",
    );
  });

  it("resolves to false when the delete fails, and logs", async () => {
    mockDeletePreference.mockRejectedValue(new Error("db locked"));
    await expect(clearWeeklyReviewIntroSeen()).resolves.toBe(false);
    expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
  });
});

describe("isWeeklyReviewFirstRunCompleted", () => {
  it("returns false when the key is absent", async () => {
    mockGetPreference.mockResolvedValue(null);
    await expect(isWeeklyReviewFirstRunCompleted()).resolves.toBe(false);
    expect(mockGetPreference).toHaveBeenCalledWith(
      "weekly_review.first_run_completed_at",
    );
  });

  it("returns true when the key has any value", async () => {
    mockGetPreference.mockResolvedValue("2026-05-17T12:00:00.000Z");
    await expect(isWeeklyReviewFirstRunCompleted()).resolves.toBe(true);
  });

  it("propagates a read failure (no internal swallow)", async () => {
    mockGetPreference.mockRejectedValue(new Error("db locked"));
    await expect(isWeeklyReviewFirstRunCompleted()).rejects.toThrow(
      "db locked",
    );
  });
});

describe("markWeeklyReviewFirstRunCompleted", () => {
  it("writes the ISO timestamp under the right key and resolves to true", async () => {
    mockSetPreference.mockResolvedValue(undefined);
    await expect(markWeeklyReviewFirstRunCompleted()).resolves.toBe(true);
    expect(mockSetPreference).toHaveBeenCalledWith(
      "weekly_review.first_run_completed_at",
      "2026-05-17T12:00:00.000Z",
    );
  });

  it("resolves to false when the write fails, and logs", async () => {
    mockSetPreference.mockRejectedValue(new Error("disk full"));
    await expect(markWeeklyReviewFirstRunCompleted()).resolves.toBe(false);
    expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
  });
});
