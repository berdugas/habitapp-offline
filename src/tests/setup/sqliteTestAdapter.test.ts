import { createTestDb } from "@/tests/setup/createTestDb";
import { openDatabaseAsync } from "@/tests/setup/sqliteTestAdapter";
import type { SQLiteDatabase } from "expo-sqlite";

describe("sqliteTestAdapter", () => {
  let db: SQLiteDatabase;

  beforeEach(async () => {
    db = await openDatabaseAsync(":memory:");
  });

  afterEach(async () => {
    await db.closeAsync();
  });

  it("opens a database and returns an adapter with the expected methods", () => {
    expect(typeof db.execAsync).toBe("function");
    expect(typeof db.runAsync).toBe("function");
    expect(typeof db.getAllAsync).toBe("function");
    expect(typeof db.getFirstAsync).toBe("function");
    expect(typeof db.withTransactionAsync).toBe("function");
    expect(typeof db.closeAsync).toBe("function");
  });

  it("execAsync runs multi-statement SQL", async () => {
    await db.execAsync(`
      CREATE TABLE foo (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE bar (id INTEGER PRIMARY KEY);
    `);
    const rows = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    );
    const names = rows.map((r) => r.name);
    expect(names).toContain("foo");
    expect(names).toContain("bar");
  });

  it("runAsync inserts a row and returns lastInsertRowId and changes", async () => {
    await db.execAsync(
      "CREATE TABLE items (id INTEGER PRIMARY KEY AUTOINCREMENT, val TEXT NOT NULL)",
    );
    const result = await db.runAsync(
      "INSERT INTO items (val) VALUES (?)",
      "hello",
    );
    expect(result.lastInsertRowId).toBe(1);
    expect(result.changes).toBe(1);
  });

  it("getAllAsync returns all matching rows", async () => {
    await db.execAsync(
      "CREATE TABLE nums (n INTEGER NOT NULL)",
    );
    await db.runAsync("INSERT INTO nums VALUES (1)");
    await db.runAsync("INSERT INTO nums VALUES (2)");
    await db.runAsync("INSERT INTO nums VALUES (3)");

    const rows = await db.getAllAsync<{ n: number }>("SELECT n FROM nums ORDER BY n");
    expect(rows).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
  });

  it("getFirstAsync returns the first row when a match exists", async () => {
    await db.execAsync(
      "CREATE TABLE kv (key TEXT PRIMARY KEY, val TEXT NOT NULL)",
    );
    await db.runAsync("INSERT INTO kv VALUES (?, ?)", "x", "42");

    const row = await db.getFirstAsync<{ val: string }>(
      "SELECT val FROM kv WHERE key = ?",
      "x",
    );
    expect(row).toEqual({ val: "42" });
  });

  it("getFirstAsync returns null when no match exists", async () => {
    await db.execAsync(
      "CREATE TABLE kv (key TEXT PRIMARY KEY, val TEXT NOT NULL)",
    );
    const row = await db.getFirstAsync("SELECT * FROM kv WHERE key = ?", "missing");
    expect(row).toBeNull();
  });

  it("withTransactionAsync commits on success", async () => {
    await db.execAsync(
      "CREATE TABLE t (v INTEGER NOT NULL)",
    );
    await db.withTransactionAsync(async () => {
      await db.runAsync("INSERT INTO t VALUES (1)");
      await db.runAsync("INSERT INTO t VALUES (2)");
    });

    const rows = await db.getAllAsync<{ v: number }>("SELECT v FROM t ORDER BY v");
    expect(rows).toEqual([{ v: 1 }, { v: 2 }]);
  });

  it("withTransactionAsync rolls back on throw", async () => {
    await db.execAsync(
      "CREATE TABLE t (v INTEGER NOT NULL)",
    );

    await expect(
      db.withTransactionAsync(async () => {
        await db.runAsync("INSERT INTO t VALUES (99)");
        throw new Error("intentional failure");
      }),
    ).rejects.toThrow("intentional failure");

    const rows = await db.getAllAsync("SELECT * FROM t");
    expect(rows).toHaveLength(0);
  });
});

describe("createTestDb", () => {
  it("returns a DB with migration 001 applied", async () => {
    const db = await createTestDb();

    const rows = await db.getAllAsync<{ id: number; name: string }>(
      "SELECT id, name FROM schema_migrations ORDER BY id",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(1);
    expect(rows[0].name).toBe("001_initial");

    await db.closeAsync();
  });

  it("creates isolated databases — inserts in one do not appear in another", async () => {
    const db1 = await createTestDb();
    const db2 = await createTestDb();

    await db1.runAsync(
      "INSERT INTO local_user_preferences (key, value, updated_at) VALUES (?, ?, ?)",
      "theme",
      "dark",
      new Date().toISOString(),
    );

    const rows = await db2.getAllAsync("SELECT * FROM local_user_preferences");
    expect(rows).toHaveLength(0);

    await db1.closeAsync();
    await db2.closeAsync();
  });
});
