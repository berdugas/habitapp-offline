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
  // charToGlyph per code-point bypasses the OpenType shaper entirely, which
  // throws on some fonts' substitution tables (Plus Jakarta Sans, Inter).
  // Returns SVG path `d` string.
  const glyphs = Array.from(text).map((ch) => font.charToGlyph(ch));
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
