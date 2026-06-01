import { render } from "@testing-library/react-native";

const mockRedirect = jest.fn();

jest.mock("expo-router", () => ({
  Redirect: (props: { href: string }) => {
    mockRedirect(props.href);
    return null;
  },
}));

jest.mock("@/features/onboarding/OnboardingProvider", () => ({
  useOnboarding: jest.fn(),
}));

jest.mock("@/components/feedback/LoadingState", () => ({
  LoadingState: () => null,
}));

// Route file lives outside src/, so the moduleNameMapper @/ alias can't reach
// it. Use a relative path. If this file is moved, recount the ../ depth so it
// still lands on app/(onboarding)/index.tsx.
import OnboardingIndex from "../../../../app/(onboarding)/index";

const { useOnboarding } = jest.requireMock(
  "@/features/onboarding/OnboardingProvider",
) as { useOnboarding: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
});

describe("OnboardingIndex resumption", () => {
  it("redirects make-it-yours → /(onboarding)/make-it-yours", () => {
    useOnboarding.mockReturnValue({
      draft: { step: "make-it-yours" },
      hydrated: true,
    });
    render(<OnboardingIndex />);
    expect(mockRedirect).toHaveBeenCalledWith("/(onboarding)/make-it-yours");
  });

  it("redirects personalize → /(onboarding)/personalize (regression guard)", () => {
    useOnboarding.mockReturnValue({
      draft: { step: "personalize" },
      hydrated: true,
    });
    render(<OnboardingIndex />);
    expect(mockRedirect).toHaveBeenCalledWith("/(onboarding)/personalize");
  });

  it("does not redirect while unhydrated", () => {
    useOnboarding.mockReturnValue({
      draft: { step: "welcome" },
      hydrated: false,
    });
    render(<OnboardingIndex />);
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
