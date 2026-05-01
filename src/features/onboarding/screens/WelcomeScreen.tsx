import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import { colors } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { shadows } from "@/theme/shadows";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

export default function WelcomeScreen() {
  const { update } = useOnboarding();

  const handleBegin = () => {
    update({ step: "becoming" });
    router.push("/(onboarding)/becoming");
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
    >
      <View style={styles.heroCard}>
        <Text selectable style={styles.title}>
          This is a tool for becoming.
        </Text>
        <Text selectable style={styles.body}>
          We help you turn who you want to be into something you can do tomorrow
          morning. Let's start.
        </Text>
      </View>

      <PrimaryButton label="Begin" onPress={handleBegin} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
