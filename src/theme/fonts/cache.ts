// SDK 54: the functional file-system API moved to the `/legacy` subpath.
// The default `expo-file-system` export is now the File/Directory/Paths OO
// API. We use legacy here for v1 — it's deprecated but fully supported on
// SDK 54. Migrating to the new API is a documented follow-up.
import * as FileSystem from "expo-file-system/legacy";
import * as Crypto from "expo-crypto";

import type { RemoteFontAsset } from "@/theme/contract";

const FONTS_DIR = `${FileSystem.cacheDirectory}fonts/`;

export function getCachePath(hash: string): string {
  return `${FONTS_DIR}${hash}.ttf`;
}

async function ensureDir(): Promise<void> {
  await FileSystem.makeDirectoryAsync(FONTS_DIR, { intermediates: true }).catch(() => {
    // Already exists; ignore.
  });
}

export async function ensureCachedFont(
  asset: RemoteFontAsset,
  signal: AbortSignal,
): Promise<string> {
  if (signal.aborted) {
    throw new Error("Download aborted before start");
  }

  await ensureDir();
  const cachedPath = getCachePath(asset.hash);

  const info = await FileSystem.getInfoAsync(cachedPath);
  if (info.exists) {
    return cachedPath;
  }

  const tmpPath = `${cachedPath}.tmp`;

  // expo-file-system's downloadAsync does not natively accept an AbortSignal.
  // Race the download against signal abort; if the signal fires, delete any
  // partial file and throw.
  const downloadPromise = FileSystem.downloadAsync(asset.uri, tmpPath);
  const abortPromise = new Promise<never>((_, reject) => {
    signal.addEventListener("abort", () => {
      reject(new Error("Download aborted"));
    });
  });

  try {
    await Promise.race([downloadPromise, abortPromise]);
  } catch (err) {
    try { await FileSystem.deleteAsync(tmpPath, { idempotent: true }); } catch {}
    throw err;
  }

  // Verify integrity. Hash the base64 representation (matches the recorded
  // server-side hashes).
  const fileContents = await FileSystem.readAsStringAsync(tmpPath, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const computedHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    fileContents,
    { encoding: Crypto.CryptoEncoding.HEX },
  );

  if (computedHash !== asset.hash) {
    try { await FileSystem.deleteAsync(tmpPath, { idempotent: true }); } catch {}
    throw new Error(
      `Font integrity check failed: expected ${asset.hash}, got ${computedHash}`,
    );
  }

  await FileSystem.moveAsync({ from: tmpPath, to: cachedPath });
  return cachedPath;
}

export async function deleteCachedFont(hash: string): Promise<void> {
  await FileSystem.deleteAsync(getCachePath(hash), { idempotent: true });
}

export async function clearFontCache(): Promise<void> {
  await FileSystem.deleteAsync(FONTS_DIR, { idempotent: true });
}
