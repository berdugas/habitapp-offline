import { webcrypto } from "node:crypto";

// Polyfill globalThis.crypto so repositories can call crypto.randomUUID()
// in the Node/Jest environment (available natively in Node 19+; this covers
// older runtimes without conditional logic).
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    writable: false,
    configurable: true,
  });
}
