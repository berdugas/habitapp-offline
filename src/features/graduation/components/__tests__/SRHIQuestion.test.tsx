import { fireEvent, render, screen } from "@testing-library/react-native";

import { SRHIQuestion } from "@/features/graduation/components/SRHIQuestion";

function flatten<T = Record<string, unknown>>(style: unknown): T {
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.filter(Boolean)) as T;
  }
  return (style ?? {}) as T;
}

describe("SRHIQuestion", () => {
  it("renders the question text and five scale chips", () => {
    render(
      <SRHIQuestion
        onSelect={jest.fn()}
        questionNumber={1}
        questionText="I do this automatically."
        selectedScore={null}
      />,
    );

    expect(screen.getByText("I do this automatically.")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText("5")).toBeTruthy();
    expect(screen.getByText("Strongly disagree")).toBeTruthy();
    expect(screen.getByText("Strongly agree")).toBeTruthy();
  });

  it("calls onSelect with the chip number when tapped", () => {
    const onSelect = jest.fn();
    render(
      <SRHIQuestion
        onSelect={onSelect}
        questionNumber={2}
        questionText="It would feel strange not to do this."
        selectedScore={null}
      />,
    );

    fireEvent.press(screen.getByLabelText("Question 2 score 4"));
    expect(onSelect).toHaveBeenCalledWith(4);
  });

  it("applies the primarySoft selected style to the selected chip", () => {
    render(
      <SRHIQuestion
        onSelect={jest.fn()}
        questionNumber={1}
        questionText="I do this automatically."
        selectedScore={3}
      />,
    );

    const selected = screen.getByLabelText("Question 1 score 3");
    const flat = flatten<{ borderColor: string }>(selected.props.style);
    // colors.primary border on the selected chip
    expect(flat.borderColor).toBe("#446655");
  });

  it("disabled chips ignore taps", () => {
    const onSelect = jest.fn();
    render(
      <SRHIQuestion
        disabled
        onSelect={onSelect}
        questionNumber={1}
        questionText="I do this automatically."
        selectedScore={null}
      />,
    );

    fireEvent.press(screen.getByLabelText("Question 1 score 5"));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
