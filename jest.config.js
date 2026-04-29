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
  ],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native|expo(nent)?|@expo(nent)?/.*|expo-router|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg))"
  ],
  moduleNameMapper: {
    "^expo-sqlite$": "<rootDir>/src/tests/setup/sqliteTestAdapter",
    "^@/(.*)$": "<rootDir>/src/$1"
  }
};
