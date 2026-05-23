import {
  addBreadcrumb,
  captureException,
  captureMessage,
} from "@/services/sentry";
import { redact } from "@/services/telemetryRedact";

// Extract Error instances from meta. Top-level only — nested Errors stay
// nested and go through redact() normally (loses message/stack; no current
// call site does this, but flagged in the spec as a known limitation).
function extractErrors(meta?: Record<string, unknown>): {
  errors: Error[];
  rest: Record<string, unknown>;
} {
  if (!meta) return { errors: [], rest: {} };
  const errors: Error[] = [];
  const rest: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (value instanceof Error) {
      errors.push(value);
    } else {
      rest[key] = value;
    }
  }
  return { errors, rest };
}

type SentryLevel = "error" | "warning";

function forwardToSentry(
  level: SentryLevel,
  message: string,
  meta?: Record<string, unknown>,
): void {
  const { errors, rest } = extractErrors(meta);

  if (errors.length === 0) {
    captureMessage(message, { level, extra: redact(meta) });
    return;
  }

  const [primary, ...additional] = errors;
  const baseExtra = redact({ contextMessage: message, ...rest });
  // additionalErrors is spliced in AFTER redact() so the redactor never sees
  // dev-controlled Error fields. Same safety class as exception messages.
  const extra: Record<string, unknown> =
    additional.length > 0
      ? {
          ...baseExtra,
          additionalErrors: additional.map((e) => ({
            name: e.name,
            message: e.message,
            stack: e.stack,
          })),
        }
      : baseExtra;
  if (primary) captureException(primary, { level, extra });
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>) {
    console.info(`[habits] ${message}`, meta ?? {});
    // info is NOT forwarded to Sentry by design — would flood the 100-crumb
    // breadcrumb ring buffer with debug-trace noise.
  },
  warn(message: string, meta?: Record<string, unknown>) {
    console.warn(`[habits] ${message}`, meta ?? {});
    forwardToSentry("warning", message, meta);
  },
  error(message: string, meta?: Record<string, unknown>) {
    console.error(`[habits] ${message}`, meta ?? {});
    forwardToSentry("error", message, meta);
  },
};

// Exported for unit tests
export const __testables = { extractErrors };
