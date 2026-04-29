// Polyfill for crypto.randomUUID() on Android (Hermes).
// Hermes exposes global.crypto in newer versions but it may not be
// accessible as a bare `crypto` identifier, and older builds omit
// randomUUID() entirely. This polyfill covers both gaps.
//
// Math.random()-based UUID v4 is not cryptographically strong, but
// collision probability (~2^-122) is negligible for local SQLite row IDs.
function uuidV4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const g = globalThis as Record<string, unknown>;

if (typeof g["crypto"] === "undefined") {
  g["crypto"] = { randomUUID: uuidV4 };
} else if (typeof (g["crypto"] as Record<string, unknown>)["randomUUID"] === "undefined") {
  (g["crypto"] as Record<string, unknown>)["randomUUID"] = uuidV4;
}
