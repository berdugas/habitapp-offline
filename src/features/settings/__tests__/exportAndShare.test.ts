import type { SQLiteDatabase } from "expo-sqlite";

import { getDb } from "@/lib/db/client";
import { createTestDb } from "@/tests/setup/createTestDb";

const mockWriteAsStringAsync = jest.fn();

jest.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "/tmp/",
  EncodingType: { UTF8: "utf8" },
  writeAsStringAsync: (...args: unknown[]) => mockWriteAsStringAsync(...args),
}));

const mockIsAvailableAsync = jest.fn();
const mockShareAsync = jest.fn();

jest.mock("expo-sharing", () => ({
  isAvailableAsync: (...args: unknown[]) => mockIsAvailableAsync(...args),
  shareAsync: (...args: unknown[]) => mockShareAsync(...args),
}));

jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: { version: "9.9.9" },
  },
}));

jest.mock("@/lib/db/client");
const mockGetDb = getDb as jest.Mock;

import { ExportError, exportAndShare } from "@/features/settings/exportData";

const USER = "user-1";

async function seedMinimal(db: SQLiteDatabase) {
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO local_habits
       (id, user_id, title, cue, tiny_action, habit_state, status, start_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    "habit-1",
    USER,
    "Run",
    "After coffee",
    "Run 1 minute",
    "active",
    "active",
    "2026-04-01",
    now,
    now,
  );
  await db.runAsync(
    `INSERT INTO local_habit_logs (id, habit_id, user_id, log_date, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    "log-1",
    "habit-1",
    USER,
    "2026-04-15",
    "done",
    now,
    now,
  );
}

describe("exportAndShare", () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    jest.clearAllMocks();
    db = await createTestDb();
    mockGetDb.mockReturnValue(db);
    await seedMinimal(db);
    mockIsAvailableAsync.mockResolvedValue(true);
    mockShareAsync.mockResolvedValue(undefined);
    mockWriteAsStringAsync.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  it("writes a file under cacheDirectory with a habits-export-YYYY-MM-DD.json filename and opens the share sheet", async () => {
    await exportAndShare(USER);

    expect(mockWriteAsStringAsync).toHaveBeenCalledTimes(1);
    const [filePath, , options] = mockWriteAsStringAsync.mock.calls[0];
    expect(filePath).toMatch(
      /^\/tmp\/habits-export-\d{4}-\d{2}-\d{2}\.json$/,
    );
    expect(options).toEqual({ encoding: "utf8" });

    expect(mockShareAsync).toHaveBeenCalledTimes(1);
    const [sharedUri, shareOptions] = mockShareAsync.mock.calls[0];
    expect(sharedUri).toBe(filePath);
    expect(shareOptions).toEqual({
      mimeType: "application/json",
      dialogTitle: "Export your habit data",
      UTI: "public.json",
    });
  });

  it("uses today's device-local date in the filename (not UTC)", async () => {
    const { toDeviceDateString } = jest.requireActual("@/utils/dates");
    await exportAndShare(USER);

    const today = toDeviceDateString();
    const [filePath] = mockWriteAsStringAsync.mock.calls[0];
    expect(filePath).toBe(`/tmp/habits-export-${today}.json`);
  });

  it("writes pretty-printed JSON that round-trips with exportVersion: 1", async () => {
    await exportAndShare(USER);

    const [, json] = mockWriteAsStringAsync.mock.calls[0];
    expect(typeof json).toBe("string");
    // Pretty-printed JSON contains newlines and two-space indentation
    expect(json).toContain("\n  ");

    const parsed = JSON.parse(json);
    expect(parsed.exportVersion).toBe(1);
    expect(parsed.userId).toBe(USER);
    expect(parsed.appVersion).toBe("9.9.9");
    expect(Array.isArray(parsed.habits)).toBe(true);
    expect(parsed.habits).toHaveLength(1);
  });

  it("preflights sharing availability before touching the filesystem and throws ExportError(sharing_unavailable)", async () => {
    mockIsAvailableAsync.mockResolvedValue(false);

    await expect(exportAndShare(USER)).rejects.toMatchObject({
      name: "ExportError",
      code: "sharing_unavailable",
    });
    expect(mockShareAsync).not.toHaveBeenCalled();
    // The preflight must happen BEFORE file creation so the cache isn't polluted
    // on unsupported platforms.
    expect(mockWriteAsStringAsync).not.toHaveBeenCalled();
  });

  it("propagates a file-write error and does not call shareAsync", async () => {
    mockWriteAsStringAsync.mockRejectedValueOnce(new Error("disk full"));

    await expect(exportAndShare(USER)).rejects.toThrow("disk full");
    expect(mockShareAsync).not.toHaveBeenCalled();
  });

  it("ExportError(sharing_unavailable) instance carries the correct code and name", async () => {
    mockIsAvailableAsync.mockResolvedValue(false);

    try {
      await exportAndShare(USER);
      throw new Error("expected exportAndShare to reject");
    } catch (err) {
      expect(err).toBeInstanceOf(ExportError);
      expect((err as ExportError).code).toBe("sharing_unavailable");
      expect((err as ExportError).name).toBe("ExportError");
    }
  });
});
