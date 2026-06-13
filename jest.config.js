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
    "**/src/theme/**/__tests__/**/*.test.ts",
    "**/src/theme/**/__tests__/**/*.test.tsx",
    "**/src/services/**/__tests__/**/*.test.ts",
  ],
  // Sibling worktrees under .claude/worktrees/* contain their own checked-out
  // copies of src/ that match the testMatch globs above. Without ignoring
  // them, jest-haste-map sees duplicate mocks and tests, and runs stale
  // assertions from those worktrees.
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/.claude/"],
  modulePathIgnorePatterns: ["<rootDir>/.claude/"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native|expo(nent)?|@expo(nent)?/.*|expo-router|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/.*|posthog-react-native|@posthog/.*|native-base|react-native-svg))"
  ],
  moduleNameMapper: {
    "^expo-sqlite$": "<rootDir>/src/tests/setup/sqliteTestAdapter",
    "^react-native-safe-area-context$": "<rootDir>/src/tests/setup/safeAreaContextMock.tsx",
    "^@/(.*)$": "<rootDir>/src/$1"
  }
};
