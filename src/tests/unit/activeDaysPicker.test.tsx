import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";

import { ActiveDaysPicker } from "@/components/forms/ActiveDaysPicker";

describe("ActiveDaysPicker", () => {
  it("renders 7 day buttons (M T W T F S S)", () => {
    render(<ActiveDaysPicker value={[1, 2, 3, 4, 5, 6, 7]} onChange={jest.fn()} />);
    // 7 circles = 7 buttons
    expect(screen.getAllByRole("checkbox")).toHaveLength(7);
  });

  it("shows the correct schedule label for all 7 days", () => {
    render(<ActiveDaysPicker value={[1, 2, 3, 4, 5, 6, 7]} onChange={jest.fn()} />);
    expect(screen.getByText("Every day")).toBeTruthy();
  });

  it("shows 'Weekdays' label for Mon–Fri", () => {
    render(<ActiveDaysPicker value={[1, 2, 3, 4, 5]} onChange={jest.fn()} />);
    expect(screen.getByText("Weekdays")).toBeTruthy();
  });

  it("shows 'Weekends' label for Sat–Sun", () => {
    render(<ActiveDaysPicker value={[6, 7]} onChange={jest.fn()} />);
    expect(screen.getByText("Weekends")).toBeTruthy();
  });

  it("shows 'N days a week' for custom selection", () => {
    render(<ActiveDaysPicker value={[1, 3, 5]} onChange={jest.fn()} />);
    expect(screen.getByText("3 days a week")).toBeTruthy();
  });

  it("calls onChange with the new sorted day array when a day is toggled on", () => {
    const onChange = jest.fn();
    render(<ActiveDaysPicker value={[1, 2, 3]} onChange={onChange} />);
    // Press Day 5 (Fri, labelled "F") — the 5th checkbox
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.press(checkboxes[4]!); // index 4 = day 5 (Fri)
    expect(onChange).toHaveBeenCalledWith([1, 2, 3, 5]);
  });

  it("calls onChange with the day removed when a selected day is toggled off", () => {
    const onChange = jest.fn();
    render(<ActiveDaysPicker value={[1, 2, 3, 4, 5]} onChange={onChange} />);
    // Press Monday (first checkbox, day 1)
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.press(checkboxes[0]!);
    expect(onChange).toHaveBeenCalledWith([2, 3, 4, 5]);
  });

  it("prevents removing the last remaining day (guard)", () => {
    const onChange = jest.fn();
    render(<ActiveDaysPicker value={[3]} onChange={onChange} />);
    // Only Wednesday is selected — pressing it should do nothing
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.press(checkboxes[2]!); // index 2 = day 3 (Wed)
    expect(onChange).not.toHaveBeenCalled();
  });

  it("disables all circles when disabled prop is true", () => {
    render(
      <ActiveDaysPicker value={[1, 2, 3, 4, 5]} onChange={jest.fn()} disabled />,
    );
    const checkboxes = screen.getAllByRole("checkbox");
    checkboxes.forEach((cb) => {
      expect(cb.props.accessibilityState?.disabled).toBe(true);
    });
  });
});
