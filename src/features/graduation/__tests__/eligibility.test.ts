import {
  checkGraduationEligibility,
  type EligibilityInput,
} from "@/features/graduation/eligibility";
import type { SRHIResponse } from "@/lib/db/repositories/srhi_responses";

function makeInput(overrides: Partial<EligibilityInput> = {}): EligibilityInput {
  return {
    habit: {
      id: "h1",
      habit_state: "active",
      status: "active",
      start_date: "2026-01-01",
    },
    consistencyRate: 0.8,
    activeDaysElapsed: 80,
    latestSRHI: null,
    todayDate: "2026-05-14",
    ...overrides,
  };
}

function makeSRHI(overrides: Partial<SRHIResponse> = {}): SRHIResponse {
  return {
    id: "r1",
    habit_id: "h1",
    user_id: "user-1",
    q1_score: 3,
    q2_score: 3,
    q3_score: 3,
    average_score: 3,
    graduated: false,
    created_at: "2026-05-04T10:00:00.000Z",
    ...overrides,
  };
}

describe("checkGraduationEligibility", () => {
  it("happy path — 60+ active days, 80% consistency, no prior SRHI → eligible", () => {
    expect(checkGraduationEligibility(makeInput())).toEqual({
      eligible: true,
      reason: "eligible",
    });
  });

  it("too young at 59 active days", () => {
    expect(
      checkGraduationEligibility(makeInput({ activeDaysElapsed: 59 })),
    ).toEqual({ eligible: false, reason: "too_young" });
  });

  it("boundary — exactly 60 active days is eligible (≥ not >)", () => {
    expect(
      checkGraduationEligibility(makeInput({ activeDaysElapsed: 60 })),
    ).toEqual({ eligible: true, reason: "eligible" });
  });

  it("consistency too low at 70%", () => {
    expect(
      checkGraduationEligibility(makeInput({ consistencyRate: 0.7 })),
    ).toEqual({ eligible: false, reason: "consistency_too_low" });
  });

  it("boundary — exactly 75% consistency is eligible (≥ not >)", () => {
    expect(
      checkGraduationEligibility(makeInput({ consistencyRate: 0.75 })),
    ).toEqual({ eligible: true, reason: "eligible" });
  });

  it("habit already graduated (habit_state='automatic')", () => {
    expect(
      checkGraduationEligibility(
        makeInput({
          habit: {
            id: "h1",
            habit_state: "automatic",
            status: "active",
            start_date: "2026-01-01",
          },
        }),
      ),
    ).toEqual({ eligible: false, reason: "already_graduated" });
  });

  it("archived habit → not_active", () => {
    expect(
      checkGraduationEligibility(
        makeInput({
          habit: {
            id: "h1",
            habit_state: "active",
            status: "archived",
            start_date: "2026-01-01",
          },
        }),
      ),
    ).toEqual({ eligible: false, reason: "not_active" });
  });

  it("backlog habit → not_active", () => {
    expect(
      checkGraduationEligibility(
        makeInput({
          habit: {
            id: "h1",
            habit_state: "active",
            status: "backlog",
            start_date: "2026-01-01",
          },
        }),
      ),
    ).toEqual({ eligible: false, reason: "not_active" });
  });

  it("cooldown — failed SRHI 10 days ago", () => {
    expect(
      checkGraduationEligibility(
        makeInput({
          todayDate: "2026-05-14",
          latestSRHI: makeSRHI({
            graduated: false,
            created_at: "2026-05-04T10:00:00.000Z",
          }),
        }),
      ),
    ).toEqual({ eligible: false, reason: "cooldown" });
  });

  it("cooldown expired — failed SRHI 14 days ago is eligible (≥ not >)", () => {
    expect(
      checkGraduationEligibility(
        makeInput({
          todayDate: "2026-05-15",
          latestSRHI: makeSRHI({
            graduated: false,
            created_at: "2026-05-01T10:00:00.000Z",
          }),
        }),
      ),
    ).toEqual({ eligible: true, reason: "eligible" });
  });

  it("passing SRHI implies habit is already graduated (R1)", () => {
    // After a passing ceremony, recordAndProcessGraduation sets
    // habit_state='automatic'. The check at habit_state catches this before
    // cooldown logic runs.
    expect(
      checkGraduationEligibility(
        makeInput({
          habit: {
            id: "h1",
            habit_state: "automatic",
            status: "active",
            start_date: "2026-01-01",
          },
          todayDate: "2026-05-14",
          latestSRHI: makeSRHI({
            graduated: true,
            average_score: 4.33,
            created_at: "2026-05-09T10:00:00.000Z",
          }),
        }),
      ),
    ).toEqual({ eligible: false, reason: "already_graduated" });
  });

  it("no SRHI history with all conditions met → eligible", () => {
    expect(
      checkGraduationEligibility(
        makeInput({ latestSRHI: null, activeDaysElapsed: 90, consistencyRate: 0.9 }),
      ),
    ).toEqual({ eligible: true, reason: "eligible" });
  });
});
