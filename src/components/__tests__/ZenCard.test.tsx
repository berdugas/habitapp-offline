import { render, screen } from "@/tests/setup/render";
import { Text } from "react-native";

import { ZenCard } from "@/components/cards/ZenCard";

describe("ZenCard", () => {
  it("renders children", () => {
    render(
      <ZenCard>
        <Text>Hello</Text>
      </ZenCard>,
    );
    expect(screen.getByText("Hello")).toBeTruthy();
  });

  it("renders multiple children", () => {
    render(
      <ZenCard>
        <Text>First</Text>
        <Text>Second</Text>
      </ZenCard>,
    );
    expect(screen.getByText("First")).toBeTruthy();
    expect(screen.getByText("Second")).toBeTruthy();
  });

  it("accepts xxl padding prop without error", () => {
    expect(() =>
      render(
        <ZenCard padding="xxl">
          <Text>Content</Text>
        </ZenCard>,
      ),
    ).not.toThrow();
  });

  it("accepts custom gap without error", () => {
    expect(() =>
      render(
        <ZenCard gap={8}>
          <Text>Content</Text>
        </ZenCard>,
      ),
    ).not.toThrow();
  });
});
