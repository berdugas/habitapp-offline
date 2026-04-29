/**
 * Test-only adapter that wraps better-sqlite3 (synchronous, Node-native)
 * in the async API surface that expo-sqlite exposes.
 *
 * Jest's moduleNameMapper redirects "expo-sqlite" to this file so repository
 * code runs unmodified in Node tests. Production code still imports the real
 * expo-sqlite — this file is never bundled into the app.
 */
import Database from "better-sqlite3";
import type { SQLiteDatabase } from "expo-sqlite";

function createAdapter(db: Database.Database): SQLiteDatabase {
  return {
    async execAsync(sql: string): Promise<void> {
      db.exec(sql);
    },

    async runAsync(
      sql: string,
      ...params: unknown[]
    ): Promise<{ lastInsertRowId: number; changes: number }> {
      const stmt = db.prepare(sql);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = stmt.run(...(params as any[]));
      return {
        lastInsertRowId: Number(result.lastInsertRowid),
        changes: result.changes,
      };
    },

    async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
      const stmt = db.prepare(sql);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return stmt.all(...(params as any[])) as T[];
    },

    async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
      const stmt = db.prepare(sql);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (stmt.get(...(params as any[])) as T | undefined) ?? null;
    },

    // expo-sqlite's withTransactionAsync passes an async callback, but
    // better-sqlite3's db.transaction() requires a synchronous function.
    // We manually issue BEGIN/COMMIT/ROLLBACK so async callbacks work.
    async withTransactionAsync(asyncTask: () => Promise<void>): Promise<void> {
      db.exec("BEGIN");
      try {
        await asyncTask();
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },

    async closeAsync(): Promise<void> {
      db.close();
    },
  } as unknown as SQLiteDatabase;
}

export async function openDatabaseAsync(name: string): Promise<SQLiteDatabase> {
  // Always open in-memory so each test DB is isolated and leaves no files.
  const filename = name === ":memory:" ? ":memory:" : ":memory:";
  const db = new Database(filename);
  return createAdapter(db);
}

export async function deleteDatabaseAsync(_name: string): Promise<void> {
  // No-op: in-memory databases have no file to delete.
}
