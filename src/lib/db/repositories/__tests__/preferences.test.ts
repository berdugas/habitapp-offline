import type { SQLiteDatabase } from "expo-sqlite";

import { getDb } from "@/lib/db/client";
import { createTestDb } from "@/tests/setup/createTestDb";
import {
  deletePreference,
  getPreference,
  listPreferences,
  setPreference,
} from "@/lib/db/repositories/preferences";

jest.mock("@/lib/db/client");
const mockGetDb = getDb as jest.Mock;

describe("preferences repository", () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    db = await createTestDb();
    mockGetDb.mockReturnValue(db);
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  it("getPreference returns null for a missing key", async () => {
    expect(await getPreference("nonexistent")).toBeNull();
  });

  it("setPreference then getPreference round-trips the value", async () => {
    await setPreference("theme", "dark");
    expect(await getPreference("theme")).toBe("dark");
  });

  it("setPreference on an existing key updates the value and bumps updated_at", async () => {
    await setPreference("theme", "dark");
    const before = await db.getFirstAsync<{ updated_at: string }>(
      "SELECT updated_at FROM local_user_preferences WHERE key = ?",
      "theme",
    );

    await new Promise((r) => setTimeout(r, 5));
    await setPreference("theme", "light");

    expect(await getPreference("theme")).toBe("light");
    const after = await db.getFirstAsync<{ updated_at: string }>(
      "SELECT updated_at FROM local_user_preferences WHERE key = ?",
      "theme",
    );
    expect(after!.updated_at > before!.updated_at).toBe(true);
  });

  it("deletePreference removes the row; subsequent getPreference returns null", async () => {
    await setPreference("key1", "val1");
    await deletePreference("key1");
    expect(await getPreference("key1")).toBeNull();
  });

  it("listPreferences returns all rows", async () => {
    await setPreference("a", "1");
    await setPreference("b", "2");
    await setPreference("c", "3");

    const prefs = await listPreferences();
    expect(prefs).toHaveLength(3);
    expect(prefs.map((p) => p.key).sort()).toEqual(["a", "b", "c"]);
  });
});
