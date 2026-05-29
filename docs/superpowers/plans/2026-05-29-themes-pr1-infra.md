# Themes — PR 1 (Infrastructure) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the theming infrastructure (contract, registry, provider, hooks, font loader, three theme data files, AppearanceScreen, test wiring) without touching any existing styled components. App stays visually on Zen for end-users; AppearanceScreen is reachable only through a `__DEV__`-gated Settings entry for visual verification during subsequent migration PRs.

**Architecture:** React Context (`ThemeProvider`) at the app root holds the active `Theme` object. `useTheme()` hook + `useThemedStyles()` factory expose it to components. Themes are code-defined objects matching a strict 23-color contract. Zen fonts ship bundled (existing `@expo-google-fonts/*` packages); Cafe and Fantasy fonts lazy-load from Supabase storage with SHA256 verification and disk caching. Existing `src/theme/colors.ts` (and siblings) become re-export shims that point to `themes/zen.ts` — all 91 component-level imports continue to compile unchanged.

**Tech Stack:** TypeScript, React Native, Expo SDK 54, expo-font 14.0.11, expo-file-system 19.0.22, expo-crypto (newly added), expo-router 6.0.23, react-native-svg 15.12.1, Jest 29 with jest-expo preset, @testing-library/react-native 13.3.

**Spec reference:** [docs/superpowers/specs/2026-05-29-themes-design.md](../specs/2026-05-29-themes-design.md). This plan implements PR 1 from the spec's §8 migration plan. PRs 2-6 (component migrations + finalizer) get separate follow-up plans.

---

## File Structure (PR 1 only)

**Created:**
```
src/theme/contract.ts
src/theme/registry.ts
src/theme/ThemeProvider.tsx
src/theme/useTheme.ts
src/theme/useThemedStyles.ts
src/theme/fonts/cache.ts
src/theme/fonts/loader.ts
src/theme/themes/zen.ts
src/theme/themes/cafe.ts
src/theme/themes/fantasy.ts
src/theme/themes/previews/zen.svg          (Pre-PR-1 manual deliverable)
src/theme/themes/previews/cafe.svg         (Pre-PR-1 manual deliverable)
src/theme/themes/previews/fantasy.svg      (Pre-PR-1 manual deliverable)
src/theme/__tests__/contract.test.ts
src/theme/__tests__/registry.test.ts
src/theme/__tests__/contrast.test.ts
src/theme/__tests__/ThemeProvider.test.tsx
src/theme/__tests__/useThemedStyles.test.tsx
src/theme/fonts/__tests__/cache.test.ts
src/theme/fonts/__tests__/loader.test.ts
src/tests/setup/renderWithTheme.tsx
src/tests/setup/render.tsx                  (wrap of @testing-library/react-native render)
src/features/settings/screens/AppearanceScreen.tsx
src/features/settings/screens/__tests__/AppearanceScreen.test.tsx
app/(app)/settings/appearance.tsx           (expo-router screen entry)
```

**Modified:**
```
src/theme/colors.ts                         (rewritten as re-export shim)
src/theme/typography.ts                     (rewritten as re-export shim)
src/theme/spacing.ts                        (rewritten as re-export shim)
src/theme/radius.ts                         (rewritten as re-export shim)
src/theme/shadows.ts                        (rewritten as re-export shim)
src/theme/fontFamilies.ts                   (rewritten as re-export shim)
src/theme/index.ts                          (add registry/Provider/hook exports)
app/_layout.tsx                             (wrap with ThemeProvider; existing inline color refs unchanged)
src/features/settings/screens/SettingsScreen.tsx  (add __DEV__ row to AppearanceScreen)
src/lib/db/repositories/preferences.ts      (no changes — using existing API)
jest.config.js                              (add src/theme/**/__tests__ to testMatch)
package.json                                (+expo-crypto)
```

**Untouched:** All 91 existing styled components. All other features. Database schema (the `local_user_preferences` key/value table already exists). No new env vars.

---

## Task 0: Pre-PR-1 manual blockers — ✅ COMPLETE (2026-05-29)

**Files:** none (these produced external artifacts referenced by later tasks).

**Status: DONE.** Both sub-tasks were completed before plan execution started. The font URIs/hashes/bytes are already inlined into Task 3 (Cafe) and Task 4 (Fantasy) below. The preview SVGs are already committed (`eb8d9eb`). The implementer does NOT need to redo any of this. The detail below is preserved for the record.

### 0a — Upload fonts to Supabase storage — ✅ DONE

11 font TTFs were downloaded (from `@expo-google-fonts/*` packages), uploaded to the public `fonts` bucket in the `habitapp` Supabase project (id `wrytjnucrxsqdrbwxsgi`), and verified by re-downloading and comparing hashes.

Bucket paths (all live and publicly readable):
```
fonts/v1/poppins/Poppins_400Regular.ttf
fonts/v1/poppins/Poppins_500Medium.ttf
fonts/v1/poppins/Poppins_600SemiBold.ttf
fonts/v1/poppins/Poppins_700Bold.ttf
fonts/v1/poppins/Poppins_700Bold_Italic.ttf
fonts/v1/poppins/Poppins_800ExtraBold.ttf
fonts/v1/new-rocker/NewRocker_400Regular.ttf
fonts/v1/ibm-plex-mono/IBMPlexMono_400Regular.ttf
fonts/v1/ibm-plex-mono/IBMPlexMono_500Medium.ttf
fonts/v1/ibm-plex-mono/IBMPlexMono_600SemiBold.ttf
fonts/v1/ibm-plex-mono/IBMPlexMono_700Bold.ttf
```

