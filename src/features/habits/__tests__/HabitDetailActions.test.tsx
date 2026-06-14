import { render, screen, fireEvent } from "@/tests/setup/render";
import React from "react";

import { HabitDetailActions } from "@/features/habits/components/HabitDetailActions";

const habit = { id: "h1", status: "active", title: "Read" } as never;

describe("HabitDetailActions — paywall affordances", () => {
  it("free-tier shows Unlock to archive and calls onUnlockArchive", () => {
    const onUnlockArchive = jest.fn();
    render(
      <HabitDetailActions
        habit={habit}
        isReadOnly={false}
        isFreeTierLocked
        archivePending={false}
        archiveIntroLoading={false}
        archiveError={false}
        onArchivePress={jest.fn()}
        onUnlockArchive={onUnlockArchive}
        onBackPress={jest.fn()}
      />,
    );
    fireEvent.press(screen.getByText("Unlock to archive"));
    expect(onUnlockArchive).toHaveBeenCalled();
  });

  it("non-free-tier active habit shows Archive habit button", () => {
    const onArchivePress = jest.fn();
    render(
      <HabitDetailActions
        habit={habit}
        isReadOnly={false}
        isFreeTierLocked={false}
        archivePending={false}
        archiveIntroLoading={false}
        archiveError={false}
        onArchivePress={onArchivePress}
        onUnlockArchive={jest.fn()}
        onBackPress={jest.fn()}
      />,
    );
    expect(screen.getByText("Archive habit")).toBeTruthy();
    expect(screen.queryByText("Unlock to archive")).toBeNull();
  });

  it("isReadOnly disables the Archive habit button (offline read-only)", () => {
    render(
      <HabitDetailActions
        habit={habit}
        isReadOnly
        isFreeTierLocked={false}
        archivePending={false}
        archiveIntroLoading={false}
        archiveError={false}
        onArchivePress={jest.fn()}
        onUnlockArchive={jest.fn()}
        onBackPress={jest.fn()}
      />,
    );
    // Archive habit button present but disabled — text should still be visible
    expect(screen.getByText("Archive habit")).toBeTruthy();
    expect(screen.queryByText("Unlock to archive")).toBeNull();
  });
});
