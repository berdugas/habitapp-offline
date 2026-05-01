import { render, screen } from "@testing-library/react-native";

import { RowLV } from "@/components/cards/RowLV";

describe("RowLV", () => {
  it("renders label in uppercase and value as-is", () => {
    render(<RowLV label="identity" value="Become a runner" />);
    expect(screen.getByText("IDENTITY")).toBeTruthy();
    expect(screen.getByText("Become a runner")).toBeTruthy();
  });

  it("renders different label/value combinations", () => {
    render(<RowLV label="cue" value="After coffee" />);
    expect(screen.getByText("CUE")).toBeTruthy();
    expect(screen.getByText("After coffee")).toBeTruthy();
  });
});
