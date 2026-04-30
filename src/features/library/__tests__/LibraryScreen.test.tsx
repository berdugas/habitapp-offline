import { render, screen } from "@testing-library/react-native";

import LibraryScreen from "@/features/library/screens/LibraryScreen";

describe("LibraryScreen", () => {
  it("renders the §13.4 empty-state copy", () => {
    render(<LibraryScreen />);
    expect(
      screen.getByText(/Your library will grow as habits become part of who you are/),
    ).toBeTruthy();
  });
});
