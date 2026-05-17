const mockGetPreference = jest.fn();
const mockSetPreference = jest.fn();
const mockLoggerWarn = jest.fn();

jest.mock("@/lib/db/repositories/preferences", () => ({
  getPreference: (...args: unknown[]) => mockGetPreference(...args),
  setPreference: (...args: unknown[]) => mockSetPreference(...args),
  deletePreference: jest.fn(),
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
  isArchiveIntroSeen,
  markArchiveIntroSeen,
} from "@/features/habits/onboardingStorage";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("isArchiveIntroSeen", () => {
  it("returns false when the key is absent", async () => {
    mockGetPreference.mockResolvedValue(null);
    await expect(isArchiveIntroSeen()).resolves.toBe(false);
    expect(mockGetPreference).toHaveBeenCalledWith(
      "habits.archive_intro_seen_at",
    );
  });

  it("returns true when the key has any value", async () => {
    mockGetPreference.mockResolvedValue("2026-05-17T12:00:00.000Z");
    await expect(isArchiveIntroSeen()).resolves.toBe(true);
  });

  it("propagates a read failure (no internal swallow)", async () => {
    mockGetPreference.mockRejectedValue(new Error("db locked"));
    await expect(isArchiveIntroSeen()).rejects.toThrow("db locked");
  });
});

describe("markArchiveIntroSeen", () => {
  it("writes the ISO timestamp under the right key and resolves to true", async () => {
    mockSetPreference.mockResolvedValue(undefined);
    await expect(markArchiveIntroSeen()).resolves.toBe(true);
    expect(mockSetPreference).toHaveBeenCalledWith(
      "habits.archive_intro_seen_at",
      "2026-05-17T12:00:00.000Z",
    );
  });

  it("resolves to false when the write fails, and logs", async () => {
    mockSetPreference.mockRejectedValue(new Error("disk full"));
    await expect(markArchiveIntroSeen()).resolves.toBe(false);
    expect(mockLoggerWarn).toHaveBeenCalledTimes(1);
  });
});
