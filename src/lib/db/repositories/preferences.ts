import { getDb } from "@/lib/db/client";

export type Preference = {
  key: string;
  value: string;
  updated_at: string;
};

export async function getPreference(key: string): Promise<string | null> {
  const db = getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM local_user_preferences WHERE key = ?",
    key,
  );
  return row?.value ?? null;
}

export async function setPreference(key: string, value: string): Promise<void> {
  const db = getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO local_user_preferences (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`,
    key,
    value,
    now,
  );
}

export async function deletePreference(key: string): Promise<void> {
  const db = getDb();
  await db.runAsync(
    "DELETE FROM local_user_preferences WHERE key = ?",
    key,
  );
}

export async function listPreferences(): Promise<Preference[]> {
  const db = getDb();
  return db.getAllAsync<Preference>(
    "SELECT key, value, updated_at FROM local_user_preferences",
  );
}
