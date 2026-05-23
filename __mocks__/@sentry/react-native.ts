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

export function wrap<T>(component: T): T {
  return component;
}

export const ErrorBoundary: React.FC<{
  children: React.ReactNode;
  fallback?: React.ReactNode | ((props: { error: unknown }) => React.ReactNode);
}> = ({ children }) => React.createElement(React.Fragment, null, children);

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
