import { render, screen } from "@/tests/setup/render";
import React from "react";

import { WeekCompleteStep } from "@/features/reviews/components/WeekCompleteStep";

describe("WeekCompleteStep", () => {
  it("uses the real italic display font for the goal identity hero", () => {
    render(
      <WeekCompleteStep
        catchUpState="done"
        consistencyPercent={57}
        daysOnJourney={32}
        hasMutation
        identityPhrase="a reviewer"
        onDone={jest.fn()}
        onRetryCatchUp={jest.fn()}
        skippedCount={0}
        tunedCount={1}
      />,
    );

    expect(screen.getByText("Becoming a reviewer")).toHaveStyle({
      fontFamily: "PlusJakartaSans_700Bold_Italic",
    });
  });
});