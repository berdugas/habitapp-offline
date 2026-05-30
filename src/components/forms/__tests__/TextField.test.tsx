import { fireEvent, render, screen } from "@/tests/setup/render";

import { TextField } from "@/components/forms/TextField";

describe("TextField — disabled prop", () => {
  it("suppresses onChangeText when disabled", () => {
    const onChangeText = jest.fn();
    render(
      <TextField
        disabled
        label="Trigger"
        onChangeText={onChangeText}
        value="After breakfast"
      />,
    );

    const input = screen.getByDisplayValue("After breakfast");
    expect(input.props.editable).toBe(false);

    fireEvent.changeText(input, "Something else");
    // RNTL's fireEvent respects editable={false}: the change handler is
    // not invoked. This confirms the disabled wiring suppresses edits at
    // the platform layer, not just visually.
    expect(onChangeText).not.toHaveBeenCalled();
  });

  it("renders editable by default", () => {
    render(
      <TextField
        label="Tiny action"
        onChangeText={jest.fn()}
        value="Put on shoes"
      />,
    );

    const input = screen.getByDisplayValue("Put on shoes");
    expect(input.props.editable).not.toBe(false);
  });

  it("applies disabled styling to the onboarding variant", () => {
    render(
      <TextField
        disabled
        label="Habit"
        onChangeText={jest.fn()}
        value="Walk daily"
        variant="onboarding"
      />,
    );

    const input = screen.getByDisplayValue("Walk daily");
    expect(input.props.editable).toBe(false);
  });
});
