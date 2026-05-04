export const migration006 = {
  id: 6,
  name: "006_reminders",
  raw: false,
  up: `
    CREATE TABLE IF NOT EXISTS local_reminder_settings (
      id TEXT PRIMARY KEY,
      habit_id TEXT NOT NULL UNIQUE,
      reminder_type TEXT NOT NULL DEFAULT 'none'
        CHECK (reminder_type IN ('none', 'backup', 'daily')),
      reminder_time TEXT,
      notification_ids TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (habit_id) REFERENCES local_habits(id) ON DELETE CASCADE
    );
  `,
};
