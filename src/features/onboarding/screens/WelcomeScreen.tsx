import { ScrollView, StyleSheet, Text } from "react-native";
import { router } from "expo-router";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { ZenCard } from "@/components/cards/ZenCard";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
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
      <ZenCard padding="xxl">
        <Text selectable style={styles.title}>
          This is a tool for becoming.
        </Text>
        <Text selectable style={styles.body}>
          We help you turn who you want to be into something you can do tomorrow
          morning. Let's start.
        </Text>
      </ZenCard>

      <PrimaryButton label="Begin" onPress={handleBegin} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyLg,
    lineHeight: 24,
  },
  content: {
    flexGrow: 1,
    gap: spacing.xxl,
    justifyContent: "center",
    padding: spacing.xl,
  },
  screen: {
    backgroundColor: colors.bg,
    flex: 1,
  },
  title: {
    color: colors.text,
    fontFamily: fontFamilies.displayBold,
    fontSize: typography.headlineLg,
    lineHeight: 36,
  },
});
