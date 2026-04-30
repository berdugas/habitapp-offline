const VERB_TO_AGENT_NOUN: Record<string, string> = {
  runs: "runner",
  reads: "reader",
  writes: "writer",
  meditates: "meditator",
  journals: "journaler",
  walks: "walker",
  cooks: "cook",
  exercises: "exerciser",
  swims: "swimmer",
  cycles: "cyclist",
  draws: "drawer",
  paints: "painter",
  stretches: "stretcher",
  practices: "practitioner",
  sleeps: "sleeper",
};

/**
 * Best-effort extraction of an identity noun from a "becoming" phrase.
 * Returns null when the phrase doesn't match any known pattern.
 *
 * Patterns tried in order:
 *   1. "a [word] person"    → [word]    e.g. "a calmer person" → "calmer"
 *   2. "a [word]"           → [word]    e.g. "a runner" → "runner"
 *   3. "someone who [verb]" looked up in VERB_TO_AGENT_NOUN
 *
 * Pattern (1) runs before (2) because (2) would otherwise match
 * "a calmer" and return "calmer" without the trailing "person" check.
 */
export function extractIdentityNoun(phrase: string): string | null {
  const trimmed = phrase.trim().toLowerCase();
  if (trimmed.length === 0) return null;

  const personMatch = trimmed.match(/^a\s+(\S+)\s+person$/);
  if (personMatch) return personMatch[1];

  const articleMatch = trimmed.match(/^a\s+(\S+)$/);
  if (articleMatch) return articleMatch[1];

  const someoneMatch = trimmed.match(/^someone\s+who\s+(\S+)/);
  if (someoneMatch) {
    const verb = someoneMatch[1];
    return VERB_TO_AGENT_NOUN[verb] ?? null;
  }

  return null;
}

export { VERB_TO_AGENT_NOUN };
