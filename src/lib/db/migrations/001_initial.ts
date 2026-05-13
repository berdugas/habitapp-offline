/**
 * Migration 001 — initial Core v1 local schema.
 *
 * Creates the three Sprint 1 tables. Future tables (SRHI, weekly reviews,
 * reminder settings) land in their own migrations when those features ship.
 */

export const migration001 = {
  id: 1,
  name: "001_initial",
  up: `
    CREATE TABLE local_habits (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      identity_phrase TEXT,
      cue TEXT NOT NULL,
      tiny_action TEXT NOT NULL,
      minimum_viable_action TEXT,
      preferred_time_window TEXT,
      habit_state TEXT NOT NULL DEFAULT 'focus'
        CHECK (habit_state IN ('focus', 'supporting', 'automatic')),
      status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'archived', 'backlog')),
      start_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      archived_at TEXT,
      automated_at TEXT,
      backlog_at TEXT
    );

    CREATE INDEX idx_habits_user_state
      ON local_habits(user_id, habit_state, status);

    CREATE INDEX idx_habits_user_status
      ON local_habits(user_id, status);

    CREATE TABLE local_habit_logs (
      id TEXT PRIMARY KEY,
      habit_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      log_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('done', 'skipped', 'missed')),
      note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, habit_id, log_date),
      FOREIGN KEY (habit_id) REFERENCES local_habits(id) ON DELETE CASCADE
    );

    CREATE INDEX idx_logs_habit_date
      ON local_habit_logs(habit_id, log_date DESC);

    CREATE TABLE local_user_preferences (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `,
};
