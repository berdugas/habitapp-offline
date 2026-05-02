import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { GuidanceCard } from "@/components/cards/GuidanceCard";
import { GuidanceExample } from "@/components/cards/GuidanceExample";
import { OnboardingInput } from "@/components/forms/OnboardingInput";
import { OnboardingLayout } from "@/components/layouts/OnboardingLayout";
import { OnboardingHeader } from "@/components/navigation/OnboardingHeader";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";

export default function CueScreen() {
  const { draft, update } = useOnboarding();

  const canContinue = draft.cueExisting.trim().length >= 2;

  const handleContinue = () => {
    update({ step: "personalize" });
    router.push("/(onboarding)/personalize");
  };

  return (
    <OnboardingLayout
      keyboardAware
      footer={
        <PrimaryButton
          disabled={!canContinue}
          label="Continue"
          showArrow
          onPress={handleContinue}
        />
      }
    >
      <OnboardingHeader
        currentStep={4}
        onBack={() => {
          update({ step: "shrink" });
          router.back();
        }}
      />

      <Text style={styles.eyebrow}>
        Attach it to something you already do — no willpower needed.
      </Text>
      <Text style={styles.headline}>What will trigger it?</Text>

      <View style={styles.formulaCard}>
        <Text style={styles.fieldLabel}>After I</Text>
        <OnboardingInput
          label=""
          placeholder="something you already do..."
          value={draft.cueExisting}
          onChangeText={(text) => update({ cueExisting: text })}
        />

        <Text style={[styles.fieldLabel, styles.fieldLabelSecond]}>I will</Text>
        <View style={styles.readonlyField}>
          <Text style={styles.readonlyText}>{draft.tinyAction}</Text>
        </View>
      </View>

      <GuidanceCard
        title="Why a routine trigger?"
        body="A routine cue beats a clock cue. Pick something you already do reliably — the previous action becomes your reminder."
      >
        <GuidanceExample
          trigger="finish my morning coffee"
          action="read one page"
        />
        <GuidanceExample
          trigger="brush my teeth"
          action="meditate for one breath"
        />
      </GuidanceCard>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 14,
    lineHeight: 21,
    color: colors.primary,
    marginBottom: 8,
  },
  headline: {
    fontFamily: fontFamilies.displayBold,
    fontSize: 28,
    lineHeight: 33,
    color: colors.text,
    marginBottom: 20,
  },
  formulaCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg + 4,
    marginBottom: 20,
    gap: 8,
  },
  fieldLabel: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 13,
    color: colors.textMuted,
    paddingLeft: 4,
  },
  fieldLabelSecond: {
    marginTop: 12,
  },
  readonlyField: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.md,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  readonlyText: {
    fontFamily: fontFamilies.bodySemi,
    fontSize: 15,
    color: colors.text,
  },
});
