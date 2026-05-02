import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { colors } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { shadows } from "@/theme/shadows";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

export default function WelcomeScreen() {
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
    >
      <View style={styles.heroCard}>
        <Text selectable style={styles.eyebrow}>
          Habit Builder MVP
        </Text>
        <Text selectable style={styles.title}>
          Build habits through small actions and stronger triggers.
        </Text>
        <Text selectable style={styles.body}>
          Start with one repeatable habit, keep it simple, and let the app carry
          the daily structure.
        </Text>
      </View>

      <View style={styles.actions}>
        <PrimaryButton
          label="Start Your First Habit"
          onPress={() => router.push("/(auth)/sign-up")}
        />
        <SecondaryButton
          label="I already have an account"
          onPress={() => router.push("/(auth)/sign-in")}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.md,
  },
  body: {
    color: colors.textMuted,
    fontSize: typography.bodyLg,
    lineHeight: 24,
  },
  content: {
    flexGrow: 1,
    gap: spacing.xxl,
    justifyContent: "center",
    padding: spacing.xl,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: typography.bodyMd,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderColor: 'transparent',
    borderRadius: radius.lg,
    borderWidth: 1,
    boxShadow: shadows.card,
    gap: spacing.lg,
    padding: spacing.xxl,
  },
  screen: {
    backgroundColor: colors.bg,
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: typography.headlineLg,
    fontWeight: "800",
    lineHeight: 36,
  },
});
