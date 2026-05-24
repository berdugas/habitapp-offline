// Auto-loaded by jest for any import of @react-native-async-storage/async-storage.
// Delegates to the package's official in-memory mock — implements the full
// AsyncStorage surface against a JS Map, so tests can exercise get/set/clear
// paths without a real native module. Mirrors the __mocks__/posthog-react-native.ts
// pattern already used in this repo.
//
// Source: https://react-native-async-storage.github.io/async-storage/docs/advanced/jest

// eslint-disable-next-line @typescript-eslint/no-require-imports
module.exports = require("@react-native-async-storage/async-storage/jest/async-storage-mock");
