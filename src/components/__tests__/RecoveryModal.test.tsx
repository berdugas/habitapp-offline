import { fireEvent, render, screen } from "@testing-library/react-native";

import { RecoveryModal } from "../RecoveryModal";

const baseProps = {
  visible: true,
  habitTitle: "Run every morning",
  onRestart: jest.fn(),
  onMakeItSmaller: jest.fn(),
  onPauseForNow: jest.fn(),
  onClose: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("RecoveryModal", () => {
  it("renders all four action labels when visible", () => {
    render(<RecoveryModal {...baseProps} />);
    expect(screen.getByText("Restart as-is")).toBeTruthy();
    expect(screen.getByText("Make it smaller")).toBeTruthy();
    expect(screen.getByText("Pause for now")).toBeTruthy();
    expect(screen.getByText("Just close")).toBeTruthy();
  });

  it("renders the recovery copy", () => {
    render(<RecoveryModal {...baseProps} />);
    expect(
      screen.getByText(/The habit lost some momentum/),
    ).toBeTruthy();
  });

  it("calls onRestart when Restart as-is is tapped", () => {
    render(<RecoveryModal {...baseProps} />);
    fireEvent.press(screen.getByText("Restart as-is"));
    expect(baseProps.onRestart).toHaveBeenCalledTimes(1);
  });

  it("calls onMakeItSmaller when Make it smaller is tapped", () => {
    render(<RecoveryModal {...baseProps} />);
    fireEvent.press(screen.getByText("Make it smaller"));
    expect(baseProps.onMakeItSmaller).toHaveBeenCalledTimes(1);
  });

  it("calls onPauseForNow when Pause for now is tapped", () => {
    render(<RecoveryModal {...baseProps} />);
    fireEvent.press(screen.getByText("Pause for now"));
    expect(baseProps.onPauseForNow).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Just close is tapped", () => {
    render(<RecoveryModal {...baseProps} />);
    fireEvent.press(screen.getByText("Just close"));
    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
  });

  it("does not render when visible is false", () => {
    render(<RecoveryModal {...baseProps} visible={false} />);
    expect(screen.queryByText("Restart as-is")).toBeNull();
  });
});
