const KEYWORD_PLACEHOLDERS: [string, string][] = [
  ["run", "Run for 10 minutes"],
  ["read", "Read one page"],
  ["writ", "Write one sentence"],
  ["medit", "Sit quietly for one minute"],
  ["calm", "Take three slow breaths"],
  ["sleep", "Be in bed by 10:30pm"],
  ["draw", "Sketch for two minutes"],
  ["walk", "Walk for ten minutes"],
];

const FALLBACK = "Take one small action";

export function getDailyActionPlaceholder(becomingPhrase: string): string {
  if (!becomingPhrase.trim()) {
    return FALLBACK;
  }
  const lower = becomingPhrase.toLowerCase();
  for (const [keyword, placeholder] of KEYWORD_PLACEHOLDERS) {
    if (lower.includes(keyword)) {
      return placeholder;
    }
  }
  return FALLBACK;
}
