import React from "react";
import Constants from "expo-constants";
import { PostHog, PostHogProvider } from "posthog-react-native";
import type { PostHogEventProperties } from "@posthog/core";

import { redact } from "@/services/telemetryRedact";
import { setUser as sentrySetUser } from "@/services/sentry";

let posthogClient: PostHog | null = null;

function readApiKey(): string | undefined {
  const key = Constants.expoConfig?.extra?.posthogApiKey;
  return typeof key === "string" && key.length > 0 ? key : undefined;
}

function readHost(): string | undefined {
  const host = Constants.expoConfig?.extra?.posthogHost;
  return typeof host === "string" && host.length > 0 ? host : undefined;
}

function readTelemetryInDev(): boolean {
  return Constants.expoConfig?.extra?.telemetryInDev === true;
}

export function initPostHog(): void {
  if (posthogClient) return;
  const apiKey = readApiKey();
  if (!apiKey) return;
  const enabled = !__DEV__ || readTelemetryInDev();
  if (!enabled) return;

  const host = readHost();
  const options: Record<string, unknown> = {
    captureAppLifecycleEvents: false,
    enableSessionReplay: false,
  };
  if (host) options.host = host;

  posthogClient = new PostHog(apiKey, options);

  // Mirror PostHog distinct_id to Sentry once the client has finished its
  // async init (loads distinct_id from storage). Use ready() Promise — v4 API.
  // Falls back gracefully: if ready() isn't a function on the installed
  // version, fire a setTimeout so the link always happens.
  const mirrorIdentityToSentry = () => {
    try {
      const id = posthogClient?.getDistinctId();
      if (id) sentrySetUser({ id });
    } catch {
      // Identity mirroring is best-effort; never let it break startup.
    }
  };

  if (typeof posthogClient.ready === "function") {
    posthogClient
      .ready()
      .then(mirrorIdentityToSentry)
      .catch(() => {
        // ready() rejection is non-fatal; identity stays anonymous in Sentry
      });
  } else {
    setTimeout(mirrorIdentityToSentry, 500);
  }
}

export function getPostHogClient(): PostHog | null {
  return posthogClient;
}

// Wrapped capture: applies redact() before delegating to the SDK. Single seam
// for analytics.ts to call without bypassing the redactor.
export function capture(
  eventName: string,
  properties?: Record<string, unknown>,
): void {
  if (!posthogClient) return;
  posthogClient.capture(
    eventName,
    properties
      ? (redact(properties) as unknown as PostHogEventProperties)
      : undefined,
  );
}

// Manual screen tracking — call from a usePathname() effect since Expo Router
// can't be auto-captured by PostHog v4 (per the SDK's own docs).
export function screen(name: string, properties?: Record<string, unknown>): void {
  if (!posthogClient) return;
  void posthogClient.screen(
    name,
    properties
      ? (redact(properties) as unknown as PostHogEventProperties)
      : undefined,
  );
}

// Thin provider wrapper. When the client isn't initialized (DEV w/o flag, or
// API key missing), renders children bare — no provider in the tree,
// usePostHog() in descendants returns undefined and our screen() helper
// becomes a no-op.
export const TelemetryProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  if (!posthogClient) {
    return React.createElement(React.Fragment, null, children);
  }
  return React.createElement(
    PostHogProvider,
    {
      client: posthogClient,
      // Expo Router cannot use PostHog's screen autocapture (per SDK docs);
      // we call screen() manually from app/_layout.tsx via usePathname().
      autocapture: { captureScreens: false, captureTouches: false },
      children,
    },
  );
};

// Test-only: reset state between tests
export function __resetForTests(): void {
  posthogClient = null;
}
