import {
  ALL_DAYS,
  countActiveDaysElapsed,
  getActiveDaysLabel,
  isActiveDay,
  parseActiveDays,
  serializeActiveDays,
} from "@/features/habits/activeDays";

describe("active days helpers", () => {
  it("falls back to all days for malformed, empty, and out-of-range values", () => {
    expect(parseActiveDays("garbage")).toEqual(ALL_DAYS);
    expect(parseActiveDays("[]")).toEqual(ALL_DAYS);
    expect(parseActiveDays("[0,1,8]")).toEqual(ALL_DAYS);
    expect(parseActiveDays("[1,\"2\",3]")).toEqual(ALL_DAYS);
  });

  it("serializes active days in stable sorted order", () => {
    expect(serializeActiveDays([5, 1, 3])).toBe("[1,3,5]");
  });

  it("checks ISO weekdays and labels common patterns", () => {
    expect(isActiveDay("2026-05-04", [1, 2, 3, 4, 5])).toBe(true);
    expect(isActiveDay("2026-05-03", [1, 2, 3, 4, 5])).toBe(false);
    expect(getActiveDaysLabel([1, 2, 3, 4, 5])).toBe("Weekdays");
    expect(getActiveDaysLabel([6, 7])).toBe("Weekends");
    expect(getActiveDaysLabel([1, 2, 3, 4, 5, 6, 7])).toBe("Every day");
    expect(getActiveDaysLabel([1, 3, 5])).toBe("3 days a week");
  });
});

describe("countActiveDaysElapsed", () => {
  // 2026-05-04 = Monday (ISO weekday 1); 2026-05-10 = Sunday (ISO 7)

  it("counts 7 when every day is active across one week", () => {
    expect(countActiveDaysElapsed("2026-05-04", ALL_DAYS, "2026-05-10")).toBe(7);
  });

  it("counts 5 weekdays in a Mon–Sun calendar week", () => {
    expect(
      countActiveDaysElapsed("2026-05-04", [1, 2, 3, 4, 5], "2026-05-10"),
    ).toBe(5);
  });

  it("counts 10 weekdays in a 14-day window starting Monday", () => {
    expect(
      countActiveDaysElapsed("2026-05-04", [1, 2, 3, 4, 5], "2026-05-17"),
    ).toBe(10);
  });

  it("counts 1 when only Sunday is active across one week", () => {
    expect(countActiveDaysElapsed("2026-05-04", [7], "2026-05-10")).toBe(1);
  });

  it("returns 1 when start equals end and the day is active", () => {
    expect(countActiveDaysElapsed("2026-05-04", [1], "2026-05-04")).toBe(1);
  });

  it("returns 0 when start equals end and the day is off-schedule", () => {
    expect(countActiveDaysElapsed("2026-05-04", [2], "2026-05-04")).toBe(0);
  });

  it("counts 60 weekday occurrences across 84 calendar days (12 weeks)", () => {
    expect(
      countActiveDaysElapsed("2026-05-04", [1, 2, 3, 4, 5], "2026-07-26"),
    ).toBe(60);
  });

  it("counts 180 for a 180-day window with every day active", () => {
    expect(countActiveDaysElapsed("2026-01-01", ALL_DAYS, "2026-06-29")).toBe(
      180,
    );
  });
});
