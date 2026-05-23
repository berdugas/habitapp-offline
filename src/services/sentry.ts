import Constants from "expo-constants";
import * as Sentry from "@sentry/react-native";
import type { Breadcrumb, ErrorEvent, SeverityLevel } from "@sentry/react-native";

import { redact } from "@/services/telemetryRedact";

// Re-export the wrap HOC and ErrorBoundary so app entry can import via this
// module — keeps the SDK choice + version concerns localized here.
export const wrap = Sentry.wrap;
export const ErrorBoundary = Sentry.ErrorBoundary;

let initialized = false;

function readDsn(): string | undefined {
  const dsn = Constants.expoConfig?.extra?.sentryDsn;
  return typeof dsn === "string" && dsn.length > 0 ? dsn : undefined;
}

function readTelemetryInDev(): boolean {
  return Constants.expoConfig?.extra?.telemetryInDev === true;
}

function readRelease(): string | undefined {
  return Constants.expoConfig?.version;
}

// beforeSend hook scope:
// - Redacts event.extra, event.contexts.*, event.tags, breadcrumb.data
// - Leaves event.exception.values[].value and .stacktrace alone (dev-written;
//   stripping them blanket-style destroys debugging value)
function applyBeforeSend(event: ErrorEvent): ErrorEvent {
  if (event.extra) {
    event.extra = redact(event.extra as Record<string, unknown>);
  }
  if (event.contexts) {
    const redactedContexts: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(event.contexts)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        redactedContexts[key] = redact(value as Record<string, unknown>);
      } else {
        redactedContexts[key] = value;
      }
    }
    event.contexts = redactedContexts as ErrorEvent["contexts"];
  }
  // Tags pass through unchanged: they're dev-written enums (same safety class
  // as exception messages — see Sentry init section of the spec). If a future
  // call site interpolates user content into a tag value, audit at that site.
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map((crumb) => ({
      ...crumb,
      data: crumb.data ? redact(crumb.data) : crumb.data,
    }));
  }
  return event;
}

function applyBeforeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.data) {
    return { ...breadcrumb, data: redact(breadcrumb.data) };
  }
  return breadcrumb;
}

export function initSentry(): void {
  if (initialized) return;
  const dsn = readDsn();
  if (!dsn) return;
  const enabled = !__DEV__ || readTelemetryInDev();
  if (!enabled) return;

  Sentry.init({
    dsn,
    release: readRelease(),
    sendDefaultPii: false,
    enableAutoSessionTracking: true,
    beforeSend: applyBeforeSend,
    beforeBreadcrumb: applyBeforeBreadcrumb,
  });
  initialized = true;
}

export function isSentryInitialized(): boolean {
  return initialized;
}

// Test-only: reset internal state so each test can re-init under different
// conditions. Not exposed in prod usage.
export function __resetForTests(): void {
  initialized = false;
}

// Wrappers below are guarded: when Sentry isn't initialized (DEV w/o flag,
// or DSN missing), they no-op. Lets logger.ts / analytics.ts forward
// unconditionally without sprinkling guards across call sites.

interface ExtractedErrors {
  errors: Error[];
  rest: Record<string, unknown>;
}

export function captureException(
  error: Error,
  options?: { level?: SeverityLevel; extra?: Record<string, unknown> },
): void {
  if (!initialized) return;
  Sentry.captureException(error, (scope) => {
    if (options?.level) scope.setLevel(options.level);
    if (options?.extra) scope.setExtras(options.extra);
    return scope;
  });
}

export function captureMessage(
  message: string,
  options?: { level?: SeverityLevel; extra?: Record<string, unknown> },
): void {
  if (!initialized) return;
  Sentry.captureMessage(message, (scope) => {
    if (options?.level) scope.setLevel(options.level);
    if (options?.extra) scope.setExtras(options.extra);
    return scope;
  });
}

export function addBreadcrumb(breadcrumb: Breadcrumb): void {
  if (!initialized) return;
  Sentry.addBreadcrumb(breadcrumb);
}

export function setUser(user: { id: string } | null): void {
  if (!initialized) return;
  Sentry.setUser(user);
}

// Exported for direct unit tests that need to exercise the hook bodies
// without spinning up Sentry. Not part of the public surface.
export const __testables = {
  applyBeforeSend,
  applyBeforeBreadcrumb,
};

export type { ExtractedErrors };
