import { addBreadcrumb } from "@/services/sentry";
import { capture as posthogCapture } from "@/services/posthog";
import { redact } from "@/services/telemetryRedact";

export function trackEvent(
  eventName: string,
  properties?: Record<string, unknown>,
) {
  if (__DEV__) {
    console.info(`[analytics] ${eventName}`, properties ?? {});
  }
  const redacted = properties ? redact(properties) : undefined;
  // Crash forensics: rides along with any subsequent crash report
  addBreadcrumb({
    category: "analytics",
    message: eventName,
    level: "info",
    data: redacted,
  });
  // Real analytics event for aggregate queries (funnels, retention, etc.)
  posthogCapture(eventName, properties);
}
