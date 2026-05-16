function pad(value: number) {
  return value.toString().padStart(2, "0");
}

export function toDeviceDateString(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDeviceDays(date: Date, amount: number) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
}

export function getTrailingDateRangeStrings(
  windowDays: number,
  endDate = new Date(),
) {
  const safeEndDate = new Date(endDate);
  safeEndDate.setHours(0, 0, 0, 0);

  const startDate = addDeviceDays(safeEndDate, -(windowDays - 1));

  return {
    endDate: toDeviceDateString(safeEndDate),
    startDate: toDeviceDateString(startDate),
  };
}

export function getWeekStartDate(date = new Date()) {
  const localDate = new Date(date);
  localDate.setHours(0, 0, 0, 0);

  const offset = (localDate.getDay() + 6) % 7;
  localDate.setDate(localDate.getDate() - offset);

  return localDate;
}

export function getWeekStartDateString(date = new Date()) {
  return toDeviceDateString(getWeekStartDate(date));
}

const DAY_NAMES: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

export function getDayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek] ?? "";
}

export function daysBetweenDates(fromDate: string, toDate: string): number {
  const from = fromDate.length > 10 ? fromDate.slice(0, 10) : fromDate;
  const to = toDate.length > 10 ? toDate.slice(0, 10) : toDate;
  const a = new Date(`${from}T12:00:00`).getTime();
  const b = new Date(`${to}T12:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}
