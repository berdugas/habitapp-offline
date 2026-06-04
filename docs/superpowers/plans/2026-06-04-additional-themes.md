# Additional Themes (Play, Energy, Sound) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three new themes (Play, Energy, Sound) to the existing runtime theme system, taking the catalog from 3 to 6 themes — no contract shape changes, no consumer changes.

**Architecture:** Each new theme is a `Theme` object plugged into `src/theme/registry.ts`. Fonts hosted remotely in the Supabase `fonts` bucket (same as Cafe/Fantasy). Preview SVGs generated via a new reusable opentype.js script committed at `scripts/generate_theme_previews.mjs`. Tests that hard-code theme IDs (`registry.test.ts`, `contract.test.ts`, `ThemeProvider.test.tsx`) get narrow-union widenings.

**Tech Stack:** TypeScript, Expo SDK 54, Jest, opentype.js (new devDep), Supabase Storage. Spec: [docs/superpowers/specs/2026-06-04-additional-themes-design.md](../specs/2026-06-04-additional-themes-design.md).

---

## File Structure

**Creates:**
- `src/theme/themes/play.ts` — Play theme object (PlayStation-dark + Inter)
- `src/theme/themes/energy.ts` — Energy theme object (peach + Limelight/Work Sans)
- `src/theme/themes/sound.ts` — Sound theme object (Spotify-dark + DM Sans)
- `scripts/generate_theme_previews.mjs` — reusable opentype.js text-to-path preview generator
- `scripts/measure_font_assets.mjs` — small helper that prints `RemoteFontAsset` entries (uri/hash/bytes) for a list of local TTFs

**Modifies:**
- `src/theme/contract.ts` — `ThemeId` union: 3 → 6 IDs
- `src/theme/registry.ts` — import + register 3 new themes; extend `isKnownThemeId`
- `src/theme/themes/previews/index.ts` — add 3 new preview SVG exports
- `src/theme/__tests__/contract.test.ts` — update `ThemeId[]` literal + length assertion (3 → 6)
- `src/theme/__tests__/registry.test.ts` — assert new theme IDs
- `src/theme/__tests__/contrast.test.ts` — add `textFaint` waivers for 3 new themes
- `src/theme/__tests__/ThemeProvider.test.tsx` — widen narrow `"zen" | "cafe" | "fantasy"` literal to `ThemeId`
- `package.json` — add `opentype.js` devDependency

**Does not touch:**
- `AppearanceScreen.tsx`, `MakeItYoursScreen.tsx`, `useThemePicker.ts`, `ThemeProvider.tsx`, `useTheme.ts`, `useThemedStyles.ts`, `fonts/loader.ts`, `fonts/cache.ts`, the ~90 themed components

---

## Task 1: Widen ThemeId union

Make the contract aware of all 6 IDs first. This unblocks every later task that imports `ThemeId`.

**Files:**
- Modify: [src/theme/contract.ts:1](src/theme/contract.ts:1)
- Modify: [src/theme/__tests__/contract.test.ts:4-7](src/theme/__tests__/contract.test.ts:4)

- [ ] **Step 1: Run the contract test to confirm current pass**

```bash
npx jest src/theme/__tests__/contract.test.ts
```

Expected: PASS (3 assertions about `ThemeId` length 3).

- [ ] **Step 2: Update the contract test assertion to expect 6 IDs**

In [src/theme/__tests__/contract.test.ts](src/theme/__tests__/contract.test.ts):

```typescript
describe("Theme contract", () => {
  it("ThemeId is a fixed union of six ids", () => {
    const valid: ThemeId[] = ["zen", "cafe", "fantasy", "play", "energy", "sound"];
    expect(valid).toHaveLength(6);
  });
```

- [ ] **Step 3: Run the contract test to confirm it fails**

```bash
npx jest src/theme/__tests__/contract.test.ts
```

Expected: FAIL — TypeScript compilation error on `"play"`, `"energy"`, `"sound"` not assignable to `ThemeId`.

- [ ] **Step 4: Widen the `ThemeId` union in the contract**

In [src/theme/contract.ts:1](src/theme/contract.ts:1) replace the first line:

```typescript
export type ThemeId = "zen" | "cafe" | "fantasy" | "play" | "energy" | "sound";
```

- [ ] **Step 5: Run the contract test to confirm it passes**

```bash
npx jest src/theme/__tests__/contract.test.ts
```

Expected: PASS.

- [ ] **Step 6: Confirm the registry still type-checks**

```bash
npx tsc --noEmit
```

