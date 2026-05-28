// Expo dynamic config. Replaces app.json so that telemetry credentials
// (Sentry DSN, PostHog API key + host) can be sourced from environment
// variables at build time — static JSON cannot read process.env.
//
// CJS (`module.exports =`) chosen over `export default` because the
// project's package.json has no `"type": "module"` declaration; CJS is
// unambiguous and works in every Expo SDK + Node version.
module.exports = ({ config }) => ({
  ...config,
  expo: {
    name: "Habitapp",
    slug: "habit-builder",
    version: "1.0.0",
    scheme: "habitapp",
    orientation: "portrait",
    icon: "./assets/icons/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    plugins: [
      "expo-router",
      "expo-font",
      "expo-sqlite",
      "expo-notifications",
      "@react-native-community/datetimepicker",
      "@sentry/react-native",
    ],
    splash: {
      image: "./assets/icons/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#fbf9f5",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.berdugas.habits",
    },
    android: {
      package: "com.berdugas.habits",
      adaptiveIcon: {
        foregroundImage: "./assets/icons/adaptive-icon.png",
        backgroundColor: "#fbf9f5",
      },
      edgeToEdgeEnabled: false,
      predictiveBackGestureEnabled: false,
    },
    web: {
      favicon: "./assets/icons/favicon.png",
      bundler: "metro",
    },
    extra: {
      router: {},
      eas: {
        projectId: "a6076041-eb28-4ded-affc-589659dc05f4",
      },
      sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? "",
      posthogApiKey: process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? "",
      posthogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "",
      // Boolean from string: only the literal "true" enables dev telemetry.
      // Anything else (including unset) leaves it off. Prod builds always
      // emit regardless of this flag — see src/services/posthog.ts.
      telemetryInDev: process.env.EXPO_PUBLIC_TELEMETRY_IN_DEV === "true",
    },
  },
});
