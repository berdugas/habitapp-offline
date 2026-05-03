/**
 * Migration 004 — dissolve Focus/Supporting habit states.
 *
 * Replaces the old 'focus' | 'supporting' | 'automatic' tri-state with
 * 'active' | 'automatic'. All existing 'focus' and 'supporting' rows become
 * 'active'. The CHECK constraint is updated by recreating the table.
 *
 * Marked raw: true because PRAGMA foreign_keys = OFF cannot be set inside
 * an active transaction (SQLite ignores it there), and we need FK enforcement
 * off to DROP the referenced local_habits table without cascading to logs.
 */
export const migration004 = {
  id: 4,
  name: "004_dissolve_focus_supporting",
  raw: true,
  up: `
    PRAGMA foreign_keys = OFF;

    CREATE TABLE local_habits_new (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      identity_phrase TEXT,
      cue TEXT NOT NULL,
      tiny_action TEXT NOT NULL,
      minimum_viable_action TEXT,
      preferred_time_window TEXT,
      habit_state TEXT NOT NULL DEFAULT 'active'
        CHECK (habit_state IN ('active', 'automatic')),
      status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'archived', 'backlog')),
      start_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived_at TEXT,
      automated_at TEXT,
      backlog_at TEXT,
      icon TEXT
    );

    INSERT INTO local_habits_new
    SELECT
      id, user_id, title, identity_phrase, cue, tiny_action,
      minimum_viable_action, preferred_time_window,
      CASE WHEN habit_state IN ('focus', 'supporting') THEN 'active' ELSE habit_state END,
      status, start_date, created_at, updated_at, archived_at, automated_at, backlog_at, icon
    FROM local_habits;

    DROP TABLE local_habits;

    ALTER TABLE local_habits_new RENAME TO local_habits;

    CREATE INDEX idx_habits_user_state
      ON local_habits(user_id, habit_state, status);

    CREATE INDEX idx_habits_user_status
      ON local_habits(user_id, status);

    PRAGMA foreign_keys = ON;
  `,
};
