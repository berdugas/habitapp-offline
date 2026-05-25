import React from "react";

export const init = jest.fn();
export const captureException = jest.fn();
export const captureMessage = jest.fn();
export const addBreadcrumb = jest.fn();
export const setUser = jest.fn();
export const setContext = jest.fn();
export const setTag = jest.fn();
export const setExtra = jest.fn();
export const flush = jest.fn(() => Promise.resolve(true));
export const close = jest.fn(() => Promise.resolve(true));
export const nativeCrash = jest.fn();
export const withScope = jest.fn((cb: (scope: unknown) => void) => cb({}));

// wrap and ErrorBoundary are wrapped in jest.fn so tests can assert whether
// they were invoked (e.g. the Expo Go gate test verifies the real Sentry
// module's `wrap`/`ErrorBoundary` are never touched). Behavior is unchanged
// from a plain identity function / Fragment-passthrough.
export const wrap = jest.fn(<T>(component: T): T => component);

export const ErrorBoundary = jest.fn(
  ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
) as unknown as React.FC<{
  children: React.ReactNode;
  fallback?: React.ReactNode | ((props: { error: unknown }) => React.ReactNode);
}>;

export const withErrorBoundary = <P extends object>(
  component: React.ComponentType<P>,
): React.ComponentType<P> => component;

export const reactNavigationIntegration = jest.fn(() => ({
  name: "ReactNavigation",
  setupOnce: jest.fn(),
}));

export const reactNativeTracingIntegration = jest.fn(() => ({
  name: "ReactNativeTracing",
  setupOnce: jest.fn(),
}));
