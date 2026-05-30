import * as Font from "expo-font";

import { ensureCachedFont } from "@/theme/fonts/cache";

import type { Theme } from "@/theme/contract";

export async function loadFontsFor(theme: Theme, signal: AbortSignal): Promise<void> {
  if (theme.fontAssets.kind === "bundled") {
    await Font.loadAsync(theme.fontAssets.assets);
    return;
  }

  const entries = Object.entries(theme.fontAssets.assets);
  const cachedPaths = await Promise.all(
    entries.map(async ([name, asset]) => {
      const path = await ensureCachedFont(asset, signal);
      return [name, path] as const;
    }),
  );

  const registration: Record<string, { uri: string }> = {};
  for (const [name, path] of cachedPaths) {
    registration[name] = { uri: path };
  }

  await Font.loadAsync(registration);
}
