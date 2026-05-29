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

// The longest an identity phrase may be once cleaned. Matches the existing
// identity_phrase cap enforced by the habit validator (src/features/habits/
// validators.ts), so create / edit / rename all agree on the limit.
export const MAX_IDENTITY_PHRASE_LENGTH = 240;

/**
 * Clean a user-typed identity phrase: trim, collapse internal whitespace,
 * lowercase, and strip redundant sentence-starters ("become", "I want to be",
 * etc.). The cleaned value is used verbatim after the "Become " display prefix,
 * so we deliberately do NOT insert an article — typing "healthy" yields
 * "Become healthy", and a user who wants "Become a runner" types the "a".
 *
 * Lowercasing is intentional: it keeps "Read the Bible" and "read the bible"
 * from fragmenting into two separate goals (goals are grouped by exact phrase),
 * and matches the app's established lowercase identity style.
 */
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

  return core;
}

/**
 * True when a typed draft cleans to a usable identity phrase: at least 2
 * characters and no longer than the cap. Validates the CLEANED value, not the
 * raw input — "become a" passes a naive raw length check but cleans to "a".
 */
export function isValidIdentityPhraseDraft(raw: string): boolean {
  const cleaned = normaliseBecomingPhrase(raw);
  return cleaned.length >= 2 && cleaned.length <= MAX_IDENTITY_PHRASE_LENGTH;
}
