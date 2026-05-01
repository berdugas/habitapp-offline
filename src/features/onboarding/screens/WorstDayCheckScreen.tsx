import { ScrollView, StyleSheet, Text } from "react-native";
import { router } from "expo-router";

import { ZenCard } from "@/components/cards/ZenCard";
import { Eyebrow } from "@/components/text/Eyebrow";
import { WorstDayCheck } from "@/features/onboarding/components/WorstDayCheck";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
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
      <ZenCard>
        <Eyebrow label="Your habit" />
        <Text selectable style={styles.contextValue}>
          After I {draft.cueExisting}, I will {draft.tinyAction}
        </Text>
      </ZenCard>

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
  contextValue: {
    color: colors.text,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyLg,
    fontStyle: "italic",
    lineHeight: 24,
  },
  screen: {
    backgroundColor: colors.bg,
    flex: 1,
  },
});
