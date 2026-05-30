import { ensureCachedFont, deleteCachedFont, getCachePath } from "@/theme/fonts/cache";

// SDK 54: the functional file-system API moved to the `/legacy` subpath.
jest.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///mock-cache/",
  documentDirectory: "file:///mock-docs/",
  getInfoAsync: jest.fn(),
  downloadAsync: jest.fn(),
  deleteAsync: jest.fn(),
  moveAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  EncodingType: { Base64: "base64", UTF8: "utf8" },
}));

jest.mock("expo-crypto", () => ({
  digestStringAsync: jest.fn(),
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  CryptoEncoding: { HEX: "hex" },
}));

import * as FileSystem from "expo-file-system/legacy";
import * as Crypto from "expo-crypto";

const mockedFs = FileSystem as jest.Mocked<typeof FileSystem>;
const mockedCrypto = Crypto as jest.Mocked<typeof Crypto>;

beforeEach(() => {
  jest.clearAllMocks();
  mockedFs.makeDirectoryAsync.mockResolvedValue();
});

describe("ensureCachedFont", () => {
  it("returns existing cached path when file already present", async () => {
    mockedFs.getInfoAsync.mockResolvedValueOnce({ exists: true, uri: "file:///mock-cache/fonts/abc.ttf" } as any);

    const path = await ensureCachedFont({ uri: "https://x/font.ttf", hash: "abc", bytes: 100 }, new AbortController().signal);

    expect(path).toBe("file:///mock-cache/fonts/abc.ttf");
    expect(mockedFs.downloadAsync).not.toHaveBeenCalled();
  });

  it("downloads, verifies hash, moves into cache when not present", async () => {
    mockedFs.getInfoAsync.mockResolvedValueOnce({ exists: false } as any);
    mockedFs.downloadAsync.mockResolvedValueOnce({ uri: "file:///mock-cache/fonts/abc.tmp" } as any);
    mockedFs.readAsStringAsync.mockResolvedValueOnce("font-bytes");
    mockedCrypto.digestStringAsync.mockResolvedValueOnce("abc");
    mockedFs.moveAsync.mockResolvedValueOnce();

    const path = await ensureCachedFont({ uri: "https://x/font.ttf", hash: "abc", bytes: 100 }, new AbortController().signal);

    expect(mockedFs.downloadAsync).toHaveBeenCalled();
    expect(mockedCrypto.digestStringAsync).toHaveBeenCalled();
    expect(mockedFs.moveAsync).toHaveBeenCalled();
    expect(path).toBe("file:///mock-cache/fonts/abc.ttf");
  });

  it("deletes temp file and throws when hash mismatches", async () => {
    mockedFs.getInfoAsync.mockResolvedValueOnce({ exists: false } as any);
    mockedFs.downloadAsync.mockResolvedValueOnce({ uri: "file:///mock-cache/fonts/abc.tmp" } as any);
    mockedFs.readAsStringAsync.mockResolvedValueOnce("font-bytes");
    mockedCrypto.digestStringAsync.mockResolvedValueOnce("WRONG-HASH");

    await expect(
      ensureCachedFont({ uri: "https://x/font.ttf", hash: "abc", bytes: 100 }, new AbortController().signal),
    ).rejects.toThrow(/integrity/i);

    expect(mockedFs.deleteAsync).toHaveBeenCalledWith(expect.stringContaining(".tmp"), { idempotent: true });
    expect(mockedFs.moveAsync).not.toHaveBeenCalled();
  });

  it("aborts download when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    mockedFs.getInfoAsync.mockResolvedValueOnce({ exists: false } as any);

    await expect(
      ensureCachedFont({ uri: "https://x/font.ttf", hash: "abc", bytes: 100 }, controller.signal),
    ).rejects.toThrow(/aborted/i);
  });
});

describe("deleteCachedFont", () => {
  it("deletes the hash-keyed file from cache idempotently", async () => {
    mockedFs.deleteAsync.mockResolvedValueOnce();

    await deleteCachedFont("abc");

    expect(mockedFs.deleteAsync).toHaveBeenCalledWith(
      "file:///mock-cache/fonts/abc.ttf",
      { idempotent: true },
    );
  });
});

describe("getCachePath", () => {
  it("returns hash-keyed path in cache directory", () => {
    expect(getCachePath("abcdef")).toBe("file:///mock-cache/fonts/abcdef.ttf");
  });
});