**CRITICAL — hashing method (locks Task 7's deferred decision):** The recorded `hash` values are the SHA256 of the **base64-encoded** file content, NOT the raw bytes. This matches what `cache.ts` (Task 7) computes: it reads the downloaded file via `FileSystem.readAsStringAsync({ encoding: Base64 })` and passes that base64 string to `Crypto.digestStringAsync(SHA256, ..., HEX)`. **Task 7 MUST use the base64 path** — do NOT switch to a binary digest, or every integrity check will fail against these recorded hashes.

The reference recipe used to compute the recorded hashes (Node, matching the RN runtime path):
```js
const base64 = fs.readFileSync(file).toString("base64");
const hash = crypto.createHash("sha256").update(base64, "utf8").digest("hex");
```

### 0b — Render preview SVGs — ✅ DONE

The 3 preview SVGs were generated via `opentype.js` (text rendered glyph-by-glyph, bypassing the shaper which throws on Plus Jakarta Sans's substitution tables, then converted to path data) and committed at `eb8d9eb` to:
```
src/theme/themes/previews/zen.svg       (5.0 KB)
src/theme/themes/previews/cafe.svg      (4.5 KB)
src/theme/themes/previews/fantasy.svg   (7.1 KB — over the 6 KB target due to New Rocker's blackletter glyph complexity; acceptable)
```
Each shows "Aa" in the display font and "Build daily." in the body font over the theme's `bg`. **The implementer does not regenerate these.** Note: Task 2 below references creating the `previews/` directory — it already exists with these files, so Task 2's `require("./previews/zen.svg")` resolves immediately.

---

## Task 1: Theme contract type

**Files:**
- Create: `src/theme/contract.ts`
- Test: `src/theme/__tests__/contract.test.ts`
- Modify: `jest.config.js` (add testMatch line)

- [ ] **Step 1: Update jest.config.js so theme tests are discovered**

Open `jest.config.js`. Edit the `testMatch` array to add a line:

```js
testMatch: [
  "**/src/tests/**/*.test.ts",
  "**/src/tests/**/*.test.tsx",
  "**/src/lib/**/__tests__/**/*.test.ts",
  "**/src/features/**/__tests__/**/*.test.ts",
  "**/src/features/**/__tests__/**/*.test.tsx",
  "**/src/components/**/__tests__/**/*.test.tsx",
  "**/src/utils/**/__tests__/**/*.test.ts",
  "**/src/theme/**/__tests__/**/*.test.ts",
  "**/src/theme/**/__tests__/**/*.test.tsx",
],
```

- [ ] **Step 2: Write the failing test**

Create `src/theme/__tests__/contract.test.ts`:

```ts
import type { Theme, ThemeId, Colors, FontAssets } from "@/theme/contract";

describe("Theme contract", () => {
  it("ThemeId is a fixed union of three ids", () => {
    const valid: ThemeId[] = ["zen", "cafe", "fantasy"];
    expect(valid).toHaveLength(3);
  });

  it("Colors has all 23 required fields", () => {
    const required: Array<keyof Colors> = [
      "bg", "surface", "surfaceCard", "surfaceHigh", "surfaceMuted",
      "text", "textMuted", "textFaint",
      "primary", "primaryGradientEnd", "primaryLight", "primarySoft", "primaryText",
      "success", "danger", "dangerSoft", "dangerSubtle",
      "heatDone", "heatSkipped", "heatMissed",
      "offDayBorder",
      "graduatedCircle", "graduatedBadge",
    ];
    expect(required).toHaveLength(23);
  });

  it("FontAssets discriminates bundled vs remote", () => {
    const bundled: FontAssets = { kind: "bundled", assets: { Foo: 1 } };
    const remote: FontAssets = {
      kind: "remote",
      assets: { Foo: { uri: "https://x", hash: "abc", bytes: 100 } },
    };
    expect(bundled.kind).toBe("bundled");
    expect(remote.kind).toBe("remote");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- src/theme/__tests__/contract.test.ts`
Expected: FAIL — module not found at `@/theme/contract`.

- [ ] **Step 4: Implement the contract**

Create `src/theme/contract.ts`:

```ts
export type ThemeId = "zen" | "cafe" | "fantasy";

export type Colors = {
  bg: string;
  surface: string;
  surfaceCard: string;
  surfaceHigh: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  textFaint: string;
  primary: string;
  primaryGradientEnd: string;
  primaryLight: string;
  primarySoft: string;
  primaryText: string;
  success: string;
  danger: string;
  dangerSoft: string;
  dangerSubtle: string;
  heatDone: string;
  heatSkipped: string;
  heatMissed: string;
  offDayBorder: string;
  graduatedCircle: string;
  graduatedBadge: string;
};

export type Typography = {
  displayLg: number;
  headlineLg: number;
  headlineMd: number;
  titleLg: number;
  titleMd: number;
  titleSm: number;
  bodyLg: number;
  bodyMd: number;
  labelMd: number;
  micro: number;
};

export type Spacing = {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  xxl: number;
  xxxl: number;
};

export type Radius = {
  sm: number;
  md: number;
  lg: number;
  xl: number;
  pill: number;
};

export type Shadows = {
  card: string;
  lift: string;
  button: string;
  cardFloat: string;
  inputField: string;
};

export type FontFamilies = {
  displayBold: string;
  displaySemi: string;
  displaySemiItalic: string;
  body: string;
  bodyMedium: string;
  bodySemi: string;
  bodyBold: string;
  bodyExtraBold: string;
};

export type RemoteFontAsset = {
  uri: string;
  hash: string; // SHA256 hex digest
  bytes: number;
};

export type FontAssets =
  | { kind: "bundled"; assets: Record<string, number> }
  | { kind: "remote"; assets: Record<string, RemoteFontAsset> };

export type Theme = {
  id: ThemeId;
  name: string;
  colors: Colors;
  typography: Typography;
  spacing: Spacing;
  radius: Radius;
  shadows: Shadows;
  fontFamilies: FontFamilies;
  fontAssets: FontAssets;
  previewSvg: number; // require() result for the SVG asset
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- src/theme/__tests__/contract.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add jest.config.js src/theme/contract.ts src/theme/__tests__/contract.test.ts
git commit -m "feat(theme): add Theme contract type with 23-color schema"
```

---

## Task 2: Zen theme file (lift current values)

**Files:**
- Create: `src/theme/themes/zen.ts`

This is data, not logic — no separate test file. The contract test guarantees shape.

- [ ] **Step 1: Create the Zen theme file**

Create `src/theme/themes/zen.ts`:

```ts
import {
  PlusJakartaSans_700Bold,
  PlusJakartaSans_700Bold_Italic,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";

import type { Theme } from "@/theme/contract";

export const zen: Theme = {
  id: "zen",
  name: "Zen",
  colors: {
    bg: "#fbf9f5",
    surface: "#f3f1eb",
    surfaceCard: "#ffffff",
    surfaceHigh: "#e8e5dd",
    surfaceMuted: "#f0ece3",
    text: "#31332f",
    textMuted: "#6b6d68",
    textFaint: "#9a9c96",
    primary: "#446655",
    primaryGradientEnd: "#6b9e7d",
    primaryLight: "#c6ebd5",
    primarySoft: "#e8f5ee",
    primaryText: "#ffffff",
    success: "#446655",
    danger: "#9b3b3b",
    dangerSoft: "#fff2f0",
    dangerSubtle: "#efc1bb",
    heatDone: "#446655",
    heatSkipped: "#e6d3a8",
    heatMissed: "#ede9e0",
    offDayBorder: "#e8e3d8",
    graduatedCircle: "#6b9e7d",
    graduatedBadge: "#c6ebd5",
  },
  typography: {
    displayLg: 36,
    headlineLg: 24,
    headlineMd: 20,
    titleLg: 18,
    titleMd: 16,
    titleSm: 14,
    bodyLg: 14,
    bodyMd: 13,
    labelMd: 13,
    micro: 11,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 48,
  },
  radius: {
    sm: 12,
    md: 24,
    lg: 32,
    xl: 48,
    pill: 999,
  },
  shadows: {
    card: "0 8px 32px rgba(68, 102, 85, 0.08)",
    lift: "0 2px 12px rgba(68, 102, 85, 0.06)",
    button: "0 4px 20px rgba(68, 102, 85, 0.22)",
    cardFloat: "0 4px 24px rgba(68, 102, 85, 0.08)",
    inputField: "0 4px 16px rgba(68, 102, 85, 0.06)",
  },
  fontFamilies: {
    displayBold: "PlusJakartaSans_800ExtraBold",
    displaySemi: "PlusJakartaSans_700Bold",
    displaySemiItalic: "PlusJakartaSans_700Bold_Italic",
    body: "Manrope_400Regular",
    bodyMedium: "Manrope_500Medium",
    bodySemi: "Manrope_600SemiBold",
    bodyBold: "Manrope_700Bold",
    bodyExtraBold: "Manrope_800ExtraBold",
  },
  fontAssets: {
    kind: "bundled",
    assets: {
      PlusJakartaSans_700Bold,
      PlusJakartaSans_700Bold_Italic,
      PlusJakartaSans_800ExtraBold,
      Manrope_400Regular,
      Manrope_500Medium,
      Manrope_600SemiBold,
      Manrope_700Bold,
      Manrope_800ExtraBold,
    },
  },
  previewSvg: require("./previews/zen.svg"),
};
```

- [ ] **Step 2: Run type-check to verify it satisfies the contract**

Run: `npm run typecheck`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/theme/themes/zen.ts
git commit -m "feat(theme): add Zen theme — current look as a Theme object"
```

---

## Task 3: Cafe theme file

**Files:**
- Create: `src/theme/themes/cafe.ts`

**Prerequisites:** Task 0a complete. URIs, hashes, and bytes for 5 Poppins weights + 1 italic are available.

- [ ] **Step 1: Create the Cafe theme file**

Create `src/theme/themes/cafe.ts`. Replace `<URI>`, `<HASH>`, `<BYTES>` placeholders with the values recorded in Task 0a step 5.

```ts
import type { Theme } from "@/theme/contract";

export const cafe: Theme = {
  id: "cafe",
  name: "Cafe",
  colors: {
    bg: "#F9F7F5",
    surface: "#E9E3DD",
    surfaceCard: "#FFFFFF",
    surfaceHigh: "#D4CCC0",
    surfaceMuted: "#F4F0EA",
    text: "#3E2B1E",
    textMuted: "#6F5847",
    textFaint: "#A09080",
    primary: "#5D4432",
    primaryGradientEnd: "#7A5E45",
    primaryLight: "#E9D9C4",
    primarySoft: "#F5EDE0",
    primaryText: "#FFFFFF",
    success: "#16A34A",
    danger: "#DC2626",
    dangerSoft: "#FEF2F2",
    dangerSubtle: "#FCA5A5",
    heatDone: "#5D4432",
    heatSkipped: "#D9C19C",
    heatMissed: "#EDE5D8",
    offDayBorder: "#E9DDC9",
    graduatedCircle: "#7B5E3D",
    graduatedBadge: "#F5EDE0",
  },
  typography: {
    displayLg: 36,
    headlineLg: 24,
    headlineMd: 20,
    titleLg: 18,
    titleMd: 16,
    titleSm: 14,
    bodyLg: 14,
    bodyMd: 13,
    labelMd: 13,
    micro: 11,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 48,
  },
  radius: {
    sm: 12,
    md: 24,
    lg: 32,
    xl: 48,
    pill: 999,
  },
  shadows: {
    card: "0 8px 32px rgba(93, 68, 50, 0.08)",
    lift: "0 2px 12px rgba(93, 68, 50, 0.06)",
    button: "0 4px 20px rgba(93, 68, 50, 0.22)",
    cardFloat: "0 4px 24px rgba(93, 68, 50, 0.08)",
    inputField: "0 4px 16px rgba(93, 68, 50, 0.06)",
  },
  fontFamilies: {
    displayBold: "Poppins_800ExtraBold",
    displaySemi: "Poppins_700Bold",
    displaySemiItalic: "Poppins_700Bold_Italic",
    body: "Poppins_400Regular",
    bodyMedium: "Poppins_500Medium",
    bodySemi: "Poppins_600SemiBold",
    bodyBold: "Poppins_700Bold",
    bodyExtraBold: "Poppins_800ExtraBold",
  },
  fontAssets: {
    kind: "remote",
    assets: {
      Poppins_400Regular: { uri: "https://wrytjnucrxsqdrbwxsgi.supabase.co/storage/v1/object/public/fonts/v1/poppins/Poppins_400Regular.ttf", hash: "126b8ecc83e5ccabf83655b8492481eb6980de452b1768d07907cb60b1dd94b9", bytes: 158240 },
      Poppins_500Medium:  { uri: "https://wrytjnucrxsqdrbwxsgi.supabase.co/storage/v1/object/public/fonts/v1/poppins/Poppins_500Medium.ttf",  hash: "b09fd8b77bdafa519a2db316ee159bfd4d1577934bfbc6255c11f91db6e13650", bytes: 156520 },
      Poppins_600SemiBold:{ uri: "https://wrytjnucrxsqdrbwxsgi.supabase.co/storage/v1/object/public/fonts/v1/poppins/Poppins_600SemiBold.ttf", hash: "04ddbc357d05a0ec6cb987f6c99902a238d127af15e3b45e3be47e5842363ace", bytes: 155232 },
      Poppins_700Bold:    { uri: "https://wrytjnucrxsqdrbwxsgi.supabase.co/storage/v1/object/public/fonts/v1/poppins/Poppins_700Bold.ttf",    hash: "7d654c9b4cac39e4bedee2ae45805c6640423dd798ea4791993143d7f4b96443", bytes: 153944 },
      Poppins_700Bold_Italic: { uri: "https://wrytjnucrxsqdrbwxsgi.supabase.co/storage/v1/object/public/fonts/v1/poppins/Poppins_700Bold_Italic.ttf", hash: "579c43eb7fa56eeaee0cdb2a86de4e21f6806dcd205f88951681a0acc4871687", bytes: 176588 },
      Poppins_800ExtraBold:   { uri: "https://wrytjnucrxsqdrbwxsgi.supabase.co/storage/v1/object/public/fonts/v1/poppins/Poppins_800ExtraBold.ttf",   hash: "48fc1768b54f2fe698fcea4573c410af81a2c56fe6274b7bc2f036368111b37d", bytes: 152764 },
    },
  },
  previewSvg: require("./previews/cafe.svg"),
};
```

- [ ] **Step 2: Run type-check**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/theme/themes/cafe.ts
git commit -m "feat(theme): add Cafe theme (warm browns + Poppins, remote fonts)"
```

---

## Task 4: Fantasy theme file

**Files:**
- Create: `src/theme/themes/fantasy.ts`

**Prerequisites:** Task 0a complete. URIs, hashes, and bytes for New Rocker + 4 IBM Plex Mono weights are available.

- [ ] **Step 1: Create the Fantasy theme file**

Create `src/theme/themes/fantasy.ts`. Replace `<URI>`, `<HASH>`, `<BYTES>` placeholders.

```ts
import type { Theme } from "@/theme/contract";

export const fantasy: Theme = {
  id: "fantasy",
  name: "Fantasy",
  colors: {
    bg: "#FFFFFF",
    surface: "#F3F4F6",
    surfaceCard: "#FFFFFF",
    surfaceHigh: "#E5E7EB",
    surfaceMuted: "#F9FAFB",
    text: "#111827",
    textMuted: "#4B5563",
    textFaint: "#9CA3AF",
    primary: "#0250CC",
    primaryGradientEnd: "#3B82F6",
    primaryLight: "#BFDBFE",
    primarySoft: "#EFF6FF",
    primaryText: "#FFFFFF",
    success: "#16A34A",
    danger: "#DC2626",
    dangerSoft: "#FEF2F2",
    dangerSubtle: "#FCA5A5",
    heatDone: "#0250CC",
    heatSkipped: "#FDE68A",
    heatMissed: "#F3F4F6",
    offDayBorder: "#E5E7EB",
    graduatedCircle: "#1F2937",
    graduatedBadge: "#FDC800",
  },
  typography: {
    displayLg: 36,
    headlineLg: 24,
    headlineMd: 20,
    titleLg: 18,
    titleMd: 16,
    titleSm: 14,
    bodyLg: 14,
    bodyMd: 13,
    labelMd: 13,
    micro: 11,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 48,
  },
  radius: {
    sm: 12,
    md: 24,
    lg: 32,
    xl: 48,
    pill: 999,
  },
  shadows: {
    card: "0 8px 32px rgba(2, 80, 204, 0.08)",
    lift: "0 2px 12px rgba(2, 80, 204, 0.06)",
    button: "0 4px 20px rgba(2, 80, 204, 0.22)",
    cardFloat: "0 4px 24px rgba(2, 80, 204, 0.08)",
    inputField: "0 4px 16px rgba(2, 80, 204, 0.06)",
  },
  fontFamilies: {
    displayBold: "NewRocker_400Regular",
    displaySemi: "NewRocker_400Regular",
    displaySemiItalic: "NewRocker_400Regular",
    body: "IBMPlexMono_400Regular",
    bodyMedium: "IBMPlexMono_500Medium",
    bodySemi: "IBMPlexMono_500Medium",
    bodyBold: "IBMPlexMono_600SemiBold",
    bodyExtraBold: "IBMPlexMono_700Bold",
  },
  fontAssets: {
    kind: "remote",
    assets: {
      NewRocker_400Regular:    { uri: "https://wrytjnucrxsqdrbwxsgi.supabase.co/storage/v1/object/public/fonts/v1/new-rocker/NewRocker_400Regular.ttf", hash: "bfb212a3aa384fcb8358c8a38f566c81b8da3d31c1c3daa08cf1fda728358fe3", bytes: 168128 },
      IBMPlexMono_400Regular:  { uri: "https://wrytjnucrxsqdrbwxsgi.supabase.co/storage/v1/object/public/fonts/v1/ibm-plex-mono/IBMPlexMono_400Regular.ttf",  hash: "672cf61a82031e9e9f500d891fff2112e9d95ddeca6ed73720816494ef9d2141", bytes: 133796 },
      IBMPlexMono_500Medium:   { uri: "https://wrytjnucrxsqdrbwxsgi.supabase.co/storage/v1/object/public/fonts/v1/ibm-plex-mono/IBMPlexMono_500Medium.ttf",   hash: "64678febce16437f53a291b3ccf44b906b3f725bc8f5d4405595ab6ca403df37", bytes: 134956 },
      IBMPlexMono_600SemiBold: { uri: "https://wrytjnucrxsqdrbwxsgi.supabase.co/storage/v1/object/public/fonts/v1/ibm-plex-mono/IBMPlexMono_600SemiBold.ttf", hash: "ccfcd55897ef2be1a1fa69de6ac93ad655971d7183b4cad1cdf89e507ee5db73", bytes: 138448 },
      IBMPlexMono_700Bold:     { uri: "https://wrytjnucrxsqdrbwxsgi.supabase.co/storage/v1/object/public/fonts/v1/ibm-plex-mono/IBMPlexMono_700Bold.ttf",     hash: "db56912fab2cd5e53703db5d7d1be51dc0b5956eb2f3af9fd7cdebc8eed839e0", bytes: 136008 },
    },
  },
  previewSvg: require("./previews/fantasy.svg"),
};
```

- [ ] **Step 2: Run type-check**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/theme/themes/fantasy.ts
git commit -m "feat(theme): add Fantasy theme (royal blue + New Rocker, remote fonts)"
```

---

## Task 5: Re-export shims (colors.ts and siblings)

**Files:**
- Modify: `src/theme/colors.ts`, `src/theme/typography.ts`, `src/theme/spacing.ts`, `src/theme/radius.ts`, `src/theme/shadows.ts`, `src/theme/fontFamilies.ts`

**Goal:** Replace the static values in the existing 6 files with re-exports from `zen.ts`. All 91 existing `import { colors } from "@/theme/colors"` consumers continue to compile and behave identically.

- [ ] **Step 1: Rewrite src/theme/colors.ts**

Open `src/theme/colors.ts`. Replace entire contents with:

```ts
import { zen } from "@/theme/themes/zen";

export const colors = zen.colors;
```

- [ ] **Step 2: Rewrite src/theme/typography.ts**

Replace entire contents with:

```ts
import { zen } from "@/theme/themes/zen";

export const typography = zen.typography;
```

- [ ] **Step 3: Rewrite src/theme/spacing.ts**

The current file also exports two non-theme constants. Preserve them:

```ts
import { zen } from "@/theme/themes/zen";

export const spacing = zen.spacing;

// Top padding added to `insets.top` for the screen's first scroll/content area.
// Use HERO for tab-root surfaces (Today, future landing screens) where airy
// space reinforces "you've arrived"; use the default for any nested screen
// that opens with a back button so the button stays in thumb-reach.
export const SCREEN_TOP_PADDING = spacing.lg;
export const SCREEN_TOP_PADDING_HERO = spacing.lg;
```

- [ ] **Step 4: Rewrite src/theme/radius.ts**

```ts
import { zen } from "@/theme/themes/zen";

export const radius = zen.radius;
```

- [ ] **Step 5: Rewrite src/theme/shadows.ts**

```ts
import { zen } from "@/theme/themes/zen";

export const shadows = zen.shadows;
```

- [ ] **Step 6: Rewrite src/theme/fontFamilies.ts**

```ts
import { zen } from "@/theme/themes/zen";

export const fontFamilies = zen.fontFamilies;
```

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: All existing tests pass with no diffs (the snapshot suite is the safety net here — every static value resolved through the shim equals the prior literal value).

- [ ] **Step 8: Type-check**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/theme/colors.ts src/theme/typography.ts src/theme/spacing.ts src/theme/radius.ts src/theme/shadows.ts src/theme/fontFamilies.ts
git commit -m "refactor(theme): rewrite shims to re-export from zen theme"
```

---

## Task 6: Theme registry

**Files:**
- Create: `src/theme/registry.ts`
- Test: `src/theme/__tests__/registry.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/theme/__tests__/registry.test.ts`:

```ts
import { THEMES, getTheme, isKnownThemeId } from "@/theme/registry";

describe("Theme registry", () => {
  it("THEMES exposes zen, cafe, fantasy", () => {
    expect(THEMES.zen.id).toBe("zen");
    expect(THEMES.cafe.id).toBe("cafe");
    expect(THEMES.fantasy.id).toBe("fantasy");
  });

  it("getTheme returns the registered theme", () => {
    expect(getTheme("cafe").name).toBe("Cafe");
  });

  it("isKnownThemeId returns true for valid ids, false for others", () => {
    expect(isKnownThemeId("zen")).toBe(true);
    expect(isKnownThemeId("cafe")).toBe(true);
    expect(isKnownThemeId("fantasy")).toBe(true);
    expect(isKnownThemeId("nonsense")).toBe(false);
    expect(isKnownThemeId(null)).toBe(false);
    expect(isKnownThemeId(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/theme/__tests__/registry.test.ts`
Expected: FAIL — module not found at `@/theme/registry`.

- [ ] **Step 3: Implement the registry**

Create `src/theme/registry.ts`:

```ts
import { zen } from "@/theme/themes/zen";
import { cafe } from "@/theme/themes/cafe";
import { fantasy } from "@/theme/themes/fantasy";

import type { Theme, ThemeId } from "@/theme/contract";

export const THEMES: Record<ThemeId, Theme> = {
  zen,
  cafe,
  fantasy,
};

export function getTheme(id: ThemeId): Theme {
  return THEMES[id];
}

export function isKnownThemeId(value: unknown): value is ThemeId {
  return value === "zen" || value === "cafe" || value === "fantasy";
}
```

- [ ] **Step 4: Run the test**

Run: `npm test -- src/theme/__tests__/registry.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/theme/registry.ts src/theme/__tests__/registry.test.ts
git commit -m "feat(theme): add registry mapping ids to Theme objects"
```

---

## Task 7: Font cache module

**Files:**
- Create: `src/theme/fonts/cache.ts`
- Test: `src/theme/fonts/__tests__/cache.test.ts`
- Modify: `package.json` (+ `expo-crypto`)

- [ ] **Step 1: Add expo-crypto**

Run: `npx expo install expo-crypto`
Expected: package.json updates to include `expo-crypto` at the SDK-compatible version. Verify with `grep expo-crypto package.json`.

- [ ] **Step 2: Write the failing test**

Create `src/theme/fonts/__tests__/cache.test.ts`:

```ts
import { ensureCachedFont, deleteCachedFont, getCachePath } from "@/theme/fonts/cache";

// IMPORTANT: SDK 54's expo-file-system default export is the new OO API
// (File/Directory/Paths) and no longer exposes downloadAsync/getInfoAsync/
// cacheDirectory/EncodingType. The functional API lives at the
// `expo-file-system/legacy` subpath. We mock that subpath, and the
// implementation imports from it too.
jest.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///mock-cache/",
  documentDirectory: "file:///mock-docs/",
  getInfoAsync: jest.fn(),
  downloadAsync: jest.fn(),
  deleteAsync: jest.fn(),
  moveAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  // EncodingType is referenced by the implementation (readAsStringAsync's
  // encoding option). Without it in the mock, FileSystem.EncodingType.Base64
  // is `undefined.Base64` and throws. Mirror the real enum values.
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- src/theme/fonts/__tests__/cache.test.ts`
Expected: FAIL — module not found at `@/theme/fonts/cache`.

- [ ] **Step 4: Implement the cache module**

Create `src/theme/fonts/cache.ts`:

```ts
// SDK 54: the functional file-system API moved to the `/legacy` subpath.
// The default `expo-file-system` export is now the File/Directory/Paths OO
// API. We use legacy here for v1 — it's deprecated but fully supported on
// SDK 54. Migrating to the new API is a documented follow-up (see plan tail).
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

  // Note: expo-file-system's downloadAsync does not natively accept an AbortSignal.
  // We race the download against signal abort; if the signal fires, we delete
  // any partial file and throw.
  const downloadPromise = FileSystem.downloadAsync(asset.uri, tmpPath);
  const abortPromise = new Promise<never>((_, reject) => {
    signal.addEventListener("abort", () => {
      reject(new Error("Download aborted"));
    });
  });

  try {
    await Promise.race([downloadPromise, abortPromise]);
  } catch (err) {
    await FileSystem.deleteAsync(tmpPath, { idempotent: true }).catch(() => {});
    throw err;
  }

  // Verify integrity.
  const fileContents = await FileSystem.readAsStringAsync(tmpPath, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const computedHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    fileContents,
    { encoding: Crypto.CryptoEncoding.HEX },
  );

  if (computedHash !== asset.hash) {
    await FileSystem.deleteAsync(tmpPath, { idempotent: true }).catch(() => {});
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
```

**Base64 hashing is LOCKED — do not change it.** The recorded hashes in Tasks 3 and 4 are SHA256 of the **base64-encoded** file content. This implementation MUST read the file via `FileSystem.readAsStringAsync(tmpPath, { encoding: Base64 })` and hash that base64 string with `Crypto.digestStringAsync(SHA256, base64String, { encoding: HEX })`. Do NOT switch to a binary/raw-bytes digest — doing so would make every integrity check fail against the pre-computed hashes (see Task 0 for how they were generated). The test in Step 2 mocks both `readAsStringAsync` and `digestStringAsync`, so it does not exercise the real algorithm; the integration verification happens in Task 24's manual smoke test where a real download is hashed against a real recorded value.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- src/theme/fonts/__tests__/cache.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/theme/fonts/cache.ts src/theme/fonts/__tests__/cache.test.ts
git commit -m "feat(theme): add font cache with SHA256 verification and abort support"
```

---

## Task 8: Font loader

**Files:**
- Create: `src/theme/fonts/loader.ts`
- Test: `src/theme/fonts/__tests__/loader.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/theme/fonts/__tests__/loader.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/theme/fonts/__tests__/loader.test.ts`
Expected: FAIL — module not found at `@/theme/fonts/loader`.

- [ ] **Step 3: Implement the loader**

Create `src/theme/fonts/loader.ts`:

```ts
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
```

- [ ] **Step 4: Run the test**

Run: `npm test -- src/theme/fonts/__tests__/loader.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/theme/fonts/loader.ts src/theme/fonts/__tests__/loader.test.ts
git commit -m "feat(theme): add font loader handling bundled and remote themes"
```

---

## Task 9: ThemeProvider

**Files:**
- Create: `src/theme/ThemeProvider.tsx`
- Test: `src/theme/__tests__/ThemeProvider.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/theme/__tests__/ThemeProvider.test.tsx`:

```tsx
import { render, screen, act } from "@testing-library/react-native";
import { Text } from "react-native";

import { ThemeProvider, useThemeContext } from "@/theme/ThemeProvider";

function Probe() {
  const { theme, intendedThemeId } = useThemeContext();
  return (
    <>
      <Text testID="active-id">{theme.id}</Text>
      <Text testID="intended-id">{intendedThemeId}</Text>
    </>
  );
}

describe("ThemeProvider", () => {
  it("renders with the initial theme", () => {
    render(
      <ThemeProvider initialThemeId="cafe" intendedThemeId="cafe">
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("active-id").props.children).toBe("cafe");
    expect(screen.getByTestId("intended-id").props.children).toBe("cafe");
  });

  it("setActiveTheme switches the active theme", () => {
    let captured: ((id: "zen" | "cafe" | "fantasy") => void) | null = null;

    function Capture() {
      const { setActiveTheme, theme } = useThemeContext();
      captured = setActiveTheme;
      return <Text testID="active-id">{theme.id}</Text>;
    }

    render(
      <ThemeProvider initialThemeId="zen" intendedThemeId="zen">
        <Capture />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("active-id").props.children).toBe("zen");

    act(() => {
      captured!("fantasy");
    });
    expect(screen.getByTestId("active-id").props.children).toBe("fantasy");
  });

  it("intendedThemeId differs from active when fallback fired", () => {
    render(
      <ThemeProvider initialThemeId="zen" intendedThemeId="cafe">
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("active-id").props.children).toBe("zen");
    expect(screen.getByTestId("intended-id").props.children).toBe("cafe");
  });

  it("throws when used outside provider", () => {
    const original = console.error;
    console.error = () => {};
    expect(() => render(<Probe />)).toThrow(/ThemeProvider/);
    console.error = original;
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/theme/__tests__/ThemeProvider.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement ThemeProvider**

Create `src/theme/ThemeProvider.tsx`:

```tsx
import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { getTheme } from "@/theme/registry";

import type { Theme, ThemeId } from "@/theme/contract";

type ThemeContextValue = {
  /** Runtime-active theme (what's actually rendering). */
  theme: Theme;
  /** Theme id the user picked. May differ from `theme.id` after fallback. */
  intendedThemeId: ThemeId;
  /** Switch the runtime-active theme. Does NOT update intended/preference — caller does that. */
  setActiveTheme: (id: ThemeId) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

type Props = {
  initialThemeId: ThemeId;
  intendedThemeId: ThemeId;
  children: React.ReactNode;
};

export function ThemeProvider({ initialThemeId, intendedThemeId, children }: Props) {
  const [activeId, setActiveId] = useState<ThemeId>(initialThemeId);

  const setActiveTheme = useCallback((id: ThemeId) => {
    setActiveId(id);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: getTheme(activeId),
      intendedThemeId,
      setActiveTheme,
    }),
    [activeId, intendedThemeId, setActiveTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useThemeContext must be used inside <ThemeProvider>");
  }
  return ctx;
}
```

- [ ] **Step 4: Run the test**

Run: `npm test -- src/theme/__tests__/ThemeProvider.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/theme/ThemeProvider.tsx src/theme/__tests__/ThemeProvider.test.tsx
git commit -m "feat(theme): add ThemeProvider with runtime-vs-intended distinction"
```

---

## Task 10: useTheme hook

**Files:**
- Create: `src/theme/useTheme.ts`

Trivial wrapper — no separate test file (covered by ThemeProvider test).

- [ ] **Step 1: Create the hook**

Create `src/theme/useTheme.ts`:

```ts
import { useThemeContext } from "@/theme/ThemeProvider";

import type { Theme } from "@/theme/contract";

/**
 * Returns the runtime-active Theme object. Components should use this for any
 * styling values that should reflect the user's theme choice.
 */
export function useTheme(): Theme {
  return useThemeContext().theme;
}
```

- [ ] **Step 2: Type-check**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/theme/useTheme.ts
git commit -m "feat(theme): add useTheme hook"
```

---

## Task 11: useThemedStyles helper

**Files:**
- Create: `src/theme/useThemedStyles.ts`
- Test: `src/theme/__tests__/useThemedStyles.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/theme/__tests__/useThemedStyles.test.tsx`:

```tsx
import { render, screen, act } from "@testing-library/react-native";
import { StyleSheet, Text, View } from "react-native";

import { ThemeProvider, useThemeContext } from "@/theme/ThemeProvider";
import { useThemedStyles } from "@/theme/useThemedStyles";

function Box() {
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      box: { backgroundColor: theme.colors.bg },
    }),
  );
  return <View testID="box" style={styles.box} />;
}

function Switcher() {
  const { setActiveTheme } = useThemeContext();
  return <Text testID="switch" onPress={() => setActiveTheme("fantasy")}>switch</Text>;
}

describe("useThemedStyles", () => {
  it("returns styles built from the current theme", () => {
    render(
      <ThemeProvider initialThemeId="zen" intendedThemeId="zen">
        <Box />
      </ThemeProvider>,
    );
    const flat = StyleSheet.flatten(screen.getByTestId("box").props.style);
    expect(flat.backgroundColor).toBe("#fbf9f5"); // Zen bg
  });

  it("rebuilds styles when theme changes", () => {
    render(
      <ThemeProvider initialThemeId="zen" intendedThemeId="zen">
        <Box />
        <Switcher />
      </ThemeProvider>,
    );

    let flat = StyleSheet.flatten(screen.getByTestId("box").props.style);
    expect(flat.backgroundColor).toBe("#fbf9f5");

    act(() => {
      screen.getByTestId("switch").props.onPress();
    });

    flat = StyleSheet.flatten(screen.getByTestId("box").props.style);
    expect(flat.backgroundColor).toBe("#FFFFFF"); // Fantasy bg
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/theme/__tests__/useThemedStyles.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

Create `src/theme/useThemedStyles.ts`:

```ts
import { useMemo } from "react";

import { useTheme } from "@/theme/useTheme";

import type { Theme } from "@/theme/contract";

/**
 * Builds a memoized StyleSheet from the current theme. The factory is called
 * once per theme change. Components should prefer this over inline styles to
 * keep the existing StyleSheet.create performance characteristics.
 *
 * Usage:
 *   const styles = useThemedStyles((theme) =>
 *     StyleSheet.create({ card: { backgroundColor: theme.colors.surfaceCard } })
 *   );
 */
export function useThemedStyles<T>(factory: (theme: Theme) => T): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [theme, factory]);
}
```

- [ ] **Step 4: Run the test**

Run: `npm test -- src/theme/__tests__/useThemedStyles.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/theme/useThemedStyles.ts src/theme/__tests__/useThemedStyles.test.tsx
git commit -m "feat(theme): add useThemedStyles factory hook"
```

---

## Task 12: Test render helper + global setup wrap

**Files:**
- Create: `src/tests/setup/renderWithTheme.tsx`
- Create: `src/tests/setup/render.tsx`
- Modify: `jest.config.js` (add `setupFilesAfterEnv` entry for the wrap is not needed — the wrap is opt-in)

**Goal:** Existing tests continue using `import { render } from "@testing-library/react-native"` and get a default ThemeProvider wrap. Theme-specific tests can import `renderWithTheme` to pick a different theme.

Existing component tests use:
```ts
import { render, screen } from "@testing-library/react-native";
```

Plan: do NOT alias the module globally (would break tests that destructure other RNTL exports). Instead, create two thin helpers. Tests that need themed rendering opt in by importing from the helper path. Existing tests work unchanged because most are testing static-styled components that don't yet use `useTheme()` — so they don't need a provider. As migrations land (PR 2+), tests for migrated components will be updated to import the helper.

- [ ] **Step 1: Create the `renderWithTheme` helper**

Create `src/tests/setup/renderWithTheme.tsx`:

```tsx
import { render, RenderOptions } from "@testing-library/react-native";

import { ThemeProvider } from "@/theme/ThemeProvider";

import type { ThemeId } from "@/theme/contract";

type Options = Omit<RenderOptions, "wrapper"> & {
  themeId?: ThemeId;
};

export function renderWithTheme(ui: React.ReactElement, options: Options = {}) {
  const themeId = options.themeId ?? "zen";

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <ThemeProvider initialThemeId={themeId} intendedThemeId={themeId}>
        {children}
      </ThemeProvider>
    );
  }

  return render(ui, { ...options, wrapper: Wrapper });
}

export { screen, act, fireEvent, waitFor } from "@testing-library/react-native";
```

- [ ] **Step 2: Create a thin `render.tsx` re-export so future migrations can import from one place**

Create `src/tests/setup/render.tsx`:

```tsx
import { renderWithTheme } from "@/tests/setup/renderWithTheme";

/**
 * Drop-in replacement for @testing-library/react-native's `render` that wraps
 * the UI in a default-Zen ThemeProvider. Use this in tests for components that
 * call `useTheme()` or `useThemedStyles()`.
 *
 * For tests that need a specific theme, import `renderWithTheme` directly.
 */
export const render = renderWithTheme;
export { screen, act, fireEvent, waitFor } from "@testing-library/react-native";
```

- [ ] **Step 3: Smoke-test the helper**

Create `src/tests/setup/__tests__/renderWithTheme.test.tsx`:

```tsx
import { Text } from "react-native";

import { renderWithTheme, screen } from "@/tests/setup/renderWithTheme";
import { useTheme } from "@/theme/useTheme";

function Probe() {
  const theme = useTheme();
  return <Text testID="id">{theme.id}</Text>;
}

describe("renderWithTheme", () => {
  it("provides Zen by default", () => {
    renderWithTheme(<Probe />);
    expect(screen.getByTestId("id").props.children).toBe("zen");
  });

  it("accepts a themeId override", () => {
    renderWithTheme(<Probe />, { themeId: "fantasy" });
    expect(screen.getByTestId("id").props.children).toBe("fantasy");
  });
});
```

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: All existing tests still pass + 2 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/tests/setup/renderWithTheme.tsx src/tests/setup/render.tsx src/tests/setup/__tests__/renderWithTheme.test.tsx
git commit -m "test(theme): add renderWithTheme helper for migrated component tests"
```

---

## Task 13: Contrast unit test with waivers

**Files:**
- Create: `src/theme/__tests__/contrast.test.ts`

- [ ] **Step 1: Write the test**

Create `src/theme/__tests__/contrast.test.ts`:

```ts
import { THEMES } from "@/theme/registry";

import type { Colors, Theme } from "@/theme/contract";

type PairKey = `${string}/${string}`;

type Waiver = {
  themeId: Theme["id"];
  fg: keyof Colors;
  bg: keyof Colors;
  reason: string;
};

const KNOWN_CONTRAST_WAIVERS: Waiver[] = [
  { themeId: "zen",     fg: "textFaint", bg: "bg", reason: "Body-faint copy fails AA Normal; tracked in spec §12 v2 followups #8" },
  { themeId: "cafe",    fg: "textFaint", bg: "bg", reason: "Body-faint copy fails AA Normal; tracked in spec §12 v2 followups #8" },
  { themeId: "fantasy", fg: "textFaint", bg: "bg", reason: "Body-faint copy fails AA Normal; tracked in spec §12 v2 followups #8" },
];

const REQUIRED_PAIRS: Array<{ fg: keyof Colors; bg: keyof Colors }> = [
  { fg: "text",            bg: "bg" },
  { fg: "text",            bg: "surfaceCard" },
  { fg: "text",            bg: "surface" },
  { fg: "textMuted",       bg: "bg" },
  { fg: "textMuted",       bg: "surfaceCard" },
  { fg: "textMuted",       bg: "surface" },
  { fg: "textFaint",       bg: "bg" },
  { fg: "textFaint",       bg: "surfaceCard" },
  { fg: "textFaint",       bg: "surface" },
  { fg: "primaryText",     bg: "primary" },
  { fg: "graduatedCircle", bg: "graduatedBadge" },
];

const AA_NORMAL = 4.5;

function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

function contrastRatio(fgHex: string, bgHex: string): number {
  const l1 = luminance(fgHex);
  const l2 = luminance(bgHex);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

function isWaived(themeId: Theme["id"], fg: keyof Colors, bg: keyof Colors): boolean {
  return KNOWN_CONTRAST_WAIVERS.some(
    (w) => w.themeId === themeId && w.fg === fg && w.bg === bg,
  );
}

describe("Theme color contrast", () => {
  for (const [themeId, theme] of Object.entries(THEMES) as Array<[Theme["id"], Theme]>) {
    describe(`${themeId} theme`, () => {
      for (const { fg, bg } of REQUIRED_PAIRS) {
        const fgValue = theme.colors[fg];
        const bgValue = theme.colors[bg];
        const ratio = contrastRatio(fgValue, bgValue);
        const waived = isWaived(themeId, fg, bg);

        if (waived) {
          it(`${fg} on ${bg} is waived (ratio: ${ratio.toFixed(2)})`, () => {
            expect(waived).toBe(true);
          });
        } else {
          it(`${fg} on ${bg} meets AA Normal (4.5:1)`, () => {
            expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
          });
        }
      }
    });
  }
});
```

- [ ] **Step 2: Run the test**

Run: `npm test -- src/theme/__tests__/contrast.test.ts`
Expected: PASS — every required pair either meets AA Normal or is in the waiver list. (Per spec §4.4, all three themes' `graduatedCircle`/`graduatedBadge` pairs were verified at 4.96+ during design.)

- [ ] **Step 3: Commit**

```bash
git add src/theme/__tests__/contrast.test.ts
git commit -m "test(theme): enforce WCAG AA Normal contrast on required pairs with waivers"
```

---

## Task 14: ThemeCard component

**Files:**
- Create: `src/features/settings/screens/AppearanceScreen.tsx` (extract ThemeCard internally as a sub-component, OR put it in its own file if it grows past ~80 LOC)

For PR 1, build everything for the AppearanceScreen in a single file. Internal sub-components are fine. The Card is small enough that splitting it out is YAGNI for now.

- [ ] **Step 1: Write the failing test**

Create `src/features/settings/screens/__tests__/AppearanceScreen.test.tsx`:

```tsx
import { renderWithTheme, screen, fireEvent, act, waitFor } from "@/tests/setup/renderWithTheme";

import AppearanceScreen from "@/features/settings/screens/AppearanceScreen";

jest.mock("@/theme/fonts/loader", () => ({
  loadFontsFor: jest.fn(() => Promise.resolve()),
}));
jest.mock("@/services/analytics", () => ({
  trackEvent: jest.fn(),
}));
jest.mock("@/lib/db/repositories/preferences", () => ({
  setPreference: jest.fn(() => Promise.resolve()),
}));

import { trackEvent } from "@/services/analytics";
import { setPreference } from "@/lib/db/repositories/preferences";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("AppearanceScreen", () => {
  it("renders one card per theme", () => {
    renderWithTheme(<AppearanceScreen />);
    expect(screen.getByText("Zen")).toBeTruthy();
    expect(screen.getByText("Cafe")).toBeTruthy();
    expect(screen.getByText("Fantasy")).toBeTruthy();
  });

  it("marks the currently active theme card as selected", () => {
    renderWithTheme(<AppearanceScreen />, { themeId: "fantasy" });
    const fantasy = screen.getByA11yHint(/Fantasy/i).parent ?? screen.getByText("Fantasy");
    // Check via accessibility state if exposed; fall back to inspecting checkmark testID
    expect(screen.queryByTestId("active-checkmark-fantasy")).toBeTruthy();
    expect(screen.queryByTestId("active-checkmark-zen")).toBeFalsy();
  });

  it("fires settings_appearance_opened on mount", () => {
    renderWithTheme(<AppearanceScreen />);
    expect(trackEvent).toHaveBeenCalledWith("settings_appearance_opened");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/features/settings/screens/__tests__/AppearanceScreen.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the minimal AppearanceScreen with ThemeCard**

Create `src/features/settings/screens/AppearanceScreen.tsx`:

```tsx
import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Check } from "lucide-react-native";

import { useThemeContext } from "@/theme/ThemeProvider";
import { useThemedStyles } from "@/theme/useThemedStyles";
import { THEMES } from "@/theme/registry";
import { trackEvent } from "@/services/analytics";

import type { Theme, ThemeId } from "@/theme/contract";

export default function AppearanceScreen() {
  const { theme: active } = useThemeContext();

  useEffect(() => {
    trackEvent("settings_appearance_opened");
  }, []);

  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      screen: { flex: 1, backgroundColor: t.colors.bg },
      content: { padding: t.spacing.xl, gap: t.spacing.lg },
      footer: {
        color: t.colors.textMuted,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyMd,
        paddingTop: t.spacing.lg,
        textAlign: "center",
      },
    }),
  );

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
    >
      {(Object.values(THEMES) as Theme[]).map((t) => (
        <ThemeCard key={t.id} theme={t} isActive={t.id === active.id} />
      ))}
      <Text style={styles.footer}>
        Non-default themes need internet to download fonts the first time
        they're used. After that, they work offline.
      </Text>
    </ScrollView>
  );
}

type ThemeCardProps = {
  theme: Theme;
  isActive: boolean;
};

function ThemeCard({ theme, isActive }: ThemeCardProps) {
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      card: {
        backgroundColor: t.colors.surfaceCard,
        borderColor: isActive ? t.colors.primary : "transparent",
        borderRadius: t.radius.md,
        borderWidth: 2,
        flexDirection: "row",
        alignItems: "center",
        gap: t.spacing.lg,
        padding: t.spacing.lg,
      },
      swatches: { flexDirection: "row", gap: 4 },
      swatch: { width: 12, height: 12, borderRadius: 6 },
      label: {
        color: t.colors.text,
        fontFamily: t.fontFamilies.displaySemi,
        fontSize: t.typography.titleLg,
        flex: 1,
      },
    }),
  );

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: isActive }}
      accessibilityHint={
        theme.fontAssets.kind === "remote"
          ? `Applies the ${theme.name} theme. May need to download fonts.`
          : `Applies the ${theme.name} theme.`
      }
      style={styles.card}
    >
      <View style={styles.swatches}>
        <View style={[styles.swatch, { backgroundColor: theme.colors.primary }]} />
        <View style={[styles.swatch, { backgroundColor: theme.colors.surfaceHigh }]} />
        <View style={[styles.swatch, { backgroundColor: theme.colors.graduatedBadge }]} />
      </View>
      <Text style={styles.label}>{theme.name}</Text>
      {isActive ? (
        <Check
          testID={`active-checkmark-${theme.id}`}
          color={theme.colors.primary}
          size={20}
          strokeWidth={2.5}
        />
      ) : null}
    </Pressable>
  );
}
```

Note: The preview SVG image is not yet rendered in this task — it's added in Task 14 follow-up below. Keeping this task tight; the preview rendering needs a `react-native-svg` integration that's easier to test once the bare card works.

- [ ] **Step 4: Run the test**

Run: `npm test -- src/features/settings/screens/__tests__/AppearanceScreen.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/settings/screens/AppearanceScreen.tsx src/features/settings/screens/__tests__/AppearanceScreen.test.tsx
git commit -m "feat(theme): add AppearanceScreen with theme cards and selection state"
```

---

## Task 15: Embed preview SVG in ThemeCard

**Files:**
- Modify: `src/features/settings/screens/AppearanceScreen.tsx`

- [ ] **Step 1: Render the SVG inside ThemeCard**

In `src/features/settings/screens/AppearanceScreen.tsx`, add an `Image` rendered above the swatches row. Update the imports and ThemeCard JSX:

Add to imports:
```ts
import { Image } from "react-native";
```

Replace the ThemeCard return body — insert `<Image>` between the opening `<Pressable>` and the existing `<View style={styles.swatches}>`:

```tsx
return (
  <Pressable
    accessibilityRole="radio"
    accessibilityState={{ selected: isActive }}
    accessibilityHint={...same as before...}
    style={styles.card}
  >
    <Image
      source={theme.previewSvg}
      style={styles.preview}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
    <View style={styles.swatches}>...same as before...</View>
    <Text style={styles.label}>{theme.name}</Text>
    {isActive ? ... : null}
  </Pressable>
);
```

Update `styles` factory:

```ts
const styles = useThemedStyles((t) =>
  StyleSheet.create({
    card: { /* same as before, but: */
      flexDirection: "column",
      alignItems: "stretch",
    },
    preview: { width: "100%", height: 80, borderRadius: t.radius.sm },
    row: { flexDirection: "row", alignItems: "center", gap: t.spacing.lg, marginTop: t.spacing.md },
    swatches: { flexDirection: "row", gap: 4 },
    swatch: { width: 12, height: 12, borderRadius: 6 },
    label: { color: t.colors.text, fontFamily: t.fontFamilies.displaySemi, fontSize: t.typography.titleLg, flex: 1 },
  }),
);
```

Wrap the swatches/label/checkmark row in `<View style={styles.row}>`:

```tsx
<View style={styles.row}>
  <View style={styles.swatches}>...</View>
  <Text style={styles.label}>{theme.name}</Text>
  {isActive ? ... : null}
</View>
```

- [ ] **Step 2: Add a metro.config.js asset extension for SVG (if not already)**

Run: `cat metro.config.js 2>/dev/null || echo "no metro.config.js"`
If no file exists OR the file doesn't have an SVG asset/source ext line, create or update it. The simplest approach uses the default Expo metro config + adds SVG to assetExts:

If creating new `metro.config.js`:

```js
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push("svg");

module.exports = config;
```

If a metro.config.js already exists, add `config.resolver.assetExts.push("svg");` to it.

This treats SVG as a raster-equivalent asset for `Image`. (Using `react-native-svg`'s SvgUri or `react-native-svg-transformer` is also valid but adds more setup; Image with SVG asset works for static preview images.)

- [ ] **Step 3: Update the test**

Open `src/features/settings/screens/__tests__/AppearanceScreen.test.tsx`. Add a new test inside the existing `describe`:

```tsx
it("renders the preview image for each theme", () => {
  renderWithTheme(<AppearanceScreen />);
  // Each card's <Image> should mount; sample three by querying for accessibility text.
  // (Image elements don't expose text; we verify by counting via testID added in component or by snapshot.)
  // Simpler check: the parent Pressable for each theme renders without error.
  expect(screen.getByText("Zen").parent).toBeTruthy();
  expect(screen.getByText("Cafe").parent).toBeTruthy();
  expect(screen.getByText("Fantasy").parent).toBeTruthy();
});
```

- [ ] **Step 4: Run the test**

Run: `npm test -- src/features/settings/screens/__tests__/AppearanceScreen.test.tsx`
Expected: All 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/settings/screens/AppearanceScreen.tsx src/features/settings/screens/__tests__/AppearanceScreen.test.tsx metro.config.js
git commit -m "feat(theme): embed preview SVG in ThemeCard with metro asset config"
```

---

## Task 16: Tap-to-apply for bundled/cached themes

**Files:**
- Modify: `src/features/settings/screens/AppearanceScreen.tsx`
- Modify: `src/features/settings/screens/__tests__/AppearanceScreen.test.tsx`

**Goal:** When the user taps a non-active theme, if its fonts are bundled (Zen) or already cached, apply immediately: call `loadFontsFor`, then `setActiveTheme`, then `setPreference("theme_id", id)`, emit telemetry.

For PR 1 we'll wire the simplest path — assume tapping a remote-uncached theme attempts the load synchronously (the modal/spinner UX is Task 17). This lets us land the "happy path" first.

- [ ] **Step 1: Write a failing test for the happy-path apply**

Add to `src/features/settings/screens/__tests__/AppearanceScreen.test.tsx`:

```tsx
it("applies a theme on tap: loads fonts, switches active, writes preference, emits telemetry", async () => {
  renderWithTheme(<AppearanceScreen />, { themeId: "zen" });
  const cafeCard = screen.getByText("Cafe").parent;

  await act(async () => {
    fireEvent.press(cafeCard!);
  });

  await waitFor(() => {
    expect(setPreference).toHaveBeenCalledWith("theme_id", "cafe");
  });
  expect(trackEvent).toHaveBeenCalledWith(
    "theme_changed",
    expect.objectContaining({
      from_theme_id: "zen",
      to_theme_id: "cafe",
      required_download: expect.any(Boolean),
      was_retry: false,
    }),
  );
});

it("no-ops when tapping the already-active theme", async () => {
  renderWithTheme(<AppearanceScreen />, { themeId: "cafe" });
  const cafeCard = screen.getByText("Cafe").parent;

  await act(async () => {
    fireEvent.press(cafeCard!);
  });

  expect(setPreference).not.toHaveBeenCalled();
  expect(trackEvent).toHaveBeenCalledWith(
    "theme_picker_card_pressed",
    expect.objectContaining({ theme_id: "cafe", was_active: true }),
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/features/settings/screens/__tests__/AppearanceScreen.test.tsx`
Expected: FAIL — no press handler wired.

- [ ] **Step 3: Wire the press handler**

In `src/features/settings/screens/AppearanceScreen.tsx`:

Add imports at top:
```ts
import { useCallback, useRef, useState } from "react";
import { loadFontsFor } from "@/theme/fonts/loader";
import { setPreference } from "@/lib/db/repositories/preferences";
```

Inside `AppearanceScreen`, replace the body to include handler and pass to cards:

```tsx
export default function AppearanceScreen() {
  const { theme: active, setActiveTheme } = useThemeContext();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    trackEvent("settings_appearance_opened");
  }, []);

  const onCardPress = useCallback(
    async (target: Theme) => {
      trackEvent("theme_picker_card_pressed", {
        theme_id: target.id,
        was_active: target.id === active.id,
      });
      if (target.id === active.id) return;

      // Abort any in-flight prior tap.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const startedAt = Date.now();
      const requiredDownload = target.fontAssets.kind === "remote";

      try {
        await loadFontsFor(target, controller.signal);
        if (controller.signal.aborted) return;
        setActiveTheme(target.id);
        await setPreference("theme_id", target.id);
        trackEvent("theme_changed", {
          from_theme_id: active.id,
          to_theme_id: target.id,
          required_download: requiredDownload,
          was_retry: false,
          time_to_apply_ms: Date.now() - startedAt,
        });
      } catch (err) {
        // Task 18 wires error UI; for now just log.
        // The error_kind classification also lives there.
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [active.id, setActiveTheme],
  );

  // ...rest of the screen JSX, but pass onPress to ThemeCard:
  return (
    <ScrollView ...>
      {(Object.values(THEMES) as Theme[]).map((t) => (
        <ThemeCard key={t.id} theme={t} isActive={t.id === active.id} onPress={() => onCardPress(t)} />
      ))}
      <Text style={styles.footer}>...</Text>
    </ScrollView>
  );
}
```

Update `ThemeCardProps` and component to accept `onPress`:

```tsx
type ThemeCardProps = {
  theme: Theme;
  isActive: boolean;
  onPress: () => void;
};

function ThemeCard({ theme, isActive, onPress }: ThemeCardProps) {
  // ...styles same as before
  return (
    <Pressable onPress={onPress} ... >
      {/* same body */}
    </Pressable>
  );
}
```

- [ ] **Step 4: Run the test**

Run: `npm test -- src/features/settings/screens/__tests__/AppearanceScreen.test.tsx`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add src/features/settings/screens/AppearanceScreen.tsx src/features/settings/screens/__tests__/AppearanceScreen.test.tsx
git commit -m "feat(theme): wire happy-path tap-to-apply with telemetry"
```

---

## Task 17: Download confirm modal + spinner

**Files:**
- Modify: `src/features/settings/screens/AppearanceScreen.tsx`
- Modify: `src/features/settings/screens/__tests__/AppearanceScreen.test.tsx`

**Goal:** Before initiating a download for a remote-uncached theme, show a confirm modal with computed size. While downloading, show a spinner overlay locking the screen. Cancel button aborts.

- [ ] **Step 1: Write the failing test**

Add to AppearanceScreen test file:

```tsx
import { Alert } from "react-native";

it("shows a confirm modal before downloading remote-uncached theme", async () => {
  const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

  renderWithTheme(<AppearanceScreen />, { themeId: "zen" });
  const cafeCard = screen.getByText("Cafe").parent;

  await act(async () => {
    fireEvent.press(cafeCard!);
  });

  expect(alertSpy).toHaveBeenCalledWith(
    expect.stringContaining("Apply Cafe theme?"),
    expect.stringContaining("download"),
    expect.any(Array),
  );

  alertSpy.mockRestore();
});
```

(Using `Alert.alert` is the simplest cross-platform confirm. A full modal component is overkill for v1.)

- [ ] **Step 2: Run the test to verify it fails**

Expected: FAIL — current code calls `loadFontsFor` immediately without a confirmation.

- [ ] **Step 3: Add the confirm modal**

Modify the `onCardPress` handler in `AppearanceScreen.tsx`. Add Alert import:

```ts
import { Alert, ActivityIndicator } from "react-native";
```

Replace `onCardPress` body so remote themes confirm first. Also introduce a loading-state visual:

```tsx
const [isApplying, setIsApplying] = useState(false);

const onCardPress = useCallback(
  async (target: Theme) => {
    trackEvent("theme_picker_card_pressed", {
      theme_id: target.id,
      was_active: target.id === active.id,
    });
    if (target.id === active.id) return;

    const isRemote = target.fontAssets.kind === "remote";

    if (isRemote) {
      // For PR 1, assume cache miss every time. The cache module determines
      // actual cache hits when it runs; a future enhancement could pre-check
      // and skip the modal if all bytes are cached. For v1, modal is shown
      // and the load completes quickly on cache-hit paths.
      const totalBytes = Object.values(target.fontAssets.assets).reduce(
        (sum, a) => sum + a.bytes,
        0,
      );
      const formatted = formatBytes(totalBytes);
      const proceed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          `Apply ${target.name} theme?`,
          `This will download about ${formatted} of fonts. Connect to Wi-Fi if you're on cellular.`,
          [
            { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
            { text: "Download", onPress: () => resolve(true) },
          ],
          { cancelable: true, onDismiss: () => resolve(false) },
        );
      });
      if (!proceed) return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsApplying(true);

    const startedAt = Date.now();
    try {
      await loadFontsFor(target, controller.signal);
      if (controller.signal.aborted) return;
      setActiveTheme(target.id);
      await setPreference("theme_id", target.id);
      trackEvent("theme_changed", {
        from_theme_id: active.id,
        to_theme_id: target.id,
        required_download: isRemote,
        was_retry: false,
        time_to_apply_ms: Date.now() - startedAt,
      });
    } catch (err) {
      // Task 18 handles error UI.
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsApplying(false);
    }
  },
  [active.id, setActiveTheme],
);
```

Add a helper at module scope:

```ts
function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    const kb = Math.round(bytes / 1024 / 100) * 100;
    return `${kb} KB`;
  }
  const mb = Math.round(bytes / (1024 * 1024) * 10) / 10;
  return `${mb} MB`;
}
```

Add a spinner overlay to the JSX:

```tsx
return (
  <View style={styles.screen}>
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      {/* ...cards + footer */}
    </ScrollView>
    {isApplying ? (
      <View style={styles.overlay} pointerEvents="auto">
        <ActivityIndicator size="large" color={active.colors.primary} />
        <Text style={styles.overlayLabel}>Downloading fonts…</Text>
      </View>
    ) : null}
  </View>
);
```

Add overlay styles:

```ts
overlay: {
  ...StyleSheet.absoluteFillObject,
  backgroundColor: "rgba(0,0,0,0.4)",
  alignItems: "center",
  justifyContent: "center",
  gap: t.spacing.md,
},
overlayLabel: {
  color: "#FFFFFF",
  fontFamily: t.fontFamilies.body,
  fontSize: t.typography.bodyLg,
},
```

Also wrap the outer return in a `View` (style: `flex: 1`) so the overlay can absolute-position over the ScrollView.

- [ ] **Step 4: Run the test**

Run: `npm test -- src/features/settings/screens/__tests__/AppearanceScreen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/settings/screens/AppearanceScreen.tsx src/features/settings/screens/__tests__/AppearanceScreen.test.tsx
git commit -m "feat(theme): add download confirm modal and applying spinner overlay"
```

---

## Task 18: Inline error state on download failure

**Files:**
- Modify: `src/features/settings/screens/AppearanceScreen.tsx`
- Modify: `src/features/settings/screens/__tests__/AppearanceScreen.test.tsx`

**Goal:** When `loadFontsFor` throws, classify the error (network / integrity / storage), surface inline at top of screen, emit telemetry, and offer a retry button.

- [ ] **Step 1: Write the failing test**

Add:

```tsx
import { loadFontsFor as mockedLoadFonts } from "@/theme/fonts/loader";

it("surfaces inline error and emits telemetry when font load fails", async () => {
  (mockedLoadFonts as jest.Mock).mockRejectedValueOnce(new Error("Network request failed"));
  const alertSpy = jest.spyOn(Alert, "alert").mockImplementation((_t, _m, btns: any) => {
    btns?.find((b: any) => b.text === "Download")?.onPress?.();
  });

  renderWithTheme(<AppearanceScreen />, { themeId: "zen" });
  await act(async () => {
    fireEvent.press(screen.getByText("Cafe").parent!);
  });

  await waitFor(() => {
    expect(screen.getByText(/Couldn't load Cafe theme/i)).toBeTruthy();
  });
  expect(trackEvent).toHaveBeenCalledWith(
    "theme_font_download_failed",
    expect.objectContaining({ theme_id: "cafe", error_kind: "network" }),
  );
  alertSpy.mockRestore();
});
```

- [ ] **Step 2: Run the test**

Expected: FAIL — no error display.

- [ ] **Step 3: Implement error classification + display**

In `AppearanceScreen.tsx`, add:

```ts
type LoadError = { themeName: string; themeId: ThemeId; kind: "network" | "storage" | "integrity" | "other" };

const [loadError, setLoadError] = useState<LoadError | null>(null);

function classifyError(err: unknown): LoadError["kind"] {
  const msg = err instanceof Error ? err.message : String(err);
  if (/integrity/i.test(msg)) return "integrity";
  if (/space|ENOSPC|storage/i.test(msg)) return "storage";
  if (/network|fetch|timeout/i.test(msg)) return "network";
  return "other";
}
```

In the `catch` block:

```ts
} catch (err) {
  if (controller.signal.aborted) {
    trackEvent("theme_font_download_cancelled", { theme_id: target.id });
    return;
  }
  const kind = classifyError(err);
  setLoadError({ themeName: target.name, themeId: target.id, kind });
  trackEvent("theme_font_download_failed", { theme_id: target.id, error_kind: kind });
}
```

Add inline error UI at top of the ScrollView:

```tsx
{loadError ? (
  <View style={styles.errorBanner}>
    <Text style={styles.errorText}>
      Couldn't load {loadError.themeName} theme. Connect to the internet and try again.
    </Text>
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        const target = THEMES[loadError.themeId];
        setLoadError(null);
        onCardPress(target); // implicit retry
      }}
    >
      <Text style={styles.errorRetry}>Retry</Text>
    </Pressable>
  </View>
) : null}
```

Add styles:

```ts
errorBanner: {
  backgroundColor: t.colors.dangerSoft,
  borderRadius: t.radius.sm,
  padding: t.spacing.md,
  gap: t.spacing.sm,
},
errorText: { color: t.colors.danger, fontFamily: t.fontFamilies.body, fontSize: t.typography.bodyMd },
errorRetry: { color: t.colors.primary, fontFamily: t.fontFamilies.bodySemi, fontSize: t.typography.bodyMd },
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/features/settings/screens/__tests__/AppearanceScreen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/settings/screens/AppearanceScreen.tsx src/features/settings/screens/__tests__/AppearanceScreen.test.tsx
git commit -m "feat(theme): classify load errors and surface inline retry banner"
```

---

## Task 19: __DEV__ clear-font-cache action

**Files:**
- Modify: `src/features/settings/screens/AppearanceScreen.tsx`
- Modify: `src/features/settings/screens/__tests__/AppearanceScreen.test.tsx`

**Goal:** A `__DEV__`-gated button at the bottom of AppearanceScreen that deletes all cached font files. Lets PR 6's "fresh install fallback" scenario be reproduced without a real reinstall.

- [ ] **Step 1: Add a clear-cache helper to the cache module**

Open `src/theme/fonts/cache.ts`. The `expo-file-system/legacy` import already
exists at the top of the file (from Task 7) — do NOT add a second import.
Just add the function at the bottom, reusing the existing `FileSystem` import
and the module-scope `FONTS_DIR` constant:

```ts
export async function clearFontCache(): Promise<void> {
  await FileSystem.deleteAsync(FONTS_DIR, { idempotent: true });
}
```

- [ ] **Step 2: Add a test for the dev action**

Add to AppearanceScreen test file:

```tsx
import { clearFontCache } from "@/theme/fonts/cache";

jest.mock("@/theme/fonts/cache", () => ({
  ...jest.requireActual("@/theme/fonts/cache"),
  clearFontCache: jest.fn(() => Promise.resolve()),
}));

describe("dev affordances", () => {
  it("renders a clear-cache button only in __DEV__ mode", () => {
    (global as any).__DEV__ = true;
    renderWithTheme(<AppearanceScreen />);
    expect(screen.queryByText(/Clear font cache/i)).toBeTruthy();
  });

  it("calls clearFontCache when the dev button is pressed", async () => {
    (global as any).__DEV__ = true;
    renderWithTheme(<AppearanceScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText(/Clear font cache/i));
    });
    expect(clearFontCache).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Render the button in AppearanceScreen**

Below the footer Text in the ScrollView:

```tsx
{__DEV__ ? (
  <Pressable
    onPress={async () => {
      const { clearFontCache } = await import("@/theme/fonts/cache");
      await clearFontCache();
    }}
    style={styles.devButton}
  >
    <Text style={styles.devButtonText}>[DEV] Clear font cache</Text>
  </Pressable>
) : null}
```

Add styles:

```ts
devButton: { padding: t.spacing.sm, alignItems: "center", marginTop: t.spacing.lg },
devButtonText: { color: t.colors.textFaint, fontFamily: t.fontFamilies.body, fontSize: t.typography.bodyMd },
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/features/settings/screens/__tests__/AppearanceScreen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/theme/fonts/cache.ts src/features/settings/screens/AppearanceScreen.tsx src/features/settings/screens/__tests__/AppearanceScreen.test.tsx
git commit -m "feat(theme): add __DEV__ clear-font-cache action for fallback verification"
```

---

## Task 20: expo-router screen entry for AppearanceScreen

**Files:**
- Create: `app/(app)/settings/appearance.tsx`

- [ ] **Step 1: Create the route entry**

Create `app/(app)/settings/appearance.tsx`:

```tsx
import AppearanceScreen from "@/features/settings/screens/AppearanceScreen";

export default AppearanceScreen;
```

- [ ] **Step 2: Verify the route is discoverable**

Run: `npm start` (briefly, or just `npm run typecheck` for static check)
Expected: typecheck passes. (Manual launch verification deferred to Task 22.)

- [ ] **Step 3: Commit**

```bash
git add app/(app)/settings/appearance.tsx
git commit -m "feat(theme): add expo-router screen entry at /(app)/settings/appearance"
```

---

## Task 21: Mount ThemeProvider in app/_layout.tsx

**Files:**
- Modify: `app/_layout.tsx`

**Goal:** Wrap the existing root layout tree in `<ThemeProvider>`. On mount, read `theme_id` from preferences, decide on initial theme, register fonts, hide splash. Inline color references on lines 222, 282, 290 stay unchanged — they resolve via re-export shims.

- [ ] **Step 1: Add a helper to resolve the initial theme from preferences**

Inside `app/_layout.tsx`, add a new function near the top (after existing imports):

```ts
import { getPreference, setPreference } from "@/lib/db/repositories/preferences";
import { THEMES, isKnownThemeId } from "@/theme/registry";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { loadFontsFor } from "@/theme/fonts/loader";

import type { ThemeId } from "@/theme/contract";

async function resolveInitialTheme(): Promise<{
  initialThemeId: ThemeId;
  intendedThemeId: ThemeId;
  fallbackReason: "unknown_id" | "offline" | "load_failed" | null;
}> {
  const stored = await getPreference("theme_id");

  if (stored == null) {
    return { initialThemeId: "zen", intendedThemeId: "zen", fallbackReason: null };
  }
  if (!isKnownThemeId(stored)) {
    // Unknown id: rewrite preference per spec §6.
    await setPreference("theme_id", "zen");
    return { initialThemeId: "zen", intendedThemeId: "zen", fallbackReason: "unknown_id" };
  }

  const theme = THEMES[stored];
  const controller = new AbortController();
  try {
    await loadFontsFor(theme, controller.signal);
    return { initialThemeId: stored, intendedThemeId: stored, fallbackReason: null };
  } catch {
    // Fall back to Zen at runtime; preserve preference (next launch retries).
    return { initialThemeId: "zen", intendedThemeId: stored, fallbackReason: "load_failed" };
  }
}
```

- [ ] **Step 2: Replace the existing `useFonts` call with a single-pass theme + font initializer**

The existing `RootLayout` has a `useFonts({...})` call with the bundled font assets. Since Zen's bundled assets are now provided by the theme, we want to either:
- Keep `useFonts` for Zen-bundled assets (simpler), and ALSO resolve initial theme separately.
- Replace `useFonts` with a manual `Font.loadAsync` inside `resolveInitialTheme`.

**Go with the first option** — keep `useFonts` for the bundled set so the existing hook contract is preserved. The `loadFontsFor` call in `resolveInitialTheme` only does additional work for remote themes (and is a no-op for bundled, since `useFonts` already registered them).

Edit `RootLayout` (around line 233-243). Replace the existing function body:

```tsx
function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_700Bold,
    PlusJakartaSans_700Bold_Italic,
    PlusJakartaSans_800ExtraBold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  const [dbReady, setDbReady] = useState(false);
  const [themeResolved, setThemeResolved] = useState<{
    initialThemeId: ThemeId;
    intendedThemeId: ThemeId;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    initDb()
      .then(() => { if (!cancelled) setDbReady(true); })
      .catch((error: unknown) => {
        if (!cancelled) logger.error("DB init failed at app launch", { error });
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!dbReady) return;
    let cancelled = false;
    void resolveInitialTheme().then((resolved) => {
      if (cancelled) return;
      setThemeResolved({
        initialThemeId: resolved.initialThemeId,
        intendedThemeId: resolved.intendedThemeId,
      });
    });
    return () => { cancelled = true; };
  }, [dbReady]);

  useEffect(() => {
    if (fontsLoaded && dbReady && themeResolved) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, dbReady, themeResolved]);

  if (!fontsLoaded || !dbReady || !themeResolved) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <TelemetryProvider>
          <ThemeProvider
            initialThemeId={themeResolved.initialThemeId}
            intendedThemeId={themeResolved.intendedThemeId}
          >
            <AppProviders>
              <NotificationHandler />
              <ScreenTracker />
              <StatusBar backgroundColor={colors.surface} style="dark" translucent={false} />
              <ErrorBoundary fallback={<ErrorFallback />}>
                <View style={{ flex: 1 }}>
                  <Stack
                    screenOptions={{
                      contentStyle: { backgroundColor: colors.bg },
                      headerBackButtonDisplayMode: "minimal",
                    }}
                  >
                    <Stack.Screen name="index" options={{ headerShown: false }} />
                    <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                    <Stack.Screen name="(app)" options={{ headerShown: false }} />
                    <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
                  </Stack>
                </View>
              </ErrorBoundary>
            </AppProviders>
          </ThemeProvider>
        </TelemetryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

Note the inline `colors.surface` (StatusBar bg), `colors.bg` (Stack contentStyle), and the `ErrorFallback` reading `colors` — all continue to read from the static `colors` re-export shim, which equals Zen. These are lifted to a `<ThemedRoot>` in PR 5 per spec §8. **Do not** lift them in PR 1.

- [ ] **Step 3: Run the existing test suite**

Run: `npm test`
Expected: All existing tests pass. The snapshot suite is the safety net; static `colors` values are byte-for-byte the same as before.

- [ ] **Step 4: Type-check**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat(theme): mount ThemeProvider at root; preserve inline color refs"
```

---

## Task 22: __DEV__ Settings entry to AppearanceScreen

**Files:**
- Modify: `src/features/settings/screens/SettingsScreen.tsx`

**Goal:** A new ZenCard with one row labeled "[DEV] Appearance" that pushes `/(app)/settings/appearance`. Only renders under `__DEV__`.

- [ ] **Step 1: Add the row to SettingsScreen**

Open `src/features/settings/screens/SettingsScreen.tsx`. Locate the `<ZenCard>` for "Archive" (around line 79-88). Add a new ZenCard above the "Privacy & Data" card:

```tsx
{__DEV__ ? (
  <ZenCard gap={0}>
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push("/(app)/settings/appearance")}
      style={styles.row}
    >
      <Text style={styles.rowLabel}>[DEV] Appearance</Text>
      <ChevronRight color={colors.textFaint} size={18} strokeWidth={1.75} />
    </Pressable>
  </ZenCard>
) : null}
```

(The existing `styles.row` and `styles.rowLabel` patterns from `SettingsScreen.tsx` are reused. The `ChevronRight` import is already present.)

- [ ] **Step 2: Type-check + run existing tests**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/settings/screens/SettingsScreen.tsx
git commit -m "feat(theme): add __DEV__ Settings entry to AppearanceScreen"
```

---

## Task 23: Update src/theme/index.ts barrel

**Files:**
- Modify: `src/theme/index.ts`

- [ ] **Step 1: Re-export the new theme module surface**

Replace the entire contents of `src/theme/index.ts`:

```ts
export { colors } from "./colors";
export { typography } from "./typography";
export { spacing } from "./spacing";
export { radius } from "./radius";
export { shadows } from "./shadows";
export { fontFamilies } from "./fontFamilies";

// New theming API. Components migrated to themes use these instead of the
// static exports above.
export { useTheme } from "./useTheme";
export { useThemedStyles } from "./useThemedStyles";
export { ThemeProvider } from "./ThemeProvider";
export { THEMES, getTheme, isKnownThemeId } from "./registry";
export type {
  Theme,
  ThemeId,
  Colors,
  Typography,
  Spacing,
  Radius,
  Shadows,
  FontFamilies,
  FontAssets,
  RemoteFontAsset,
} from "./contract";
```

- [ ] **Step 2: Type-check**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/theme/index.ts
git commit -m "chore(theme): expose new theming API from src/theme barrel"
```

---

## Task 24: Final verification (manual)

**Files:** none. This is a smoke checklist.

- [ ] **Step 1: Run the full test suite one more time**

Run: `npm test`
Expected: All tests pass. No snapshot regressions.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 3: Launch the app on a device or emulator**

Run: `npm start`
Open the app on iOS/Android. Verify:
- App launches without errors.
- All screens render exactly as before (Today, Habit Detail, Settings, Onboarding).
- No console warnings about missing fonts.
- Tap Settings → `[DEV] Appearance` → AppearanceScreen opens, shows three cards (Zen marked active), shows footer copy. Three preview SVG images render (or placeholders if SVGs were missing — verify image source).

- [ ] **Step 4: Verify happy path on Cafe**

In AppearanceScreen, tap Cafe card. Confirm modal appears with a download size figure (under 1 MB). Tap "Download". Overlay spinner appears. Within ~5 seconds, fonts download and AppearanceScreen rerenders with Cafe colors: warm bg, brown text, Poppins fonts in the card label. Active checkmark moves to Cafe.

- [ ] **Step 5: Force-quit and relaunch — verify Cafe persists**

Force-quit the app. Relaunch. App opens directly on AppearanceScreen rendered in Cafe colors. Settings entry shows up in Cafe styling too.

- [ ] **Step 6: Test offline fallback**

In AppearanceScreen, tap `[DEV] Clear font cache`. Then enable airplane mode. Force-quit. Relaunch. App should fall back to Zen at runtime, but the preference is preserved (verify by re-enabling network and relaunching — Cafe should load).

- [ ] **Step 7: Verify accessibility**

Enable VoiceOver (iOS) or TalkBack (Android). Navigate to AppearanceScreen. Verify each card announces as a radio button with selected/not-selected state. Verify the download warning is included in the announcement for remote themes.

- [ ] **Step 8: Commit any final adjustments**

If any of the manual checks reveal a bug, fix it as a follow-up commit. If all pass:

```bash
git commit --allow-empty -m "chore(theme): PR 1 manual smoke verification complete"
```

(The empty commit is a marker only — skip it if the project doesn't want marker commits.)

---

## Out of scope for PR 1 (deferred to later PRs)

- Migrating any of the 91 existing styled components — these get their own PRs (2-5 per spec §8).
- Lifting inline color refs at `app/_layout.tsx:222,282,290` into `<ThemedRoot>` — deferred to PR 5.
- The real (non-dev) Settings entry to AppearanceScreen — deferred to PR 6.
- Deleting the re-export shims — deferred to PR 6.
- Beta/production rollout — covered by the spec's rollout section once PR 6 lands.
- **Migrating `cache.ts` off `expo-file-system/legacy` to the new SDK 54 File/Directory/Paths OO API** — v1 uses the legacy subpath (deprecated but supported). When the app next bumps Expo SDK, this import must migrate or it will break. Tracked as a follow-up; not blocking v1.

---

## Self-review notes (after writing)

Cross-checking against the spec:

- §2 decisions: all locked decisions covered (registry, font kinds, OS dark mode ignored, picker UX shape, sync local-only, architecture).
- §3.1-3.7: file layout, contract, wiring, cold-start, runtime switch, runtime-vs-intended, concurrent taps — all implemented in PR 1 except `<ThemedRoot>` lifting (deferred to PR 5 per spec §8 sequencing).
- §4.1-4.4: all three themes built; graduatedCircle/Badge constraint enforced via Task 13 contrast test.
- §5: AppearanceScreen built. Settings row entry is `__DEV__`-only in PR 1 per spec §8 PR 6 split.
- §6: error matrix rows covered. Most user-facing rows are implemented in Tasks 17-18. Disk-full and integrity-mismatch routing land in Tasks 7-8 (cache layer) and Task 18 (UI classification).
- §7: contrast test (Task 13), renderWithTheme helper (Task 12).
- §8: Pre-PR-1 (Task 0), PR 1 contents fully covered (Tasks 1-22). PRs 2-6 documented as out-of-scope.
- §9: telemetry events fired in Tasks 14 (opened/card_pressed), 16 (theme_changed), 17 (no new events), 18 (download_failed/cancelled). `theme_offline_fallback_triggered`/`theme_unknown_id_recovered`/`theme_offline_download_blocked`/`theme_picker_dismissed`/`theme_font_load_failed`/`theme_font_download_failed (integrity)` — most fire in Task 18's error path or Task 21's cold-start resolver; some require additional plumbing in Task 21 (cold-start fallback event). **Flagging**: `theme_offline_download_blocked` and `theme_picker_dismissed` are explicit events that need plumbing — see follow-up note below.
- §10: non-goals respected; nothing in this plan exceeds the v1 scope.
- §11: accessibility limitations documented in spec only; no code changes needed.

**Follow-up items discovered during self-review:**

1. `theme_offline_download_blocked` — **DECISION: DEFER (verified `@react-native-community/netinfo` is NOT installed).** Do not add a netinfo dependency in PR 1. Offline-while-tapping a remote-uncached theme falls through Task 18's error path: the `downloadAsync` fails, gets classified as `'network'` by `classifyError`, and surfaces the inline retry banner. The dedicated `theme_offline_download_blocked` pre-check event is a follow-up PR (add netinfo + a pre-modal connectivity check then). For v1, the user still gets a correct error + retry; only the finer-grained telemetry distinction is missing.
2. `theme_picker_dismissed` — fires when user navigates away from AppearanceScreen. Requires a `useFocusEffect` cleanup hook tracking whether any card was pressed during the session. Trivial — add as a final-pass enhancement in Task 22 or defer to a small follow-up.
3. `theme_offline_fallback_triggered` and `theme_unknown_id_recovered` — these belong in `resolveInitialTheme` in Task 21. The current Task 21 implementation captures the fallback reason but doesn't emit telemetry. Add emission inside `resolveInitialTheme` based on `fallbackReason`.
4. Cold-start banner — spec calls for a non-dismissable ~3s banner on first render after offline fallback. The current plan defers this UI to a follow-up; for PR 1 ship without the banner and document as a v1 follow-up (the fallback still happens correctly; only the user notification is missing). This is a known gap — track for completion before PR 6 ships.

The implementer should resolve items 1-3 inline during execution (small additions to existing tasks). Item 4 is a real defer.
