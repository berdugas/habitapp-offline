export const HABIT_FORMULA_PLACEHOLDER =
  "After I [stack trigger], I will [tiny action].";

export function stripLeadingAfter(value: string) {
  return value.trim().replace(/^after\s+/i, "").trim();
}

export function getFrequencyLabel(activeDays: number[]): string {
  const sorted = [...activeDays].sort((a, b) => a - b);
  const count = sorted.length;

  if (count === 7) return "Every day";
  if (count === 1) return "Once a week";
  if (count === 2) {
    const weekends = [6, 7];
    if (weekends.every((d) => sorted.includes(d))) return "Weekends";
    return "Twice a week";
  }
  const weekdays = [1, 2, 3, 4, 5];
  if (count === 5 && weekdays.every((d) => sorted.includes(d))) return "Weekdays";

  return `${count} days a week`;
}

export function formatHabitFormula(stackTrigger: string, tinyAction: string) {
  const cleanTrigger = stripLeadingAfter(stackTrigger);
  const cleanAction = tinyAction.trim();

  if (!cleanTrigger || !cleanAction) {
    return HABIT_FORMULA_PLACEHOLDER;
  }

  return `After ${cleanTrigger}, I will ${cleanAction}.`;
}
