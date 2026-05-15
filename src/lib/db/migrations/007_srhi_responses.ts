export const migration007 = {
  id: 7,
  name: "007_srhi_responses",
  raw: false,
  up: `
    CREATE TABLE local_srhi_responses (
      id TEXT PRIMARY KEY,
      habit_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      q1_score INTEGER NOT NULL CHECK (q1_score BETWEEN 1 AND 5),
      q2_score INTEGER NOT NULL CHECK (q2_score BETWEEN 1 AND 5),
      q3_score INTEGER NOT NULL CHECK (q3_score BETWEEN 1 AND 5),
      average_score REAL NOT NULL,
      graduated INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (habit_id) REFERENCES local_habits(id) ON DELETE CASCADE
    );

    CREATE INDEX idx_srhi_habit
      ON local_srhi_responses(habit_id, created_at DESC);
  `,
};
