import { addDeviceDays, toDeviceDateString } from "@/utils/dates";

import type { HabitLogRecord } from "@/features/habits/types";
import type { SingleMissResult, StreakBreakResult } from "./types";

type DayEntry = {
  date: string;
  status: "done" | "missed" | "skipped";
};

// Walk backward from todayDate to habitStartDate, newest-first.
// Mirrors progress.ts: today is included only if logged; past unlogged days are
// synthesized as missed. Keeps dates parallel to statuses so callers can index
// back to find breakRunStartDate.
function buildDaySequence(
  logs: HabitLogRecord[],
  habitStartDate: string,
  todayDate: string,
): DayEntry[] {
  const logsByDate = new Map<string, "done" | "missed" | "skipped">();
  for (const log of logs) {
    logsByDate.set(log.log_date, log.status);
  }

  const sequence: DayEntry[] = [];
  const todayDateObj = new Date(`${todayDate}T12:00:00`);

  for (let offset = 0; ; offset++) {
    const dateString = toDeviceDateString(addDeviceDays(todayDateObj, -offset));
    if (dateString < habitStartDate) break;

    const logged = logsByDate.get(dateString);

    if (dateString === todayDate) {
      // Today: include only if the user has already logged it.
      // An unlogged today means no decision yet — omit it so it doesn't
      // push a done off the head of the sequence.
      if (logged !== undefined) {
        sequence.push({ date: dateString, status: logged });
      }
    } else {
      // Past day: use the logged status or synthesize missed.
      sequence.push({ date: dateString, status: logged ?? "missed" });
    }
  }

  return sequence;
}

export function detectStreakBreak(
  logs: HabitLogRecord[],
  habitStartDate: string,
  todayDate: string,
): StreakBreakResult {
  // A habit with no Done days has nothing to break. Showing a recovery modal
  // to a user who hasn't successfully logged anything yet is hostile.
  if (!logs.some((l) => l.status === "done")) {
    return { broken: false };
  }

  const sequence = buildDaySequence(logs, habitStartDate, todayDate);

  // §8.3: remove skipped days before evaluating consecutive misses.
  const cleaned = sequence.filter((d) => d.status !== "skipped");

  // Walk newest-first, count consecutive missed entries from the head.
  const missPrefix: DayEntry[] = [];
  for (const entry of cleaned) {
    if (entry.status === "missed") {
      missPrefix.push(entry);
    } else {
      break;
    }
  }

  if (missPrefix.length < 2) {
    return { broken: false };
  }

  // breakRunStartDate = the oldest miss in the current contiguous miss-run.
  // Stable within a single break-run even as new auto-Missed days are appended,
  // which prevents the suppression preference from re-triggering each morning.
  const breakRunStartDate = missPrefix[missPrefix.length - 1].date;
  return { broken: true, breakRunStartDate };
}

export function detectSingleMiss(
  logs: HabitLogRecord[],
  habitStartDate: string,
  todayDate: string,
): SingleMissResult {
  if (!logs.some((l) => l.status === "done")) {
    return { isSingleMiss: false };
  }

  // If the streak is broken the recovery modal handles it; the banner must not
  // appear alongside the modal.
  const breakResult = detectStreakBreak(logs, habitStartDate, todayDate);
  if (breakResult.broken) {
    return { isSingleMiss: false };
  }

  const sequence = buildDaySequence(logs, habitStartDate, todayDate);
  const cleaned = sequence.filter((d) => d.status !== "skipped");

  const head = cleaned[0];
  if (!head || head.status !== "missed") {
    return { isSingleMiss: false };
  }

  // Banner is for yesterday's miss only. A same-day miss (edge case where
  // auto-Missed fires before midnight) should not trigger the banner because
  // today is still in progress.
  const yesterday = toDeviceDateString(
    addDeviceDays(new Date(`${todayDate}T12:00:00`), -1),
  );
  if (head.date !== yesterday) {
    return { isSingleMiss: false };
  }

  return { isSingleMiss: true, missDate: head.date };
}

export function recoveryModalPreferenceKey(
  habitId: string,
  breakRunStartDate: string,
): string {
  return `recovery-modal-shown-${habitId}-${breakRunStartDate}`;
}

export function singleMissBannerPreferenceKey(
  habitId: string,
  missDate: string,
): string {
  return `single-miss-banner-dismissed-${habitId}-${missDate}`;
}
