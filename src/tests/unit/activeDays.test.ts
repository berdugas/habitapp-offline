import {
  ALL_DAYS,
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
