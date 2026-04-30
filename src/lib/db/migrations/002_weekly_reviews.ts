export const migration002 = {
  id: 2,
  name: "002_weekly_reviews",
  up: `
    CREATE TABLE local_weekly_reviews (
      id TEXT PRIMARY KEY,
      habit_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      week_start TEXT NOT NULL,
      went_well TEXT,
      was_hard TEXT,
      adjustment_note TEXT,
      trigger_worked INTEGER CHECK (trigger_worked IN (0, 1)),
      tiny_action_too_hard INTEGER CHECK (tiny_action_too_hard IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, habit_id, week_start),
      FOREIGN KEY (habit_id) REFERENCES local_habits(id) ON DELETE CASCADE
    );

    CREATE INDEX idx_weekly_reviews_user_habit_week
      ON local_weekly_reviews(user_id, habit_id, week_start DESC);
  `,
};
