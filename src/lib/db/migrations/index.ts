import { migration001 } from "@/lib/db/migrations/001_initial";
import { migration002 } from "@/lib/db/migrations/002_weekly_reviews";
import { migration003 } from "@/lib/db/migrations/003_add_icon";

export type Migration = {
  /** Monotonically increasing identifier. Determines execution order. */
  id: number;
  /** Human-readable name; mirrors the source filename. */
  name: string;
  /** SQL applied when migrating up. May contain multiple statements. */
  up: string;
};

/**
 * Forward-only ordered list of migrations.
 *
 * To add a new migration:
 *   1. Create `00N_name.ts` in this directory exporting a Migration object.
 *   2. Append it to the array below.
 *   3. Never edit, reorder, or delete an applied migration — write a new one.
 */
export const migrations: Migration[] = [migration001, migration002, migration003];
