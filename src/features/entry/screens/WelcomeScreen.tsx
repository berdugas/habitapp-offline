import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { AppLogo } from "@/components/branding/AppLogo";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";

export default function WelcomeScreen() {
  return (
    <View style={styles.screen}>
      {/* Header: small logo + app name */}
      <View style={styles.header}>
        <AppLogo size={24} />
        <Text style={styles.appName}>Habitapp</Text>
      </View>

      {/* Headline block */}
      <View style={styles.heroBlock}>
        <Text style={styles.headline}>Small actions.{"\n"}Real habits.</Text>
        <Text style={styles.subhead}>
          Start with one small habit.{"\n"}We'll guide you every day.
        </Text>
      </View>

      {/* Centered animated logo */}
      <View style={styles.logoContainer}>
        <AppLogo size={120} animated />
      </View>

      {/* Bottom CTAs */}
      <View style={styles.actions}>
        <PrimaryButton
          label="Start building"
          showArrow
          onPress={() => router.push("/(auth)/sign-up")}
        />
        <SecondaryButton
          label="Log in"
          onPress={() => router.push("/(auth)/sign-in")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingTop: 20,
    paddingHorizontal: spacing.xl,
    marginBottom: 48,
  },
  appName: {
    fontFamily: fontFamilies.displaySemi,
    fontSize: 14,
    color: colors.primary,
    letterSpacing: 0.84,
    textTransform: "uppercase",
  },
  heroBlock: {
    paddingHorizontal: spacing.xl,
  },
  headline: {
    fontFamily: fontFamilies.displayBold,
    fontSize: 32,
    lineHeight: 36.8,
    color: colors.text,
    marginBottom: 12,
  },
  subhead: {
    fontFamily: fontFamilies.body,
    fontSize: 16,
    lineHeight: 25.6,
    color: colors.textMuted,
    letterSpacing: 0.32,
  },
  logoContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  actions: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 40,
    gap: spacing.md,
  },
});
