// Allowlist-based redaction for telemetry payloads. Default deny: keys not on
// the allowlist with string values become "[redacted]". Numbers and booleans
// always pass through (no PII risk). Nested plain objects are recursed; Error
// instances are coerced to "[redacted]" so callers must pull them out before
// calling redact() (see logger.ts extractErrors).
//
// Why allowlist instead of denylist: when a new trackEvent property gets added
// later, it should be redacted by default until someone explicitly approves
// the key. Silently leaking is worse than silently dropping.

export const SAFE_KEY_ALLOWLIST: ReadonlySet<string> = new Set([
  // Identifiers (UUIDs, opaque)
  "habit_id",
  "goal_id",
  "user_id",
  "log_id",

  // String-array enums (allowlisted so per-element values pass the array branch)
  "mutated_fields",

  // Numeric metrics
  "streak",
  "count",
  "duration_ms",
  "days_back",

  // Enums and flags actually emitted by the app
  "slide",
  "step",
  "action",
  "screen",
  "screen_path",
  "route",
  "success",
  "reason",
  "status",
  "scheduling_type",
  "has_reminder",
  "is_archived",

  // Logger forwarder's first-arg message (dev-written string)
  "contextMessage",
]);

const REDACTED = "[redacted]";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return false;
  if (value instanceof Error) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function redact(
  data?: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!data) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) {
      out[key] = value;
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
      continue;
    }
    if (isPlainObject(value)) {
      out[key] = redact(value);
      continue;
    }
    if (Array.isArray(value)) {
      out[key] = value.map((item) =>
        isPlainObject(item)
          ? redact(item)
          : typeof item === "number" || typeof item === "boolean"
            ? item
            : SAFE_KEY_ALLOWLIST.has(key)
              ? item
              : REDACTED,
      );
      continue;
    }
    out[key] = SAFE_KEY_ALLOWLIST.has(key) ? value : REDACTED;
  }
  return out;
}
