import React from "react";

export class PostHog {
  apiKey: string;
  options: Record<string, unknown>;

  constructor(apiKey: string, options: Record<string, unknown> = {}) {
    this.apiKey = apiKey;
    this.options = options;
  }

  ready = jest.fn(() => Promise.resolve());
  capture = jest.fn();
  screen = jest.fn();
  identify = jest.fn();
  alias = jest.fn();
  group = jest.fn();
  reset = jest.fn();
  optIn = jest.fn(() => Promise.resolve());
  optOut = jest.fn(() => Promise.resolve());
  flush = jest.fn(() => Promise.resolve());
  captureException = jest.fn();
  getDistinctId = jest.fn(() => "test-distinct-id");
  getDeviceId = jest.fn(() => "test-device-id");
  getSessionId = jest.fn(() => "test-session-id");
  register = jest.fn(() => Promise.resolve());
  unregister = jest.fn(() => Promise.resolve());
  isFeatureEnabled = jest.fn(() => undefined);
  getFeatureFlag = jest.fn(() => undefined);
}

export const PostHogProvider: React.FC<{
  children: React.ReactNode;
  client?: PostHog;
  apiKey?: string;
  options?: Record<string, unknown>;
  autocapture?: boolean | Record<string, unknown>;
}> = ({ children }) => React.createElement(React.Fragment, null, children);

export const PostHogErrorBoundary: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => React.createElement(React.Fragment, null, children);

export const usePostHog = jest.fn(() => new PostHog("test-key"));

export default PostHog;
