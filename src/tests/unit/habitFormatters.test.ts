import {
  formatHabitFormula,
  stripLeadingAfter,
  stripLeadingIWill,
} from "@/features/habits/formatters";

describe("habit formatters", () => {
  it("strips a capitalized leading After", () => {
    expect(stripLeadingAfter("After breakfast")).toBe("breakfast");
  });

  it("strips a lowercase leading after", () => {
    expect(stripLeadingAfter("after breakfast")).toBe("breakfast");
  });

  it("keeps the rest of the trigger intact after stripping After", () => {
    expect(stripLeadingAfter("after I brush my teeth")).toBe(
      "I brush my teeth",
    );
  });

  it("strips a leading 'I will' from the action", () => {
    expect(stripLeadingIWill("I will read one page")).toBe("read one page");
  });

  it("strips a leading 'will' from the action", () => {
    expect(stripLeadingIWill("will read one page")).toBe("read one page");
  });

  it("strips case-insensitively", () => {
    expect(stripLeadingIWill("I Will Read")).toBe("Read");
  });

  it("formats a habit formula with a plain trigger", () => {
    expect(formatHabitFormula("breakfast", "read one page")).toBe(
      "After breakfast, I will read one page.",
    );
  });

  it("formats a habit formula without duplicating After", () => {
    expect(formatHabitFormula("After breakfast", "read one page")).toBe(
      "After breakfast, I will read one page.",
    );
  });

  it("formats without duplicating 'I will' when action starts with 'I will'", () => {
    expect(formatHabitFormula("breakfast", "I will read one page")).toBe(
      "After breakfast, I will read one page.",
    );
  });

  it("formats without duplicating 'will' when action starts with 'will'", () => {
    expect(formatHabitFormula("breakfast", "will read one page")).toBe(
      "After breakfast, I will read one page.",
    );
  });

  it("uses the placeholder when the trigger is blank", () => {
    expect(formatHabitFormula("", "read one page")).toBe(
      "After I [stack trigger], I will [tiny action].",
    );
  });

  it("uses the placeholder when the tiny action is blank", () => {
    expect(formatHabitFormula("breakfast", "")).toBe(
      "After I [stack trigger], I will [tiny action].",
    );
  });
});
