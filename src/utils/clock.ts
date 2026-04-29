import { toDeviceDateString } from "@/utils/dates";

const isTest =
  process.env.NODE_ENV === "test" ||
  (typeof __DEV__ !== "undefined" && __DEV__);

type ClockProvider = () => Date;

let provider: ClockProvider = () => new Date();

export function now(): Date {
  return provider();
}

export function nowIso(): string {
  return now().toISOString();
}

export function todayDateString(): string {
  return toDeviceDateString(now());
}

export function setNowForTesting(value: Date | (() => Date)): void {
  if (!isTest) {
    throw new Error(
      "setNowForTesting cannot be called outside of test or dev builds.",
    );
  }
  provider = typeof value === "function" ? value : () => new Date(value);
}

export function resetClockForTesting(): void {
  if (!isTest) {
    throw new Error(
      "resetClockForTesting cannot be called outside of test or dev builds.",
    );
  }
  provider = () => new Date();
}
