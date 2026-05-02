import { fireEvent, render, screen } from "@testing-library/react-native";

import { NullableBooleanField } from "@/components/forms/NullableBooleanField";

describe("NullableBooleanField", () => {
  it("renders Yes and No options", () => {
    render(<NullableBooleanField label="Did this feel hard?" value={null} onChange={() => {}} />);
    expect(screen.getByText("Yes")).toBeTruthy();
    expect(screen.getByText("No")).toBeTruthy();
  });

  it("calls onChange with true when Yes is tapped", () => {
    const onChange = jest.fn();
    render(<NullableBooleanField label="Question" value={null} onChange={onChange} />);
    fireEvent.press(screen.getByText("Yes"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("calls onChange with false when No is tapped", () => {
    const onChange = jest.fn();
    render(<NullableBooleanField label="Question" value={null} onChange={onChange} />);
    fireEvent.press(screen.getByText("No"));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("deselects by calling onChange with null when the selected option is tapped", () => {
    const onChange = jest.fn();
    render(<NullableBooleanField label="Question" value={true} onChange={onChange} />);
    fireEvent.press(screen.getByText("Yes"));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("marks the selected option with accessibilityState selected", () => {
    render(<NullableBooleanField label="Question" value={false} onChange={() => {}} />);
    expect(screen.getByLabelText("No selected")).toBeTruthy();
  });
});
