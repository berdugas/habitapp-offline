/**
 * Migration 008 — drop `went_well` and `was_hard` from local_weekly_reviews,
 * preserving any non-empty user-written content in a separate archive table.
 *
 * The Weekly Review redesign captures Yes/No diagnostics + an optional
 * adjustment_note free-text. The two legacy text columns were repurposed
 * away from in the goal-review flow (GoalReviewScreen wrote empty strings
 * to both) and the only remaining consumer was the dead `plan_for_obstacle`
 * suggestion branch + the LLM rewrite Edge Function. Both are being removed.
 *
 * **Preservation path:** before dropping the columns, copy any row with a
 * non-empty `went_well` or `was_hard` into `local_weekly_review_text_archive`.
 * The archive table is keyed by the original review row id and includes
 * habit_id / user_id / week_start so a future "your past reflections"
 * surface can resurface the text. Rows where both fields are null or empty
 * are skipped — they were the default for the new goal-review flow and
 * contain no signal.
 *
 * Marked raw: true because SQLite needs PRAGMA foreign_keys = OFF to be set
 * outside an active transaction. The FK on local_weekly_reviews(habit_id)
 * → local_habits(id) is preserved on the recreated table.
 */
export const migration008 = {
  id: 8,
  name: "008_drop_weekly_review_text_fields",
  raw: true,
  up: `
    PRAGMA foreign_keys = OFF;

    -- Archive non-empty user-written text BEFORE dropping the columns.
    -- The archive's FK matches the review row's habit_id so cascade
    -- delete on habit removal stays consistent.
    CREATE TABLE local_weekly_review_text_archive (
      review_id TEXT PRIMARY KEY,
      habit_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      week_start TEXT NOT NULL,
      went_well TEXT,
      was_hard TEXT,
      archived_at TEXT NOT NULL,
      FOREIGN KEY (habit_id) REFERENCES local_habits(id) ON DELETE CASCADE
    );

    INSERT INTO local_weekly_review_text_archive
      (review_id, habit_id, user_id, week_start, went_well, was_hard, archived_at)
    SELECT
      id, habit_id, user_id, week_start,
      went_well, was_hard,
      strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    FROM local_weekly_reviews
    WHERE (went_well IS NOT NULL AND length(trim(went_well)) > 0)
       OR (was_hard IS NOT NULL AND length(trim(was_hard)) > 0);

    CREATE INDEX idx_wr_text_archive_user_habit_week
      ON local_weekly_review_text_archive(user_id, habit_id, week_start DESC);

    -- Recreate local_weekly_reviews without the text columns.
    CREATE TABLE local_weekly_reviews_new (
      id TEXT PRIMARY KEY,
      habit_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      week_start TEXT NOT NULL,
      adjustment_note TEXT,
      trigger_worked INTEGER CHECK (trigger_worked IN (0, 1)),
      tiny_action_too_hard INTEGER CHECK (tiny_action_too_hard IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, habit_id, week_start),
      FOREIGN KEY (habit_id) REFERENCES local_habits(id) ON DELETE CASCADE
    );

    INSERT INTO local_weekly_reviews_new
    SELECT
      id, habit_id, user_id, week_start,
      adjustment_note, trigger_worked, tiny_action_too_hard,
      created_at, updated_at
    FROM local_weekly_reviews;

    DROP TABLE local_weekly_reviews;

    ALTER TABLE local_weekly_reviews_new RENAME TO local_weekly_reviews;

    CREATE INDEX idx_weekly_reviews_user_habit_week
      ON local_weekly_reviews(user_id, habit_id, week_start DESC);

    PRAGMA foreign_keys = ON;
  `,
};
