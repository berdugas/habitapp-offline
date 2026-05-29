import { render, screen } from "@/tests/setup/render";

import { Eyebrow } from "@/components/text/Eyebrow";
import { colors } from "@/tests/setup/themeValues";

describe("Eyebrow", () => {
  it("renders label in uppercase", () => {
    render(<Eyebrow label="preview" />);
    expect(screen.getByText("PREVIEW")).toBeTruthy();
  });

  it("uses textMuted color by default", () => {
    render(<Eyebrow label="your habit" />);
    const el = screen.getByText("YOUR HABIT");
    const styles = (el.props.style as object[]).flat().filter(Boolean);
    expect(styles.some((s: { color?: string }) => s.color === colors.textMuted)).toBe(true);
  });

  it("uses primary color when tone=primary", () => {
    render(<Eyebrow label="suggested" tone="primary" />);
    const el = screen.getByText("SUGGESTED");
    const styles = (el.props.style as object[]).flat().filter(Boolean);
    expect(styles.some((s: { color?: string }) => s.color === colors.primary)).toBe(true);
  });

  it("uses danger color when tone=danger", () => {
    render(<Eyebrow label="delete habit" tone="danger" />);
    const el = screen.getByText("DELETE HABIT");
    const styles = (el.props.style as object[]).flat().filter(Boolean);
    expect(styles.some((s: { color?: string }) => s.color === colors.danger)).toBe(true);
  });
});
