import { fireEvent, render, screen } from "@testing-library/react-native";

import { DangerZone } from "@/components/sections/DangerZone";
import { colors } from "@/theme/colors";

function flattenStyle(style: unknown) {
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.flat().filter(Boolean));
  }
  return style ?? {};
}

describe("DangerZone", () => {
  it("renders title via Eyebrow danger tone, body, and danger button", () => {
    render(
      <DangerZone
        title="Delete habit"
        body="Permanently removes this habit."
        buttonLabel="Delete habit"
        onPress={() => {}}
      />,
    );
    expect(screen.getByText("DELETE HABIT")).toBeTruthy();
    expect(screen.getByText("Permanently removes this habit.")).toBeTruthy();
    expect(screen.getByText("Delete habit")).toBeTruthy();
  });

  it("invokes onPress when the button is tapped", () => {
    const onPress = jest.fn();
    render(
      <DangerZone
        title="Delete habit"
        body="Body"
        buttonLabel="Delete habit"
        onPress={onPress}
      />,
    );
    fireEvent.press(screen.getByText("Delete habit"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("shows 'Deleting…' label and disables the button when isPending", () => {
    const onPress = jest.fn();
    render(
      <DangerZone
        title="Delete habit"
        body="Body"
        buttonLabel="Delete habit"
        onPress={onPress}
        isPending
      />,
    );
    expect(screen.getByText("Deleting…")).toBeTruthy();
    expect(screen.queryByText("Delete habit")).toBeNull();
    fireEvent.press(screen.getByText("Deleting…"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("disables the button when disabled is true", () => {
    const onPress = jest.fn();
    render(
      <DangerZone
        title="Delete habit"
        body="Body"
        buttonLabel="Delete habit"
        onPress={onPress}
        disabled
      />,
    );
    fireEvent.press(screen.getByText("Delete habit"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("applies dangerSoft background and dangerSubtle border on the container", () => {
    render(
      <DangerZone
        title="Delete habit"
        body="Body"
        buttonLabel="Delete habit"
        onPress={() => {}}
      />,
    );
    // Walk up from the body Text until we hit a View whose style has the
    // dangerSoft background. The intermediate Text wrapper between View and
    // its rendered text varies by RN version, so a single .parent isn't
    // reliable.
    let node = screen.getByText("Body").parent;
    let flat: { backgroundColor?: string; borderColor?: string } = {};
    while (node) {
      const candidate = flattenStyle(node.props.style) as typeof flat;
      if (candidate.backgroundColor === colors.dangerSoft) {
        flat = candidate;
        break;
      }
      node = node.parent;
    }
    expect(flat.backgroundColor).toBe(colors.dangerSoft);
    expect(flat.borderColor).toBe(colors.dangerSubtle);
  });
});
