import { getFrequencyLabel } from "@/features/habits/formatters";

describe("getFrequencyLabel", () => {
  it("returns 'Every day' for all 7 days", () => {
    expect(getFrequencyLabel([1, 2, 3, 4, 5, 6, 7])).toBe("Every day");
  });

  it("returns 'Once a week' for a single day", () => {
    expect(getFrequencyLabel([1])).toBe("Once a week");
    expect(getFrequencyLabel([4])).toBe("Once a week");
  });

  it("returns 'Twice a week' for two non-weekend days", () => {
    expect(getFrequencyLabel([1, 3])).toBe("Twice a week");
    expect(getFrequencyLabel([2, 5])).toBe("Twice a week");
  });

  it("returns 'Weekends' for Saturday + Sunday", () => {
    expect(getFrequencyLabel([6, 7])).toBe("Weekends");
  });

  it("returns 'Weekdays' for Mon–Fri exactly", () => {
    expect(getFrequencyLabel([1, 2, 3, 4, 5])).toBe("Weekdays");
  });

  it("returns '{n} days a week' for 3 days", () => {
    expect(getFrequencyLabel([1, 2, 3])).toBe("3 days a week");
  });

  it("returns '{n} days a week' for 6 days", () => {
    expect(getFrequencyLabel([1, 2, 3, 4, 5, 6])).toBe("6 days a week");
  });

  it("handles unsorted input", () => {
    expect(getFrequencyLabel([7, 6, 5, 4, 3, 2, 1])).toBe("Every day");
    expect(getFrequencyLabel([5, 1, 2, 3, 4])).toBe("Weekdays");
  });
});
