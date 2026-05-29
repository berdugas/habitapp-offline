import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppLogo } from "@/components/branding/AppLogo";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { useTheme } from "@/theme/useTheme";
import { useThemedStyles } from "@/theme/useThemedStyles";

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      screen: {
        flex: 1,
        backgroundColor: t.colors.bg,
      },
      header: {
        flexDirection: "row",
        alignItems: "center",
        gap: 9,
        paddingTop: 20,
        paddingHorizontal: t.spacing.xl,
        marginBottom: 48,
      },
      appName: {
        fontFamily: t.fontFamilies.displaySemi,
        fontSize: 14,
        color: t.colors.primary,
        letterSpacing: 0.84,
        textTransform: "uppercase",
      },
      heroBlock: {
        paddingHorizontal: t.spacing.xl,
      },
      headline: {
        fontFamily: t.fontFamilies.displayBold,
        fontSize: 32,
        lineHeight: 36.8,
        color: t.colors.text,
        marginBottom: 12,
      },
      subhead: {
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyLg,
        lineHeight: 22.4,
        color: t.colors.textMuted,
        letterSpacing: 0.32,
      },
      logoContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      },
      actions: {
        paddingHorizontal: t.spacing.xl,
        paddingBottom: 40,
        gap: t.spacing.md,
      },
    }),
  );

  return (
    <View style={styles.screen}>
      {/* Header: small logo + app name */}
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.lg }]}>
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
