import { render } from "@testing-library/react-native";

import { ConsistencyDonut } from "@/features/today/components/ConsistencyDonut";
import { colors } from "@/theme/colors";

// react-native-svg encodes color props as { type: 0, payload: 0xFFRRGGBB }.
// Convert a "#RRGGBB" string to that integer to compare against rendered props.
function encodeHex(hex: string): number {
  const clean = hex.replace("#", "");
  return 0xff000000 + parseInt(clean, 16);
}

type StrokePayload = { type: number; payload: number };

function findStrokePayloads(json: unknown): number[] {
  const out: number[] = [];
  function walk(node: unknown) {
    if (!node || typeof node !== "object") return;
    const n = node as {
      props?: { stroke?: StrokePayload | string };
      children?: unknown;
    };
    const stroke = n.props?.stroke;
    if (stroke && typeof stroke === "object" && "payload" in stroke) {
      out.push(stroke.payload);
    }
    if (Array.isArray(n.children)) {
      for (const c of n.children) walk(c);
    } else if (n.children) {
      walk(n.children);
    }
  }
  walk(json);
  return out;
}

describe("ConsistencyDonut tint", () => {
  it("defaults the progress ring to colors.primary when tint is omitted", () => {
    const { toJSON } = render(<ConsistencyDonut rate={0.5} label="" />);
    const strokes = findStrokePayloads(toJSON());
    expect(strokes).toContain(encodeHex(colors.primary));
  });

  it("uses the provided tint for the progress ring", () => {
    const { toJSON } = render(
      <ConsistencyDonut rate={0.5} label="" tint={colors.graduatedCircle} />,
    );
    const strokes = findStrokePayloads(toJSON());
    expect(strokes).toContain(encodeHex(colors.graduatedCircle));
    expect(strokes).not.toContain(encodeHex(colors.primary));
  });

  it("uses the provided tint even when suppressed (low-data state)", () => {
    const { toJSON } = render(
      <ConsistencyDonut
        rate={0.5}
        label=""
        suppressed
        tint={colors.graduatedCircle}
      />,
    );
    const strokes = findStrokePayloads(toJSON());
    expect(strokes).toContain(encodeHex(colors.graduatedCircle));
  });
});
