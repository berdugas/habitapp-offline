/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  setupFiles: ["<rootDir>/src/tests/setup/globals.ts"],
  setupFilesAfterEnv: ["@testing-library/jest-native/extend-expect"],
  testMatch: [
    "**/src/tests/**/*.test.ts",
    "**/src/tests/**/*.test.tsx",
    "**/src/lib/**/__tests__/**/*.test.ts",
    "**/src/features/**/__tests__/**/*.test.ts",
    "**/src/features/**/__tests__/**/*.test.tsx",
    "**/src/components/**/__tests__/**/*.test.tsx",
    "**/src/utils/**/__tests__/**/*.test.ts",
  ],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native|expo(nent)?|@expo(nent)?/.*|expo-router|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg))"
  ],
  moduleNameMapper: {
    "^expo-sqlite$": "<rootDir>/src/tests/setup/sqliteTestAdapter",
    "^react-native-safe-area-context$": "<rootDir>/src/tests/setup/safeAreaContextMock.tsx",
    "^@/(.*)$": "<rootDir>/src/$1"
  }
};
