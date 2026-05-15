import { migration001 } from "@/lib/db/migrations/001_initial";
import { migration002 } from "@/lib/db/migrations/002_weekly_reviews";
import { migration003 } from "@/lib/db/migrations/003_add_icon";
import { migration004 } from "@/lib/db/migrations/004_dissolve_focus_supporting";
import { migration005 } from "@/lib/db/migrations/005_active_days";
import { migration006 } from "@/lib/db/migrations/006_reminders";
import { migration007 } from "@/lib/db/migrations/007_srhi_responses";

export type Migration = {
  /** Monotonically increasing identifier. Determines execution order. */
  id: number;
  /** Human-readable name; mirrors the source filename. */
  name: string;
  /** SQL applied when migrating up. May contain multiple statements. */
  up: string;
  /**
   * When true, migration runs outside withTransactionAsync so that
   * PRAGMA foreign_keys = OFF can take effect (SQLite ignores that PRAGMA
   * inside an active transaction). Use only for DDL that recreates tables.
   */
  raw?: boolean;
};

/**
 * Forward-only ordered list of migrations.
 *
 * To add a new migration:
 *   1. Create `00N_name.ts` in this directory exporting a Migration object.
 *   2. Append it to the array below.
 *   3. Never edit, reorder, or delete an applied migration — write a new one.
 */
export const migrations: Migration[] = [migration001, migration002, migration003, migration004, migration005, migration006, migration007];
