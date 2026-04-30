import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { WorstDayCheck } from "@/features/onboarding/components/WorstDayCheck";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

export default function WorstDayCheckScreen() {
  const { draft, update } = useOnboarding();

  const handlePass = () => {
    update({ worstDayPassed: true, step: "confirmation" });
    router.push("/(onboarding)/confirmation");
  };

  const handleFail = () => {
    update({ worstDayPassed: false, step: "shrink" });
    // Replace, not push — otherwise the back stack accumulates a Worst-day
    // screen each time the user fails. See decision D3 in sprint-4-tickets §0.
    router.replace("/(onboarding)/shrink");
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
    >
      <View style={styles.context}>
        <Text selectable style={styles.contextLabel}>
          Your habit
        </Text>
        <Text selectable style={styles.contextValue}>
          After I {draft.cueExisting}, I will {draft.tinyAction}
        </Text>
      </View>

      <WorstDayCheck onPass={handlePass} onFail={handleFail} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    gap: spacing.xxl,
    justifyContent: "center",
    padding: spacing.xl,
  },
  context: {
    gap: spacing.sm,
  },
  contextLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
  contextValue: {
    color: colors.text,
    fontSize: typography.body,
    fontStyle: "italic",
    lineHeight: 24,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
});