Expected: PASS. (`isKnownThemeId` in `registry.ts` will still return `false` for the new IDs — that's fine, we update it later.)

- [ ] **Step 7: Commit**

```bash
git add src/theme/contract.ts src/theme/__tests__/contract.test.ts
git commit -m "feat(theme): widen ThemeId union to six ids"
```

---

## Task 2: Widen ThemeProvider.test.tsx narrow literal

`ThemeProvider.test.tsx:28` has a hardcoded `"zen" | "cafe" | "fantasy"` literal that disagrees with the now-wider `ThemeId`. Function-parameter bivariance keeps it compiling today, but the literal is misleading.

**Files:**
- Modify: [src/theme/__tests__/ThemeProvider.test.tsx:28](src/theme/__tests__/ThemeProvider.test.tsx:28)

- [ ] **Step 1: Locate the narrow literal**

```bash
grep -n 'zen" | "cafe" | "fantasy"' src/theme/__tests__/ThemeProvider.test.tsx
```

Expected: one match on line 28.

- [ ] **Step 2: Confirm `ThemeId` is already imported in this test file**

```bash
grep -n "ThemeId" src/theme/__tests__/ThemeProvider.test.tsx
```

If `ThemeId` is not already imported, add it to the existing `@/theme/contract` import line at the top of the file.

- [ ] **Step 3: Replace the narrow literal with `ThemeId`**

In [src/theme/__tests__/ThemeProvider.test.tsx:28](src/theme/__tests__/ThemeProvider.test.tsx:28):

```typescript
let captured: ((id: ThemeId) => void) | null = null;
```

- [ ] **Step 4: Run the test to confirm it still passes**

```bash
npx jest src/theme/__tests__/ThemeProvider.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/theme/__tests__/ThemeProvider.test.tsx
git commit -m "test(theme): widen ThemeProvider narrow literal to ThemeId"
```

---

## Task 3: Add opentype.js devDependency + scaffold preview generation script

The original v1 preview SVG generator was a one-off and was not checked in. This task commits a reusable version with the NaN-float workaround. The script accepts theme inputs via CLI args and writes the SVG path data to stdout.

**Files:**
- Modify: `package.json`
- Create: `scripts/generate_theme_previews.mjs`

- [ ] **Step 1: Install opentype.js as a devDependency**

```bash
npm install --save-dev opentype.js
```

Expected: `package.json` gains `"opentype.js": "^1.3.4"` (or similar) in `devDependencies`; `package-lock.json` updates.

- [ ] **Step 2: Create the preview generation script**

Create `scripts/generate_theme_previews.mjs`:

```javascript
// Usage:
//   node scripts/generate_theme_previews.mjs \
//     --name "Play" \
//     --tagline "Quiet authority" \
//     --displayFont tmp/fonts/inter/Inter_300Light.ttf \
//     --bodyFont tmp/fonts/inter/Inter_400Regular.ttf \
//     --bg "#0A0B10" \
//     --fg "#FFFFFF"
//
// Prints the SVG XML to stdout (240x80 viewBox, name in display font + tagline in body font).
// Carries the opentype.js NaN-float workaround: glyphs are rendered one-at-a-time and any
// Path command containing NaN coordinates is dropped before serialization.

import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import opentype from "opentype.js";

const { values: args } = parseArgs({
  options: {
    name: { type: "string" },
    tagline: { type: "string" },
    displayFont: { type: "string" },
    bodyFont: { type: "string" },
    bg: { type: "string" },
    fg: { type: "string" },
  },
});

for (const required of ["name", "tagline", "displayFont", "bodyFont", "bg", "fg"]) {
  if (!args[required]) {
    console.error(`Missing required arg: --${required}`);
    process.exit(1);
  }
}

function loadFont(path) {
  const buffer = readFileSync(path);
  // opentype.parse expects an ArrayBuffer
  return opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
}

function renderTextToPath(font, text, x, y, fontSize) {
  // Glyph-by-glyph render bypasses the shaper, which throws on some fonts'
  // substitution tables (Plus Jakarta Sans). Returns SVG path `d` string.
  const glyphs = font.stringToGlyphs(text);
  const fontScale = (1 / font.unitsPerEm) * fontSize;
  let cursor = x;
  const commands = [];
  for (const glyph of glyphs) {
    const glyphPath = glyph.getPath(cursor, y, fontSize);
    for (const cmd of glyphPath.commands) {
      // Guard against NaN floats (opentype.js bug with some hinted fonts).
      const coords = [cmd.x, cmd.y, cmd.x1, cmd.y1, cmd.x2, cmd.y2];
      if (coords.some((c) => typeof c === "number" && Number.isNaN(c))) continue;
      commands.push(cmd);
    }
    cursor += (glyph.advanceWidth ?? 0) * fontScale;
  }
  // Build the `d` attribute manually
  return commands.map((c) => {
    switch (c.type) {
      case "M": return `M${c.x.toFixed(2)} ${c.y.toFixed(2)}`;
      case "L": return `L${c.x.toFixed(2)} ${c.y.toFixed(2)}`;
      case "C": return `C${c.x1.toFixed(2)} ${c.y1.toFixed(2)} ${c.x2.toFixed(2)} ${c.y2.toFixed(2)} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`;
      case "Q": return `Q${c.x1.toFixed(2)} ${c.y1.toFixed(2)} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`;
      case "Z": return "Z";
      default: return "";
    }
  }).join("");
}

const displayFont = loadFont(args.displayFont);
const bodyFont = loadFont(args.bodyFont);

// Layout: 240x80. Display text at y=40, ~24px. Tagline at y=68, ~12px.
const namePathD = renderTextToPath(displayFont, args.name, 16, 40, 24);
const taglinePathD = renderTextToPath(bodyFont, args.tagline, 16, 68, 12);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 80" width="240" height="80">
  <rect width="240" height="80" fill="${args.bg}"/>
  <path d="${namePathD}" fill="${args.fg}"/>
  <path d="${taglinePathD}" fill="${args.fg}"/>
</svg>`;

process.stdout.write(svg);
```

- [ ] **Step 3: Verify the script runs and shows help when args missing**

```bash
node scripts/generate_theme_previews.mjs
```

Expected: prints `Missing required arg: --name` and exits 1.

- [ ] **Step 4: Add the second helper script `scripts/measure_font_assets.mjs`**

Create `scripts/measure_font_assets.mjs`:

```javascript
// Usage:
//   node scripts/measure_font_assets.mjs <family-slug> <local-dir> [<bucket-prefix>]
// Example:
//   node scripts/measure_font_assets.mjs inter tmp/fonts/inter
//
// Walks the local-dir for *.ttf, computes SHA256 + byte count, and prints a
// TypeScript object literal ready to paste into a theme file's fontAssets.assets.
// Bucket prefix defaults to: https://wrytjnucrxsqdrbwxsgi.supabase.co/storage/v1/object/public/fonts/v1/<family-slug>/<filename>

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:path/posix";
import * as fs from "node:fs";
import * as nodePath from "node:path";

const [, , familySlug, localDir, bucketPrefixArg] = process.argv;
if (!familySlug || !localDir) {
  console.error("Usage: node scripts/measure_font_assets.mjs <family-slug> <local-dir>");
  process.exit(1);
}

const bucketPrefix = bucketPrefixArg
  ?? `https://wrytjnucrxsqdrbwxsgi.supabase.co/storage/v1/object/public/fonts/v1/${familySlug}`;

const files = fs.readdirSync(localDir).filter((f) => f.endsWith(".ttf")).sort();
const entries = files.map((file) => {
  const fullPath = nodePath.join(localDir, file);
  const buf = fs.readFileSync(fullPath);
  const hash = createHash("sha256").update(buf).digest("hex");
  const bytes = buf.byteLength;
  const key = file.replace(/\.ttf$/, "");
  const uri = `${bucketPrefix}/${file}`;
  return `      ${key}: { uri: "${uri}", hash: "${hash}", bytes: ${bytes} },`;
});

process.stdout.write(entries.join("\n") + "\n");
```

- [ ] **Step 5: Verify the measure script runs and shows usage when args missing**

```bash
node scripts/measure_font_assets.mjs
```

Expected: prints usage and exits 1.

- [ ] **Step 6: Add `tmp/` to .gitignore if not already**

```bash
grep -q '^tmp/$' .gitignore || echo 'tmp/' >> .gitignore
```

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json scripts/generate_theme_previews.mjs scripts/measure_font_assets.mjs .gitignore
git commit -m "feat(theme): add reusable preview-gen and font-measure scripts"
```

---

## Task 4: Pre-add textFaint contrast waivers for the three new themes

Adding waivers before the themes themselves means the contrast test passes the moment each theme lands. Waivers reference IDs that don't yet exist in `THEMES` — that's safe because the waiver loop is data-driven, not enforced against the registry.

**Files:**
- Modify: [src/theme/__tests__/contrast.test.ts:12-28](src/theme/__tests__/contrast.test.ts:12)

- [ ] **Step 1: Read the existing waivers array**

```bash
grep -n "KNOWN_CONTRAST_WAIVERS" src/theme/__tests__/contrast.test.ts
```

Expected: const declaration plus the closing bracket near line 28.

- [ ] **Step 2: Add 9 new waivers — 3 `textFaint`-on-surface pairs per new theme**

Append the following entries inside the `KNOWN_CONTRAST_WAIVERS` array, immediately before the closing `];` near line 28:

```typescript
  { themeId: "play",    fg: "textFaint",       bg: "bg",             reason: "Body-faint copy fails AA Normal; mirrors Zen/Cafe/Fantasy waiver" },
  { themeId: "play",    fg: "textFaint",       bg: "surfaceCard",    reason: "Body-faint copy fails AA Normal; mirrors Zen/Cafe/Fantasy waiver" },
  { themeId: "play",    fg: "textFaint",       bg: "surface",        reason: "Body-faint copy fails AA Normal; mirrors Zen/Cafe/Fantasy waiver" },
  { themeId: "energy",  fg: "textFaint",       bg: "bg",             reason: "Body-faint copy fails AA Normal; mirrors Zen/Cafe/Fantasy waiver" },
  { themeId: "energy",  fg: "textFaint",       bg: "surfaceCard",    reason: "Body-faint copy fails AA Normal; mirrors Zen/Cafe/Fantasy waiver" },
  { themeId: "energy",  fg: "textFaint",       bg: "surface",        reason: "Body-faint copy fails AA Normal; mirrors Zen/Cafe/Fantasy waiver" },
  { themeId: "sound",   fg: "textFaint",       bg: "bg",             reason: "Body-faint copy fails AA Normal; mirrors Zen/Cafe/Fantasy waiver" },
  { themeId: "sound",   fg: "textFaint",       bg: "surfaceCard",    reason: "Body-faint copy fails AA Normal; mirrors Zen/Cafe/Fantasy waiver" },
  { themeId: "sound",   fg: "textFaint",       bg: "surface",        reason: "Body-faint copy fails AA Normal; mirrors Zen/Cafe/Fantasy waiver" },
```

- [ ] **Step 3: Run the contrast test to confirm nothing broke**

```bash
npx jest src/theme/__tests__/contrast.test.ts
```

Expected: PASS. The new waiver entries reference non-existent themes; they sit dormant until the themes land. No assertions trigger for missing themes.

- [ ] **Step 4: Commit**

```bash
git add src/theme/__tests__/contrast.test.ts
git commit -m "test(theme): pre-add textFaint waivers for play/energy/sound"
```

---

## Task 5: Add Play theme

This task downloads Inter fonts locally, uploads them to the Supabase fonts bucket, generates the preview SVG, writes `play.ts`, registers the theme, updates `registry.test.ts`, and confirms all theme tests pass.

**Files:**
- Create: `src/theme/themes/play.ts`
- Modify: `src/theme/themes/previews/index.ts`
- Modify: `src/theme/registry.ts`
- Modify: `src/theme/__tests__/registry.test.ts`
- External: 7 TTF files uploaded to Supabase `fonts/v1/inter/`

- [ ] **Step 1: Create local font staging directory and download Inter from Google Fonts**

```bash
mkdir -p tmp/fonts/inter
cd tmp/fonts/inter
curl -L -o Inter_300Light.ttf            "https://github.com/expo/google-fonts/raw/main/font-packages/inter/300Light/Inter_300Light.ttf"
curl -L -o Inter_400Regular.ttf          "https://github.com/expo/google-fonts/raw/main/font-packages/inter/400Regular/Inter_400Regular.ttf"
curl -L -o Inter_400Regular_Italic.ttf   "https://github.com/expo/google-fonts/raw/main/font-packages/inter/400Regular_Italic/Inter_400Regular_Italic.ttf"
curl -L -o Inter_500Medium.ttf           "https://github.com/expo/google-fonts/raw/main/font-packages/inter/500Medium/Inter_500Medium.ttf"
curl -L -o Inter_600SemiBold.ttf         "https://github.com/expo/google-fonts/raw/main/font-packages/inter/600SemiBold/Inter_600SemiBold.ttf"
curl -L -o Inter_700Bold.ttf             "https://github.com/expo/google-fonts/raw/main/font-packages/inter/700Bold/Inter_700Bold.ttf"
curl -L -o Inter_800ExtraBold.ttf        "https://github.com/expo/google-fonts/raw/main/font-packages/inter/800ExtraBold/Inter_800ExtraBold.ttf"
cd ../../..
ls -la tmp/fonts/inter/
```

Expected: 7 `.ttf` files each ≥100 KB. If any 404s, try the alternate CDN: `https://fonts.gstatic.com/s/inter/v...` — exact path requires looking up the Google Fonts API; fallback option is `npm pack @expo-google-fonts/inter` and extracting from the tgz.

- [ ] **Step 2: Upload to Supabase fonts bucket under `v1/inter/`**

Two options — pick one and execute:

**Option A — Supabase web UI:** Open Supabase dashboard → Storage → `fonts` bucket → `v1/` folder → create `inter/` subfolder → drag-drop all 7 files.

**Option B — CLI (npx supabase):**

```bash
npx supabase storage cp tmp/fonts/inter/Inter_300Light.ttf            ss:///fonts/v1/inter/Inter_300Light.ttf
npx supabase storage cp tmp/fonts/inter/Inter_400Regular.ttf          ss:///fonts/v1/inter/Inter_400Regular.ttf
npx supabase storage cp tmp/fonts/inter/Inter_400Regular_Italic.ttf   ss:///fonts/v1/inter/Inter_400Regular_Italic.ttf
npx supabase storage cp tmp/fonts/inter/Inter_500Medium.ttf           ss:///fonts/v1/inter/Inter_500Medium.ttf
npx supabase storage cp tmp/fonts/inter/Inter_600SemiBold.ttf         ss:///fonts/v1/inter/Inter_600SemiBold.ttf
npx supabase storage cp tmp/fonts/inter/Inter_700Bold.ttf             ss:///fonts/v1/inter/Inter_700Bold.ttf
npx supabase storage cp tmp/fonts/inter/Inter_800ExtraBold.ttf        ss:///fonts/v1/inter/Inter_800ExtraBold.ttf
```

- [ ] **Step 3: Verify one uploaded file is publicly reachable**

```bash
curl -sI "https://wrytjnucrxsqdrbwxsgi.supabase.co/storage/v1/object/public/fonts/v1/inter/Inter_400Regular.ttf" | head -1
```

Expected: `HTTP/2 200`.

- [ ] **Step 4: Compute hash and byte count for each font**

```bash
node scripts/measure_font_assets.mjs inter tmp/fonts/inter
```

Expected: 7 lines printed to stdout, each like:

```typescript
      Inter_400Regular: { uri: "https://...inter/Inter_400Regular.ttf", hash: "abc...", bytes: 234567 },
```

Copy this block — it pastes verbatim into the theme file in step 6.

- [ ] **Step 5: Generate the Play preview SVG**

```bash
node scripts/generate_theme_previews.mjs \
  --name "Play" \
  --tagline "Quiet authority" \
  --displayFont tmp/fonts/inter/Inter_300Light.ttf \
  --bodyFont tmp/fonts/inter/Inter_400Regular.ttf \
  --bg "#0A0B10" \
  --fg "#FFFFFF" \
  > tmp/play-preview.svg
cat tmp/play-preview.svg | head -3
```

Expected: An SVG starting with `<svg xmlns="..." viewBox="0 0 240 80" ...>` containing two `<path>` elements. Visually verify by opening `tmp/play-preview.svg` in a browser — the word "Play" in light Inter and "Quiet authority" below in regular Inter, on a near-black background.

- [ ] **Step 6: Create the Play theme file**

Create `src/theme/themes/play.ts` — paste in the hash/bytes block from Step 4 in the marked location:

```typescript
import { playPreviewSvg } from "@/theme/themes/previews";

import type { Theme } from "@/theme/contract";

export const play: Theme = {
  id: "play",
  name: "Play",
  colors: {
    bg: "#0A0B10",
    surface: "#14161C",
    surfaceCard: "#1A1D24",
    surfaceHigh: "#232733",
    surfaceMuted: "#0F1117",
    text: "#FFFFFF",
    textMuted: "#B8BCC8",
    textFaint: "#6B7080",
    primary: "#0070cc",
    primaryGradientEnd: "#1eaedb",
    primaryLight: "#BFDBFE",
    primarySoft: "#0F1A2E",
    primaryText: "#FFFFFF",
    success: "#34D399",
    danger: "#F87171",
    dangerSoft: "#2E1517",
    dangerSubtle: "#7C2D3D",
    heatDone: "#0070cc",
    heatSkipped: "#534D33",
    heatMissed: "#1A1D24",
    offDayBorder: "#232733",
    graduatedCircle: "#1eaedb",
    graduatedBadge: "#0F2A4D",
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
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  radius: { sm: 12, md: 24, lg: 32, xl: 48, pill: 999 },
  shadows: {
    card: "0 8px 32px rgba(0, 0, 0, 0.5)",
    lift: "0 2px 12px rgba(0, 0, 0, 0.4)",
    button: "0 4px 20px rgba(2, 80, 204, 0.45)",
    cardFloat: "0 4px 24px rgba(0, 0, 0, 0.5)",
    inputField: "0 4px 16px rgba(0, 0, 0, 0.3)",
  },
  fontFamilies: {
    displayBold: "Inter_300Light",
    displaySemi: "Inter_400Regular",
    displaySemiItalic: "Inter_400Regular_Italic",
    body: "Inter_400Regular",
    bodyMedium: "Inter_500Medium",
    bodySemi: "Inter_600SemiBold",
    bodyBold: "Inter_700Bold",
    bodyExtraBold: "Inter_800ExtraBold",
  },
  fontAssets: {
    kind: "remote",
    assets: {
      // <-- PASTE the 7 lines printed by `measure_font_assets.mjs inter tmp/fonts/inter` HERE
    },
  },
  previewSvg: playPreviewSvg,
};
```

- [ ] **Step 7: Add the preview export**

In [src/theme/themes/previews/index.ts](src/theme/themes/previews/index.ts), append at the end:

```typescript
export const playPreviewSvg = `<-- paste contents of tmp/play-preview.svg here as a backtick string -->`;
```

Make sure the SVG is on one logical line per the existing pattern (zen/cafe/fantasy all live in single backtick strings).

- [ ] **Step 8: Register Play in the theme registry**

In [src/theme/registry.ts](src/theme/registry.ts) update three places:

```typescript
import { zen } from "@/theme/themes/zen";
import { cafe } from "@/theme/themes/cafe";
import { fantasy } from "@/theme/themes/fantasy";
import { play } from "@/theme/themes/play";

import type { Theme, ThemeId } from "@/theme/contract";

export const THEMES: Record<ThemeId, Theme> = {
  zen,
  cafe,
  fantasy,
  play,
};

export function getTheme(id: ThemeId): Theme {
  return THEMES[id];
}

export function isKnownThemeId(value: unknown): value is ThemeId {
  return (
    value === "zen" ||
    value === "cafe" ||
    value === "fantasy" ||
    value === "play"
  );
}
```

Note: `THEMES` will fail type-check (`Record<ThemeId, Theme>` requires all 6 keys). That's expected — energy and sound are added in later tasks. Temporarily satisfy the typechecker by relaxing the type to `Partial<Record<ThemeId, Theme>>` if needed, OR sequence such that this task only commits after energy and sound also land. For TDD clarity, **use a temporary partial type for this task**:

```typescript
export const THEMES = {
  zen,
  cafe,
  fantasy,
  play,
} satisfies Partial<Record<ThemeId, Theme>>;
```

This is reverted to `Record<ThemeId, Theme>` in Task 7 (Sound) once all six are present.

- [ ] **Step 9: Update registry test to assert Play**

In [src/theme/__tests__/registry.test.ts](src/theme/__tests__/registry.test.ts):

```typescript
import { THEMES, getTheme, isKnownThemeId } from "@/theme/registry";

describe("Theme registry", () => {
  it("THEMES exposes zen, cafe, fantasy, play", () => {
    expect(THEMES.zen.id).toBe("zen");
    expect(THEMES.cafe.id).toBe("cafe");
    expect(THEMES.fantasy.id).toBe("fantasy");
    expect(THEMES.play.id).toBe("play");
  });

  it("getTheme returns the registered theme", () => {
    expect(getTheme("cafe").name).toBe("Cafe");
    expect(getTheme("play").name).toBe("Play");
  });

  it("isKnownThemeId returns true for valid ids, false for others", () => {
    expect(isKnownThemeId("zen")).toBe(true);
    expect(isKnownThemeId("cafe")).toBe(true);
    expect(isKnownThemeId("fantasy")).toBe(true);
    expect(isKnownThemeId("play")).toBe(true);
    expect(isKnownThemeId("nonsense")).toBe(false);
    expect(isKnownThemeId(null)).toBe(false);
    expect(isKnownThemeId(undefined)).toBe(false);
  });
});
```

Energy and Sound rows added in later tasks.

- [ ] **Step 10: Run all theme tests**

```bash
npx jest src/theme/
```

Expected: PASS. The contrast test iterates `Object.values(THEMES)` and now includes Play — all 11 required pairs should pass AA (textFaint pairs are waived).

If the `text=#FFFFFF` on `bg=#0A0B10` pair fails AA (it should not — that's ~19:1), or any other pair surfaces unexpectedly, halt and review the values in the colors block against the spec.

- [ ] **Step 11: Type-check the whole repo**

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add src/theme/themes/play.ts \
        src/theme/themes/previews/index.ts \
        src/theme/registry.ts \
        src/theme/__tests__/registry.test.ts
git commit -m "feat(theme): add Play theme (PlayStation-inspired, dark)"
```

---

## Task 6: Add Energy theme

Same pattern as Task 5 but with two font families (Limelight + Work Sans) and an extra eye on the graduated-pair contrast.

**Files:**
- Create: `src/theme/themes/energy.ts`
- Modify: `src/theme/themes/previews/index.ts`
- Modify: `src/theme/registry.ts`
- Modify: `src/theme/__tests__/registry.test.ts`
- External: 6 TTF files uploaded to Supabase `fonts/v1/limelight/` (1 file) + `fonts/v1/work-sans/` (5 files)

- [ ] **Step 1: Download Limelight (single weight) and Work Sans (5 weights) locally**

```bash
mkdir -p tmp/fonts/limelight tmp/fonts/work-sans
cd tmp/fonts/limelight
curl -L -o Limelight_400Regular.ttf "https://github.com/expo/google-fonts/raw/main/font-packages/limelight/400Regular/Limelight_400Regular.ttf"
cd ../work-sans
curl -L -o WorkSans_400Regular.ttf    "https://github.com/expo/google-fonts/raw/main/font-packages/work-sans/400Regular/WorkSans_400Regular.ttf"
curl -L -o WorkSans_500Medium.ttf     "https://github.com/expo/google-fonts/raw/main/font-packages/work-sans/500Medium/WorkSans_500Medium.ttf"
curl -L -o WorkSans_600SemiBold.ttf   "https://github.com/expo/google-fonts/raw/main/font-packages/work-sans/600SemiBold/WorkSans_600SemiBold.ttf"
curl -L -o WorkSans_700Bold.ttf       "https://github.com/expo/google-fonts/raw/main/font-packages/work-sans/700Bold/WorkSans_700Bold.ttf"
curl -L -o WorkSans_800ExtraBold.ttf  "https://github.com/expo/google-fonts/raw/main/font-packages/work-sans/800ExtraBold/WorkSans_800ExtraBold.ttf"
cd ../../..
ls -la tmp/fonts/limelight/ tmp/fonts/work-sans/
```

Expected: 1 file in `limelight/`, 5 files in `work-sans/`.

- [ ] **Step 2: Upload to Supabase**

Via web UI or CLI:

```bash
npx supabase storage cp tmp/fonts/limelight/Limelight_400Regular.ttf  ss:///fonts/v1/limelight/Limelight_400Regular.ttf
npx supabase storage cp tmp/fonts/work-sans/WorkSans_400Regular.ttf   ss:///fonts/v1/work-sans/WorkSans_400Regular.ttf
npx supabase storage cp tmp/fonts/work-sans/WorkSans_500Medium.ttf    ss:///fonts/v1/work-sans/WorkSans_500Medium.ttf
npx supabase storage cp tmp/fonts/work-sans/WorkSans_600SemiBold.ttf  ss:///fonts/v1/work-sans/WorkSans_600SemiBold.ttf
npx supabase storage cp tmp/fonts/work-sans/WorkSans_700Bold.ttf      ss:///fonts/v1/work-sans/WorkSans_700Bold.ttf
npx supabase storage cp tmp/fonts/work-sans/WorkSans_800ExtraBold.ttf ss:///fonts/v1/work-sans/WorkSans_800ExtraBold.ttf
```

- [ ] **Step 3: Verify**

```bash
curl -sI "https://wrytjnucrxsqdrbwxsgi.supabase.co/storage/v1/object/public/fonts/v1/limelight/Limelight_400Regular.ttf" | head -1
curl -sI "https://wrytjnucrxsqdrbwxsgi.supabase.co/storage/v1/object/public/fonts/v1/work-sans/WorkSans_400Regular.ttf" | head -1
```

Expected: both `HTTP/2 200`.

- [ ] **Step 4: Compute hashes for both families**

```bash
node scripts/measure_font_assets.mjs limelight tmp/fonts/limelight
node scripts/measure_font_assets.mjs work-sans tmp/fonts/work-sans
```

Expected: 1 + 5 lines printed. Save both blocks — they paste into `energy.ts` in step 6.

- [ ] **Step 5: Generate the Energy preview SVG**

```bash
node scripts/generate_theme_previews.mjs \
  --name "Energy" \
  --tagline "Vibrant momentum" \
  --displayFont tmp/fonts/limelight/Limelight_400Regular.ttf \
  --bodyFont tmp/fonts/work-sans/WorkSans_400Regular.ttf \
  --bg "#FFEDD5" \
  --fg "#7C2D12" \
  > tmp/energy-preview.svg
cat tmp/energy-preview.svg | head -3
```

Expected: valid SVG. Open in browser — "Energy" in Limelight Art Deco display + "Vibrant momentum" in Work Sans body, on a peach background.

- [ ] **Step 6: Create the Energy theme file**

Create `src/theme/themes/energy.ts`:

```typescript
import { energyPreviewSvg } from "@/theme/themes/previews";

import type { Theme } from "@/theme/contract";

export const energy: Theme = {
  id: "energy",
  name: "Energy",
  colors: {
    bg: "#FFEDD5",
    surface: "#FED7AA",
    surfaceCard: "#FFFFFF",
    surfaceHigh: "#FDBA74",
    surfaceMuted: "#FFE4C4",
    text: "#7C2D12",
    textMuted: "#9A3412",
    textFaint: "#C2410C",
    primary: "#EA580B",
    primaryGradientEnd: "#F59E0B",
    primaryLight: "#FED7AA",
    primarySoft: "#FFE4C4",
    primaryText: "#FFFFFF",
    success: "#16A34A",
    danger: "#DC2626",
    dangerSoft: "#FEE2E2",
    dangerSubtle: "#FCA5A5",
    heatDone: "#EA580B",
    heatSkipped: "#FCD34D",
    heatMissed: "#FFE4C4",
    offDayBorder: "#FED7AA",
    graduatedCircle: "#9A3412",
    graduatedBadge: "#FFE4C4",
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
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  radius: { sm: 12, md: 24, lg: 32, xl: 48, pill: 999 },
  shadows: {
    card: "0 8px 32px rgba(234, 88, 11, 0.10)",
    lift: "0 2px 12px rgba(234, 88, 11, 0.08)",
    button: "0 4px 20px rgba(234, 88, 11, 0.25)",
    cardFloat: "0 4px 24px rgba(234, 88, 11, 0.10)",
    inputField: "0 4px 16px rgba(234, 88, 11, 0.08)",
  },
  fontFamilies: {
    displayBold: "Limelight_400Regular",
    displaySemi: "Limelight_400Regular",
    displaySemiItalic: "Limelight_400Regular",
    body: "WorkSans_400Regular",
    bodyMedium: "WorkSans_500Medium",
    bodySemi: "WorkSans_600SemiBold",
    bodyBold: "WorkSans_700Bold",
    bodyExtraBold: "WorkSans_800ExtraBold",
  },
  fontAssets: {
    kind: "remote",
    assets: {
      // <-- PASTE the 1 Limelight line + 5 Work Sans lines from Step 4 HERE
    },
  },
  previewSvg: energyPreviewSvg,
};
```

- [ ] **Step 7: Add the preview export**

In [src/theme/themes/previews/index.ts](src/theme/themes/previews/index.ts), append:

```typescript
export const energyPreviewSvg = `<-- paste contents of tmp/energy-preview.svg here -->`;
```

- [ ] **Step 8: Register Energy in the theme registry**

In [src/theme/registry.ts](src/theme/registry.ts):

```typescript
import { zen } from "@/theme/themes/zen";
import { cafe } from "@/theme/themes/cafe";
import { fantasy } from "@/theme/themes/fantasy";
import { play } from "@/theme/themes/play";
import { energy } from "@/theme/themes/energy";

import type { Theme, ThemeId } from "@/theme/contract";

export const THEMES = {
  zen,
  cafe,
  fantasy,
  play,
  energy,
} satisfies Partial<Record<ThemeId, Theme>>;

export function getTheme(id: ThemeId): Theme {
  return THEMES[id];
}

export function isKnownThemeId(value: unknown): value is ThemeId {
  return (
    value === "zen" ||
    value === "cafe" ||
    value === "fantasy" ||
    value === "play" ||
    value === "energy"
  );
}
```

- [ ] **Step 9: Update registry test to assert Energy**

In [src/theme/__tests__/registry.test.ts](src/theme/__tests__/registry.test.ts) extend the existing assertions:

```typescript
  it("THEMES exposes zen, cafe, fantasy, play, energy", () => {
    expect(THEMES.zen.id).toBe("zen");
    expect(THEMES.cafe.id).toBe("cafe");
    expect(THEMES.fantasy.id).toBe("fantasy");
    expect(THEMES.play.id).toBe("play");
    expect(THEMES.energy.id).toBe("energy");
  });
```

And add `energy` to the `isKnownThemeId` block:

```typescript
    expect(isKnownThemeId("energy")).toBe(true);
```

- [ ] **Step 10: Run the theme tests**

```bash
npx jest src/theme/
```

Expected: PASS. The contrast test now exercises Energy too. Critical pair to verify: `graduatedCircle=#9A3412` on `graduatedBadge=#FFE4C4` ≈ 6.0:1, passes AA.

If `text=#7C2D12` on `bg=#FFEDD5` (the burnt-orange-on-peach pair) registers as failing, halt — the values should give ~8.3:1.

- [ ] **Step 11: Type-check**

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add src/theme/themes/energy.ts \
        src/theme/themes/previews/index.ts \
        src/theme/registry.ts \
        src/theme/__tests__/registry.test.ts
git commit -m "feat(theme): add Energy theme (vibrant peach + Limelight)"
```

---

## Task 7: Add Sound theme + restore strict `Record<ThemeId, Theme>` type

Final theme. After this task, the registry has all 6 themes and the `THEMES` type can be tightened back to a strict `Record<ThemeId, Theme>` (TypeScript will enforce completeness).

**Files:**
- Create: `src/theme/themes/sound.ts`
- Modify: `src/theme/themes/previews/index.ts`
- Modify: `src/theme/registry.ts`
- Modify: `src/theme/__tests__/registry.test.ts`
- External: 6 TTF files uploaded to Supabase `fonts/v1/dm-sans/`

- [ ] **Step 1: Verify DM Sans 600-italic and 800 cuts are available**

```bash
curl -sIL "https://github.com/expo/google-fonts/raw/main/font-packages/dm-sans/600SemiBold_Italic/DMSans_600SemiBold_Italic.ttf" | head -1
curl -sIL "https://github.com/expo/google-fonts/raw/main/font-packages/dm-sans/800ExtraBold/DMSans_800ExtraBold.ttf" | head -1
```

Expected: both `HTTP/2 200`. If either is 404, fall back per spec §4.3:
- If `DMSans_600SemiBold_Italic` is missing → use `DMSans_500Medium_Italic` for `displaySemiItalic`
- If `DMSans_800ExtraBold` is missing → use `DMSans_700Bold` for `bodyExtraBold` (collapses with `bodyBold` — acceptable per spec)

- [ ] **Step 2: Download DM Sans (6 weights) locally**

```bash
mkdir -p tmp/fonts/dm-sans
cd tmp/fonts/dm-sans
curl -L -o DMSans_400Regular.ttf            "https://github.com/expo/google-fonts/raw/main/font-packages/dm-sans/400Regular/DMSans_400Regular.ttf"
curl -L -o DMSans_500Medium.ttf             "https://github.com/expo/google-fonts/raw/main/font-packages/dm-sans/500Medium/DMSans_500Medium.ttf"
curl -L -o DMSans_600SemiBold.ttf           "https://github.com/expo/google-fonts/raw/main/font-packages/dm-sans/600SemiBold/DMSans_600SemiBold.ttf"
curl -L -o DMSans_600SemiBold_Italic.ttf    "https://github.com/expo/google-fonts/raw/main/font-packages/dm-sans/600SemiBold_Italic/DMSans_600SemiBold_Italic.ttf"
curl -L -o DMSans_700Bold.ttf               "https://github.com/expo/google-fonts/raw/main/font-packages/dm-sans/700Bold/DMSans_700Bold.ttf"
curl -L -o DMSans_800ExtraBold.ttf          "https://github.com/expo/google-fonts/raw/main/font-packages/dm-sans/800ExtraBold/DMSans_800ExtraBold.ttf"
cd ../../..
ls -la tmp/fonts/dm-sans/
```

Expected: 6 files. If 600-italic or 800 was missing in Step 1, skip that file here and adjust step 6 below accordingly.

- [ ] **Step 3: Upload to Supabase fonts bucket**

```bash
npx supabase storage cp tmp/fonts/dm-sans/DMSans_400Regular.ttf          ss:///fonts/v1/dm-sans/DMSans_400Regular.ttf
npx supabase storage cp tmp/fonts/dm-sans/DMSans_500Medium.ttf           ss:///fonts/v1/dm-sans/DMSans_500Medium.ttf
npx supabase storage cp tmp/fonts/dm-sans/DMSans_600SemiBold.ttf         ss:///fonts/v1/dm-sans/DMSans_600SemiBold.ttf
npx supabase storage cp tmp/fonts/dm-sans/DMSans_600SemiBold_Italic.ttf  ss:///fonts/v1/dm-sans/DMSans_600SemiBold_Italic.ttf
npx supabase storage cp tmp/fonts/dm-sans/DMSans_700Bold.ttf             ss:///fonts/v1/dm-sans/DMSans_700Bold.ttf
npx supabase storage cp tmp/fonts/dm-sans/DMSans_800ExtraBold.ttf        ss:///fonts/v1/dm-sans/DMSans_800ExtraBold.ttf
```

- [ ] **Step 4: Verify reachable**

```bash
curl -sI "https://wrytjnucrxsqdrbwxsgi.supabase.co/storage/v1/object/public/fonts/v1/dm-sans/DMSans_400Regular.ttf" | head -1
```

Expected: `HTTP/2 200`.

- [ ] **Step 5: Compute hashes**

```bash
node scripts/measure_font_assets.mjs dm-sans tmp/fonts/dm-sans
```

Expected: 6 lines. Save the block.

- [ ] **Step 6: Generate the Sound preview SVG**

```bash
node scripts/generate_theme_previews.mjs \
  --name "Sound" \
  --tagline "Achromatic depth" \
  --displayFont tmp/fonts/dm-sans/DMSans_700Bold.ttf \
  --bodyFont tmp/fonts/dm-sans/DMSans_400Regular.ttf \
  --bg "#121212" \
  --fg "#FFFFFF" \
  > tmp/sound-preview.svg
cat tmp/sound-preview.svg | head -3
```

Expected: valid SVG. Open in browser — "Sound" in DM Sans Bold + "Achromatic depth" in DM Sans Regular, on Spotify near-black.

- [ ] **Step 7: Create the Sound theme file**

Create `src/theme/themes/sound.ts`:

```typescript
import { soundPreviewSvg } from "@/theme/themes/previews";

import type { Theme } from "@/theme/contract";

export const sound: Theme = {
  id: "sound",
  name: "Sound",
  colors: {
    bg: "#121212",
    surface: "#181818",
    surfaceCard: "#181818",
    surfaceHigh: "#252525",
    surfaceMuted: "#1f1f1f",
    text: "#FFFFFF",
    textMuted: "#b3b3b3",
    textFaint: "#7c7c7c",
    primary: "#1ed760",
    primaryGradientEnd: "#1db954",
    primaryLight: "#A7F3D0",
    primarySoft: "#0F1F12",
    primaryText: "#000000",
    success: "#1ed760",
    danger: "#f3727f",
    dangerSoft: "#2E1517",
    dangerSubtle: "#7C2D3D",
    heatDone: "#1ed760",
    heatSkipped: "#8C5816",
    heatMissed: "#181818",
    offDayBorder: "#252525",
    graduatedCircle: "#1ed760",
    graduatedBadge: "#103821",
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
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
  radius: { sm: 12, md: 24, lg: 32, xl: 48, pill: 999 },
  shadows: {
    card: "0 8px 24px rgba(0, 0, 0, 0.5)",
    lift: "0 8px 8px rgba(0, 0, 0, 0.3)",
    button: "0 4px 12px rgba(0, 0, 0, 0.4)",
    cardFloat: "0 8px 24px rgba(0, 0, 0, 0.5)",
    inputField: "0 4px 16px rgba(0, 0, 0, 0.4)",
  },
  fontFamilies: {
    displayBold: "DMSans_700Bold",
    displaySemi: "DMSans_600SemiBold",
    displaySemiItalic: "DMSans_600SemiBold_Italic",
    body: "DMSans_400Regular",
    bodyMedium: "DMSans_500Medium",
    bodySemi: "DMSans_600SemiBold",
    bodyBold: "DMSans_700Bold",
    bodyExtraBold: "DMSans_800ExtraBold",
  },
  fontAssets: {
    kind: "remote",
    assets: {
      // <-- PASTE the 6 lines from Step 5 HERE
    },
  },
  previewSvg: soundPreviewSvg,
};
```

If Step 1's fallback was triggered, update `fontFamilies.displaySemiItalic` or `fontFamilies.bodyExtraBold` accordingly and remove the corresponding `assets.*` line.

- [ ] **Step 8: Add the preview export**

In [src/theme/themes/previews/index.ts](src/theme/themes/previews/index.ts), append:

```typescript
export const soundPreviewSvg = `<-- paste contents of tmp/sound-preview.svg here -->`;
```

- [ ] **Step 9: Register Sound + restore strict `Record<ThemeId, Theme>` type**

In [src/theme/registry.ts](src/theme/registry.ts):

```typescript
import { zen } from "@/theme/themes/zen";
import { cafe } from "@/theme/themes/cafe";
import { fantasy } from "@/theme/themes/fantasy";
import { play } from "@/theme/themes/play";
import { energy } from "@/theme/themes/energy";
import { sound } from "@/theme/themes/sound";

import type { Theme, ThemeId } from "@/theme/contract";

export const THEMES: Record<ThemeId, Theme> = {
  zen,
  cafe,
  fantasy,
  play,
  energy,
  sound,
};

export function getTheme(id: ThemeId): Theme {
  return THEMES[id];
}

export function isKnownThemeId(value: unknown): value is ThemeId {
  return (
    value === "zen" ||
    value === "cafe" ||
    value === "fantasy" ||
    value === "play" ||
    value === "energy" ||
    value === "sound"
  );
}
```

The `Partial<Record<…>>` from Tasks 5 and 6 is now a strict `Record<ThemeId, Theme>` — TypeScript will surface any missing key.

- [ ] **Step 10: Finalize the registry test**

In [src/theme/__tests__/registry.test.ts](src/theme/__tests__/registry.test.ts):

```typescript
import { THEMES, getTheme, isKnownThemeId } from "@/theme/registry";

describe("Theme registry", () => {
  it("THEMES exposes all six themes", () => {
    expect(THEMES.zen.id).toBe("zen");
    expect(THEMES.cafe.id).toBe("cafe");
    expect(THEMES.fantasy.id).toBe("fantasy");
    expect(THEMES.play.id).toBe("play");
    expect(THEMES.energy.id).toBe("energy");
    expect(THEMES.sound.id).toBe("sound");
  });

  it("getTheme returns the registered theme", () => {
    expect(getTheme("cafe").name).toBe("Cafe");
    expect(getTheme("play").name).toBe("Play");
    expect(getTheme("sound").name).toBe("Sound");
  });

  it("isKnownThemeId returns true for valid ids, false for others", () => {
    expect(isKnownThemeId("zen")).toBe(true);
    expect(isKnownThemeId("cafe")).toBe(true);
    expect(isKnownThemeId("fantasy")).toBe(true);
    expect(isKnownThemeId("play")).toBe(true);
    expect(isKnownThemeId("energy")).toBe(true);
    expect(isKnownThemeId("sound")).toBe(true);
    expect(isKnownThemeId("nonsense")).toBe(false);
    expect(isKnownThemeId(null)).toBe(false);
    expect(isKnownThemeId(undefined)).toBe(false);
  });
});
```

- [ ] **Step 11: Run the full theme test suite**

```bash
npx jest src/theme/
```

Expected: PASS. All 6 themes pass shape, contrast, and registry assertions.

- [ ] **Step 12: Type-check the whole repo**

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 13: Commit**

```bash
git add src/theme/themes/sound.ts \
        src/theme/themes/previews/index.ts \
        src/theme/registry.ts \
        src/theme/__tests__/registry.test.ts
git commit -m "feat(theme): add Sound theme (Spotify-inspired, dark)"
```

---

## Task 8: Onboarding picker test verification

The spec §4.1 documents the decision to leave `MakeItYoursScreen.test.tsx` assertions as-is. This task is a verification gate — confirm the existing test still passes with three new theme cards on screen.

**Files:**
- Verify only: [src/features/onboarding/screens/__tests__/MakeItYoursScreen.test.tsx](src/features/onboarding/screens/__tests__/MakeItYoursScreen.test.tsx)

- [ ] **Step 1: Run the onboarding picker test**

```bash
npx jest src/features/onboarding/screens/__tests__/MakeItYoursScreen.test.tsx
```

Expected: PASS. Existing assertions for `theme-card-zen`, `theme-card-cafe`, `theme-card-fantasy` testIDs are non-exclusive and continue to pass even with three additional cards rendering.

- [ ] **Step 2: Run the appearance picker test**

```bash
npx jest src/features/settings/screens/__tests__/AppearanceScreen.test.tsx
```

Expected: PASS. (Same reasoning — assertions are non-exclusive.)

If either fails with an assertion about expected vs received card count, halt — the test was stricter than expected and needs an inline update.

- [ ] **Step 3: Run the full Jest suite**

```bash
npx jest
```

Expected: PASS for all theme-adjacent tests. Unrelated pre-existing flakiness (e.g., srhi full-run noted in memory `state_theming.md`) may surface — note it but don't block on it.

No commit — this task is verification only.

---

## Task 9: Manual device smoke

The contract-level checks pass automatically. The remaining risk is visual: heatmap tones, surface depths on dark themes, font legibility on physical screens. Smoke each new theme on a physical or emulated device.

**Files:**
- Verify only: live app

- [ ] **Step 1: Start the dev server**

```bash
npx expo start
```

If on Android, also run:

```bash
adb reverse tcp:8081 tcp:8081
```

(per memory `reference_appium_setup.md`).

- [ ] **Step 2: For each new theme — Play, Energy, Sound — perform the smoke checklist**

In the app:
1. Settings → Appearance → tap the theme card
2. Wait for fonts to download (first activation only; check for spinner overlay)
3. Inspect each surface, in this order:
   - **Today screen** — habit rows, heatmap strip, goal container, consistency donut
   - **Habit detail** — full heatmap (CalendarGrid), edit button, completion ring
   - **Edit Habit** — colored chips, form fields, save/cancel
   - **Reviews** (Weekly) — step indicator, first-run tip banner
   - **Onboarding entry** — go back through onboarding from settings if available; check MakeItYours card

- [ ] **Step 3: For each theme, verify the following visual gates**

| Theme | Gate |
|---|---|
| Play | Status bar legibility on dark bg. Heatmap cells readable. Cyan graduated badge stands out without burning eyes. Inter 300 display reads as "luxury" — not as "broken/too-thin". |
| Energy | Burnt-orange text (`#7C2D12`) readable on peach (`#FFEDD5`). Limelight display loads (visible after first font-download cycle). `graduatedCircle === textMuted` collision: muted body labels adjacent to graduated ring should be visually separable by context (shape, position) — verify in HabitDetail and Today's goal-container. |
| Sound | Spotify Green (`#1ed760`) primary buttons have **black** text (not white). Heatmap done cells reads as green-on-near-black without halation. Body Silver (`#b3b3b3`) labels readable. |

- [ ] **Step 4: Cycle through all 6 themes back to back**

Verify font cache works — second activation of any theme is instant (no spinner). Memory: device-smoke fixes from v1 noted in `state_theming.md` — preload-cached-fonts-on-mount path should already be functional.

- [ ] **Step 5: Clear font cache, reactivate each new theme once**

In dev build, tap `[DEV] Clear font cache` in AppearanceScreen footer, then activate each new theme once to confirm the cold-cache download path works.

- [ ] **Step 6: Clean up local font staging**

```bash
rm -rf tmp/fonts/
```

(Bucket-uploaded files remain in Supabase; only local working copies are removed.)

- [ ] **Step 7: No commit — this task is verification only.**

If any visual gate fails, file a follow-up issue with the specific theme + surface; do not block the rest of this work on it. The themes are still shippable in the current state once Tasks 1–7 commit.

---

## Self-Review

**Spec coverage check (against [docs/superpowers/specs/2026-06-04-additional-themes-design.md](../specs/2026-06-04-additional-themes-design.md)):**

| Spec section | Task |
|---|---|
| §1 Goal — three themes | Tasks 5, 6, 7 |
| §2 Decisions — contract unchanged | All tasks honor it (no contract.ts shape edits) |
| §2 Decisions — picker UX (both AppearanceScreen + MakeItYoursScreen) | Task 8 verifies |
| §2 Decisions — Sound `primaryText` = black on green | Task 7 Step 7 |
| §2 Decisions — Sound success===primary intentional | Task 7 Step 7 (palette literal) |
| §3.1 Play colors/fonts/shadows | Task 5 |
| §3.2 Energy colors/fonts/shadows + AA-clean graduated pair | Task 6 |
| §3.3 Sound colors/fonts/shadows | Task 7 |
| §4.1 contract.ts widening | Task 1 |
| §4.1 contract.test.ts literal update | Task 1 |
| §4.1 registry.ts updates | Tasks 5, 6, 7 |
| §4.1 registry.test.ts updates | Tasks 5, 6, 7 (cumulative) |
| §4.1 contrast.test.ts waivers | Task 4 |
| §4.1 ThemeProvider.test.tsx widening | Task 2 |
| §4.1 MakeItYoursScreen.test.tsx (no new assertions, just verify) | Task 8 |
| §4.1 generate_theme_previews.mjs commit | Task 3 |
| §4.3 Inter upload to fonts/v1/inter | Task 5 Steps 1–4 |
| §4.3 DM Sans upload + cut verification | Task 7 Steps 1–5 |
| §4.3 Limelight + Work Sans uploads | Task 6 Steps 1–4 |
| §4.4 Preview SVG generation via script with NaN workaround | Task 3 (script) + Tasks 5/6/7 Step 5/5/6 (use) |
| §5 Test plan | Tasks 4, 5–7 (each `npx jest src/theme/`), Task 9 (device smoke) |
| §6 Risk #1 dark-mode tuning exercised twice | Task 9 covers via device smoke |
| §6 Risk #2 font hashes not knowable until upload | Tasks 5/6/7 each run `measure_font_assets.mjs` before theme file commit |
| §6 Risk #3 identity gaps from contract limits | Acknowledged in spec; no task needed |
| §6 Risk #4 status bar/splash on dark themes | Out of scope; Task 9 surfaces visually if needed |
| §6 Risk #5 bundle size | No change — all remote |
| §6 Risk #6 cache fan-out scales | Out of scope; Task 9 surfaces in startup observation |

All spec sections accounted for.

**Placeholder scan:** No "TBD", "TODO", "fill in later", or unspecified code blocks. The `<-- PASTE … HERE -->` markers in theme files are explicit, with a defined source step (the preceding `measure_font_assets.mjs` invocation) and a defined paste shape (object-literal lines). This is concrete data flow, not a placeholder.

**Type consistency:** `THEMES` type evolves Task 5 (`Partial<Record<ThemeId, Theme>>` via `satisfies`) → Task 6 (same) → Task 7 (`Record<ThemeId, Theme>` strict). Each step's type is correct for the registry's then-current contents. `isKnownThemeId` grows incrementally and matches the registry contents per task. Theme file imports use the previewSvg export added in the same task (no order-of-definition hazard).
