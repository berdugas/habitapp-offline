import { router } from "expo-router";
import { StyleSheet, Text } from "react-native";

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

export default function DailyActionScreen() {
  const { draft, update } = useOnboarding();

  const handleContinue = () => {
    const next: Partial<OnboardingDraft> = { step: "shrink" };
    if (draft.tinyAction.trim().length === 0) {
      next.tinyAction = draft.dailyAction;
    }
    update(next);
    router.push("/(onboarding)/shrink");
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
          update({ step: "becoming" });
          if (router.canGoBack()) router.back();
          else router.replace("/(onboarding)/becoming");
        }}
      />

      <Text style={styles.headline}>
        What action will you take to become who you want to be?
      </Text>
      <Text style={styles.body}>
        Write a concrete action — something small and repeatable you can track.
      </Text>

      <OnboardingInput
        label="Your action"
        placeholder="e.g. Read for 10 minutes"
        value={draft.dailyAction}
        onChangeText={(text) => update({ dailyAction: text })}
      />

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
    fontSize: 28,
    lineHeight: 33,
    color: colors.text,
    marginBottom: 12,
  },
  body: {
    fontFamily: fontFamilies.body,
    fontSize: 15,
    lineHeight: 23,
    color: colors.textMuted,
    marginBottom: 20,
  },
});
