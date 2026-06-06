// Usage:
//   node scripts/measure_font_assets.mjs <family-slug> <local-dir> [<bucket-prefix>]
// Example:
//   node scripts/measure_font_assets.mjs inter tmp/fonts/inter
//
// Walks the local-dir for *.ttf, computes SHA256 + byte count, and prints a
// TypeScript object literal ready to paste into a theme file's fontAssets.assets.
// Bucket prefix defaults to: https://wrytjnucrxsqdrbwxsgi.supabase.co/storage/v1/object/public/fonts/v1/<family-slug>/<filename>

import { createHash } from "node:crypto";
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
