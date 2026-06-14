import { render, screen, fireEvent } from "@/tests/setup/render";

import { KeepOnePicker } from "@/features/paywall/KeepOnePicker";
import { paywallCopy } from "@/features/paywall/copy";

const HABITS = [
  { id: "h1", title: "Read", identity_phrase: "a reader", status: "active" },
  { id: "h2", title: "Run", identity_phrase: "a runner", status: "backlog" },
];

function baseProps() {
  return { habits: HABITS, isSubmitting: false, onConfirm: jest.fn(), onCancel: jest.fn() };
}

it("lists all active+backlog habits plus a Keep none option", () => {
  render(<KeepOnePicker {...baseProps()} />);
  expect(screen.getByText("Read")).toBeTruthy();
  expect(screen.getByText("Run")).toBeTruthy();
  expect(screen.getByText(paywallCopy.pickerKeepNone)).toBeTruthy();
});

it("selecting a habit, continuing, then confirming calls onConfirm with that id", () => {
  const props = baseProps();
  render(<KeepOnePicker {...props} />);
  fireEvent.press(screen.getByText("Run"));
  fireEvent.press(screen.getByText("Continue"));
  fireEvent.press(screen.getByText(paywallCopy.pickerConfirmYes));
  expect(props.onConfirm).toHaveBeenCalledWith("h2");
});

it("selecting Keep none then confirming calls onConfirm with null", () => {
  const props = baseProps();
  render(<KeepOnePicker {...props} />);
  fireEvent.press(screen.getByText(paywallCopy.pickerKeepNone));
  fireEvent.press(screen.getByText("Continue"));
  fireEvent.press(screen.getByText(paywallCopy.pickerConfirmYes));
  expect(props.onConfirm).toHaveBeenCalledWith(null);
});

it("Back from the confirm step returns to the picker without confirming", () => {
  const props = baseProps();
  render(<KeepOnePicker {...props} />);
  fireEvent.press(screen.getByText("Read"));
  fireEvent.press(screen.getByText("Continue"));
  fireEvent.press(screen.getByText(paywallCopy.pickerConfirmBack));
  expect(screen.queryByText(paywallCopy.pickerConfirmYes)).toBeNull();
  expect(screen.getByText("Read")).toBeTruthy();
  expect(props.onConfirm).not.toHaveBeenCalled();
});

it("the Continue button is disabled until a selection is made", () => {
  const props = baseProps();
  render(<KeepOnePicker {...props} />);
  fireEvent.press(screen.getByText("Continue"));
  expect(screen.queryByText(paywallCopy.pickerConfirmYes)).toBeNull();
});

it("renders a retryable error message when provided", () => {
  render(<KeepOnePicker {...baseProps()} errorMessage={paywallCopy.keepOneError} />);
  expect(screen.getByText(paywallCopy.keepOneError)).toBeTruthy();
});

it("on a load failure (error + no habits) shows Retry/Back but NOT Keep none/Continue", () => {
  const onRetry = jest.fn();
  render(
    <KeepOnePicker
      habits={[]}
      isSubmitting={false}
      errorMessage={paywallCopy.keepOneError}
      onConfirm={jest.fn()}
      onCancel={jest.fn()}
      onRetry={onRetry}
    />,
  );
  expect(screen.getByText(paywallCopy.keepOneError)).toBeTruthy();
  expect(screen.getByText("Retry")).toBeTruthy();
  // Must NOT offer a way to archive every habit when the choices never loaded.
  expect(screen.queryByText(paywallCopy.pickerKeepNone)).toBeNull();
  expect(screen.queryByText("Continue")).toBeNull();
  fireEvent.press(screen.getByText("Retry"));
  expect(onRetry).toHaveBeenCalled();
});
