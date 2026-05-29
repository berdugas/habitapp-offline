import { loadFontsFor } from "@/theme/fonts/loader";

jest.mock("expo-font", () => ({
  loadAsync: jest.fn(),
  isLoaded: jest.fn(() => false),
}));
jest.mock("@/theme/fonts/cache", () => ({
  ensureCachedFont: jest.fn(),
}));

import * as Font from "expo-font";
import { ensureCachedFont } from "@/theme/fonts/cache";

const mockedFont = Font as jest.Mocked<typeof Font>;
const mockedEnsure = ensureCachedFont as jest.MockedFunction<typeof ensureCachedFont>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("loadFontsFor", () => {
  it("calls Font.loadAsync directly for bundled themes", async () => {
    const theme = {
      fontAssets: {
        kind: "bundled" as const,
        assets: { Foo: 42 },
      },
    };

    await loadFontsFor(theme as any, new AbortController().signal);

    expect(mockedFont.loadAsync).toHaveBeenCalledWith({ Foo: 42 });
    expect(mockedEnsure).not.toHaveBeenCalled();
  });

  it("downloads then registers each font for remote themes", async () => {
    mockedEnsure
      .mockResolvedValueOnce("file:///cache/abc.ttf")
      .mockResolvedValueOnce("file:///cache/def.ttf");

    const theme = {
      fontAssets: {
        kind: "remote" as const,
        assets: {
          Foo: { uri: "https://x/a.ttf", hash: "abc", bytes: 100 },
          Bar: { uri: "https://x/b.ttf", hash: "def", bytes: 200 },
        },
      },
    };

    await loadFontsFor(theme as any, new AbortController().signal);

    expect(mockedEnsure).toHaveBeenCalledTimes(2);
    expect(mockedFont.loadAsync).toHaveBeenCalledWith({
      Foo: { uri: "file:///cache/abc.ttf" },
      Bar: { uri: "file:///cache/def.ttf" },
    });
  });

  it("propagates abort signal to cache layer", async () => {
    const controller = new AbortController();
    controller.abort();

    mockedEnsure.mockRejectedValueOnce(new Error("Download aborted"));

    const theme = {
      fontAssets: {
        kind: "remote" as const,
        assets: { Foo: { uri: "https://x", hash: "abc", bytes: 100 } },
      },
    };

    await expect(loadFontsFor(theme as any, controller.signal)).rejects.toThrow(/aborted/i);
  });
});
