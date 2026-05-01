import { render, screen } from "@testing-library/react-native";

import { MissBanner } from "@/components/feedback/MissBanner";

describe("MissBanner", () => {
  it("renders default copy", () => {
    render(<MissBanner />);
    expect(screen.getByText("Yesterday was a miss.")).toBeTruthy();
    expect(screen.getByText("The science says it didn't matter. Keep going.")).toBeTruthy();
  });

  it("renders custom headline and body", () => {
    render(<MissBanner headline="Two days missed." body="Still counts. Keep going." />);
    expect(screen.getByText("Two days missed.")).toBeTruthy();
    expect(screen.getByText("Still counts. Keep going.")).toBeTruthy();
  });
});
