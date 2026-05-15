import {
  daysBetweenDates,
  getTrailingDateRangeStrings,
  getWeekStartDateString,
  toDeviceDateString,
} from "@/utils/dates";

describe("date helpers", () => {
  it("uses device-local date formatting", () => {
    expect(toDeviceDateString(new Date("2026-04-21T10:30:00"))).toBe(
      "2026-04-21",
    );
  });

  it("returns the same date when Monday is the week start", () => {
    expect(getWeekStartDateString(new Date("2026-04-20T10:30:00"))).toBe(
      "2026-04-20",
    );
  });

  it("uses Monday as the week start from Tuesday through Sunday", () => {
    const expectedWeekStart = "2026-04-20";

    for (const day of [
      "2026-04-21",
      "2026-04-22",
      "2026-04-23",
      "2026-04-24",
      "2026-04-25",
      "2026-04-26",
    ]) {
      expect(getWeekStartDateString(new Date(`${day}T10:30:00`))).toBe(
        expectedWeekStart,
      );
    }
  });

  it("handles month boundaries when calculating week start", () => {
    expect(getWeekStartDateString(new Date("2026-05-01T10:30:00"))).toBe(
      "2026-04-27",
    );
  });

  it("handles year boundaries when calculating week start", () => {
    expect(getWeekStartDateString(new Date("2027-01-01T10:30:00"))).toBe(
      "2026-12-28",
    );
  });

  it("returns week start as YYYY-MM-DD", () => {
    expect(getWeekStartDateString(new Date("2026-04-22T10:30:00"))).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });

  it("builds the last 30-day local date window inclusive of today", () => {
    expect(
      getTrailingDateRangeStrings(30, new Date("2026-04-23T10:30:00")),
    ).toEqual({
      endDate: "2026-04-23",
      startDate: "2026-03-25",
    });
  });
});

describe("daysBetweenDates", () => {
  it("returns 0 when both dates are the same calendar day", () => {
    expect(daysBetweenDates("2026-05-14", "2026-05-14")).toBe(0);
  });

  it("returns 1 for consecutive days", () => {
    expect(daysBetweenDates("2026-05-13", "2026-05-14")).toBe(1);
  });

  it("returns 14 for the cooldown boundary case", () => {
    expect(daysBetweenDates("2026-05-01", "2026-05-15")).toBe(14);
  });

  it("accepts a full ISO timestamp on either side via truncation", () => {
    expect(
      daysBetweenDates("2026-05-01T08:15:32.521Z", "2026-05-15"),
    ).toBe(14);
    expect(
      daysBetweenDates("2026-05-01", "2026-05-15T23:59:59.999Z"),
    ).toBe(14);
  });

  it("returns 0 when a 23:00 timestamp shares the calendar day with a date-only input (R4 regression)", () => {
    expect(
      daysBetweenDates("2026-05-14T23:00:00.000Z", "2026-05-14"),
    ).toBe(0);
  });

  it("returns a negative number when from is later than to", () => {
    expect(daysBetweenDates("2026-05-14", "2026-05-07")).toBe(-7);
  });
});
