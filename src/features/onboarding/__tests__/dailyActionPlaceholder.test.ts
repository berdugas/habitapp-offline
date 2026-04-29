import { getDailyActionPlaceholder } from "../dailyActionPlaceholder";

describe("getDailyActionPlaceholder", () => {
  it('matches "run" keywords → Run for 10 minutes', () => {
    expect(getDailyActionPlaceholder("a runner")).toBe("Run for 10 minutes");
    expect(getDailyActionPlaceholder("someone who runs daily")).toBe(
      "Run for 10 minutes",
    );
    expect(getDailyActionPlaceholder("I am running")).toBe(
      "Run for 10 minutes",
    );
  });

  it('matches "read" keywords → Read one page', () => {
    expect(getDailyActionPlaceholder("someone who reads daily")).toBe(
      "Read one page",
    );
    expect(getDailyActionPlaceholder("a reader")).toBe("Read one page");
    expect(getDailyActionPlaceholder("I love reading")).toBe("Read one page");
  });

  it('matches "writ" keywords → Write one sentence', () => {
    expect(getDailyActionPlaceholder("a writer")).toBe("Write one sentence");
    expect(getDailyActionPlaceholder("someone who writes")).toBe(
      "Write one sentence",
    );
    expect(getDailyActionPlaceholder("I am writing more")).toBe(
      "Write one sentence",
    );
  });

  it('matches "medit" keywords → Sit quietly for one minute', () => {
    expect(getDailyActionPlaceholder("someone who meditates")).toBe(
      "Sit quietly for one minute",
    );
    expect(getDailyActionPlaceholder("a meditator")).toBe(
      "Sit quietly for one minute",
    );
    expect(getDailyActionPlaceholder("meditating daily")).toBe(
      "Sit quietly for one minute",
    );
  });

  it('matches "calm" → Take three slow breaths', () => {
    expect(getDailyActionPlaceholder("a calmer person")).toBe(
      "Take three slow breaths",
    );
    expect(getDailyActionPlaceholder("someone calm")).toBe(
      "Take three slow breaths",
    );
  });

  it('matches "sleep" → Be in bed by 10:30pm', () => {
    expect(getDailyActionPlaceholder("someone who sleeps well")).toBe(
      "Be in bed by 10:30pm",
    );
    expect(getDailyActionPlaceholder("better sleeper")).toBe(
      "Be in bed by 10:30pm",
    );
  });

  it('matches "draw" keywords → Sketch for two minutes', () => {
    expect(getDailyActionPlaceholder("someone who draws")).toBe(
      "Sketch for two minutes",
    );
    expect(getDailyActionPlaceholder("drawing more")).toBe(
      "Sketch for two minutes",
    );
  });

  it('matches "walk" → Walk for ten minutes', () => {
    expect(getDailyActionPlaceholder("someone who walks daily")).toBe(
      "Walk for ten minutes",
    );
    expect(getDailyActionPlaceholder("a walker")).toBe("Walk for ten minutes");
  });

  it("returns the generic fallback for an unrecognised phrase", () => {
    expect(getDailyActionPlaceholder("a more deliberate person")).toBe(
      "Take one small action",
    );
  });

  it("returns the generic fallback for an empty string", () => {
    expect(getDailyActionPlaceholder("")).toBe("Take one small action");
  });

  it("returns the generic fallback for a whitespace-only string", () => {
    expect(getDailyActionPlaceholder("   ")).toBe("Take one small action");
  });

  it("matches mixed-case input (e.g. 'A RUNNER' → run mapping)", () => {
    expect(getDailyActionPlaceholder("A RUNNER")).toBe("Run for 10 minutes");
    expect(getDailyActionPlaceholder("A WRITER")).toBe("Write one sentence");
  });

  it("returns the first matching keyword when multiple keywords are present (array order wins)", () => {
    // "run" appears before "read" in the keyword array, so "run" wins.
    expect(getDailyActionPlaceholder("a runner who reads")).toBe(
      "Run for 10 minutes",
    );
    // "read" appears before "writ", so "read" wins here.
    expect(getDailyActionPlaceholder("a reader who writes")).toBe(
      "Read one page",
    );
  });
});
