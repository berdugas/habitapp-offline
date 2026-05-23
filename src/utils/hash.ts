// Stable, opaque, non-cryptographic hash for analytics segmentation. Use
// when you need a small string identifier derived from user-typed content
// (like a goal's identityPhrase) without leaking the content itself to
// the analytics warehouse. FNV-1a 32-bit is chosen because:
//
//  - synchronous (no Promise plumbing in call sites)
//  - no new dependency (crypto.subtle isn't reliable in RN; expo-crypto
//    would be overkill for an opaque-id use case)
//  - well-distributed for short string inputs (well below the 2^32
//    collision floor for any realistic per-user goal count)
//  - stable across platforms: relies only on charCodeAt + Math.imul,
//    both of which behave identically on iOS, Android, and the Jest
//    Node runtime
//
// Collisions are theoretically possible but the use case (goal_id in
// PostHog events) is segmentation, not authentication. If two distinct
// identity phrases hash to the same value the funnel buckets blur
// slightly; nothing breaks.

const FNV_OFFSET_BASIS_32 = 0x811c9dc5;
const FNV_PRIME_32 = 0x01000193;

export function hashIdentityPhrase(phrase: string): string {
  let hash = FNV_OFFSET_BASIS_32;
  for (let i = 0; i < phrase.length; i++) {
    hash ^= phrase.charCodeAt(i);
    // Math.imul keeps the multiplication inside 32-bit signed semantics,
    // which is required for FNV-1a's defined behavior. Plain `*` would
    // overflow into a float and produce a different hash than other
    // language implementations of FNV-1a.
    hash = Math.imul(hash, FNV_PRIME_32);
  }
  // Convert signed int32 back to unsigned, then hex-encode with a fixed
  // 8-char width so downstream consumers can rely on length.
  return (hash >>> 0).toString(16).padStart(8, "0");
}
