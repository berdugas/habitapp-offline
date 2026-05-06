const VOWELS = new Set(["a", "e", "i", "o", "u"]);

const ARTICLE_PREFIXES = [
  "a ",
  "an ",
  "the ",
  "someone",
  "people",
  "those ",
  "this ",
  "that ",
  "my ",
  "our ",
];

// Ordered longest-first to prevent shorter prefixes swallowing part of a longer one
const STRIP_PREFIXES = [
  "i want to become ",
  "i want to be ",
  "i am going to be ",
  "i'm going to be ",
  "i am ",
  "i'm ",
  "becoming ",
  "become ",
];

export function normaliseBecomingPhrase(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return trimmed;

  let core = trimmed.toLowerCase();

  for (const prefix of STRIP_PREFIXES) {
    if (core.startsWith(prefix)) {
      core = core.slice(prefix.length).trimStart();
      break;
    }
  }

  if (!core) return "";

  if (ARTICLE_PREFIXES.some((p) => core.startsWith(p))) {
    return core;
  }

  const article = VOWELS.has(core[0]) ? "an " : "a ";
  return article + core;
}
