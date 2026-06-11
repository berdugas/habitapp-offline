/**
 * Migration 009 — add `archived_reason` column to `local_habits`.
 *
 * Distinguishes paywall-archived habits ('paywall_keep_one') from
 * user-archived habits (NULL). The free-tier restore-on-upgrade
 * detector uses this to know which habits to auto-restore when the
 * user pays — habits the user manually archived stay archived.
 *
 * Nullable, no default. SQLite ALTER TABLE ADD COLUMN works with
 * neither default nor NOT NULL constraint, which is exactly what we
 * want — pre-existing rows get NULL implicitly.
 */
export const migration009 = {
  id: 9,
  name: "009_archived_reason",
  up: `
    ALTER TABLE local_habits ADD COLUMN archived_reason TEXT;
  `,
};
