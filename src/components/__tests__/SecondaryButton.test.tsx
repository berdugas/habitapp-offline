import { render, screen } from "@/tests/setup/render";

import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { colors } from "@/tests/setup/themeValues";

function flattenStyle(style: unknown) {
  if (Array.isArray(style)) {
    return Object.assign({}, ...style.flat().filter(Boolean));
  }
  return style ?? {};
}

describe("SecondaryButton", () => {
  it("uses danger color when isDanger is true", () => {
    render(<SecondaryButton label="Delete habit" isDanger onPress={() => {}} />);
    const el = screen.getByText("Delete habit");
    const flat = flattenStyle(el.props.style) as { color?: string };
    expect(flat.color).toBe(colors.danger);
  });

  it("uses default text color when isDanger is false or undefined", () => {
    render(<SecondaryButton label="Archive" onPress={() => {}} />);
    const el = screen.getByText("Archive");
    const flat = flattenStyle(el.props.style) as { color?: string };
    expect(flat.color).toBe(colors.text);
  });
});
