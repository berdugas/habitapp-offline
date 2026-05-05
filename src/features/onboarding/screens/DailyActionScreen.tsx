import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { GuidanceCard } from "@/components/cards/GuidanceCard";
import { GuidanceExample } from "@/components/cards/GuidanceExample";
import { OnboardingInput } from "@/components/forms/OnboardingInput";
import { OnboardingLayout } from "@/components/layouts/OnboardingLayout";
import { OnboardingHeader } from "@/components/navigation/OnboardingHeader";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import type { OnboardingDraft } from "@/features/onboarding/types";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";

export default function DailyActionScreen() {
  const { draft, update } = useOnboarding();

  const handleContinue = () => {
    const next: Partial<OnboardingDraft> = { step: "shrink-insight" };
    if (draft.tinyAction.trim().length === 0) {
      next.tinyAction = draft.dailyAction;
    }
    update(next);
    router.push("/(onboarding)/shrink-insight");
  };

  return (
    <OnboardingLayout
      keyboardAware
      footer={
        <PrimaryButton
          disabled={draft.dailyAction.trim().length < 2}
          label="Continue"
          showArrow
          onPress={handleContinue}
        />
      }
    >
      <OnboardingHeader
        currentStep={2}
        onBack={() => {
          update({ step: "action-insight" });
          if (router.canGoBack()) router.back();
          else router.replace("/(onboarding)/action-insight");
        }}
      />

      <Text style={styles.headline}>
        What action will shape who you want to become?
      </Text>
      <Text style={styles.body}>
        Write a concrete action — something small and repeatable you can track.
      </Text>

      <View style={styles.goalSection}>
        <Text style={styles.sectionLabel}>Your goal</Text>
        <View style={styles.goalCard}>
          <View style={styles.goalDot} />
          <Text style={styles.goalText}>{draft.becomingPhrase}</Text>
        </View>
      </View>

      <View style={styles.actionSection}>
        <OnboardingInput
          label="Your action"
          placeholder="e.g. Read for 10 minutes"
          value={draft.dailyAction}
          onChangeText={(text) => update({ dailyAction: text })}
        />
      </View>

      <GuidanceCard
        title="What makes a good habit action?"
        body="Think about one small thing that brings you closer to who you described. Make it specific enough that you'll know you did it."
      >
        <GuidanceExample
          context="Becoming a reader"
          good="Read for 10 minutes"
          bad="Read more books"
        />
        <GuidanceExample
          context="Becoming physically fit"
          good="Exercise for 15 minutes"
          bad="Be healthier"
        />
      </GuidanceCard>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  headline: {
    fontFamily: fontFamilies.displayBold,
    fontSize: 24,
    lineHeight: 30,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  body: {
    fontFamily: fontFamilies.body,
    fontSize: 14.5,
    lineHeight: 22,
    color: colors.textFaint,
    marginBottom: spacing.xl,
  },
  goalSection: {
    marginBottom: spacing.sm,
  },
  sectionLabel: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  goalCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  goalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    flexShrink: 0,
  },
  goalText: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 15,
    color: colors.primary,
    flex: 1,
  },
  actionSection: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
});
