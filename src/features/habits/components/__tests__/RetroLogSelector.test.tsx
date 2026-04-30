import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { RetroLogError } from "@/features/habits/api";
import { RetroLogSelector } from "@/features/habits/components/RetroLogSelector";

describe("RetroLogSelector", () => {
  function makeProps(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      canEdit: true,
      currentStatus: null,
      date: "2026-04-29",
      isVisible: true,
      isPending: false,
      onClose: jest.fn(),
      onSubmit: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    } as React.ComponentProps<typeof RetroLogSelector>;
  }

  it("renders Done and Skip when canEdit is true", () => {
    render(<RetroLogSelector {...makeProps()} />);
    expect(screen.getByText("Done")).toBeTruthy();
    expect(screen.getByText("Skip")).toBeTruthy();
  });

  it("renders the locked message and no Done/Skip when canEdit is false", () => {
    render(<RetroLogSelector {...makeProps({ canEdit: false })} />);
    expect(
      screen.getByText("This day is locked. Logs older than 48 hours can't be changed."),
    ).toBeTruthy();
    expect(screen.queryByText("Done")).toBeNull();
    expect(screen.queryByText("Skip")).toBeNull();
  });

  it("shows current status when one exists", () => {
    render(<RetroLogSelector {...makeProps({ currentStatus: "done" })} />);
    expect(screen.getByText("Currently done")).toBeTruthy();
    expect(screen.getByText("Done ✓")).toBeTruthy();
  });

  it("calls onSubmit with 'done' when Done is tapped, then closes", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    render(<RetroLogSelector {...makeProps({ onClose, onSubmit })} />);
    fireEvent.press(screen.getByText("Done"));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("done"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("surfaces RetroLogError reason as user-facing copy", async () => {
    const onSubmit = jest
      .fn()
      .mockRejectedValueOnce(new RetroLogError("outside_window"));
    const onClose = jest.fn();
    render(<RetroLogSelector {...makeProps({ onClose, onSubmit })} />);
    fireEvent.press(screen.getByText("Done"));
    await waitFor(() =>
      expect(
        screen.getByText("This day was more than 48 hours ago. It's locked."),
      ).toBeTruthy(),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders nothing when isVisible is false", () => {
    render(<RetroLogSelector {...makeProps({ isVisible: false })} />);
    expect(screen.queryByText("Done")).toBeNull();
  });
});
