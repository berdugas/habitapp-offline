import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { GuidanceCard } from "@/components/cards/GuidanceCard";
import { GuidanceExample } from "@/components/cards/GuidanceExample";
import { OnboardingInput } from "@/components/forms/OnboardingInput";
import { OnboardingLayout } from "@/components/layouts/OnboardingLayout";
import { OnboardingHeader } from "@/components/navigation/OnboardingHeader";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import { useThemedStyles } from "@/theme/useThemedStyles";

export default function CueScreen() {
  const { draft, update } = useOnboarding();
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      eyebrow: {
        fontFamily: theme.fontFamilies.bodyMedium,
        fontSize: theme.typography.bodyMd,
        lineHeight: 19.5,
        color: theme.colors.primary,
        marginBottom: 8,
      },
      headline: {
        fontFamily: theme.fontFamilies.displayBold,
        fontSize: 28,
        lineHeight: 33,
        color: theme.colors.text,
        marginBottom: 20,
      },
      formulaCard: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.lg,
        paddingVertical: theme.spacing.xl,
        paddingHorizontal: theme.spacing.lg + 4,
        marginBottom: 20,
        gap: 8,
      },
      fieldLabel: {
        fontFamily: theme.fontFamilies.bodyMedium,
        fontSize: theme.typography.labelMd,
        color: theme.colors.textMuted,
        paddingLeft: 4,
      },
      fieldLabelSecond: {
        marginTop: 12,
      },
      readonlyField: {
        backgroundColor: theme.colors.surfaceHigh,
        borderRadius: theme.radius.md,
        paddingVertical: 16,
        paddingHorizontal: 18,
      },
      readonlyText: {
        fontFamily: theme.fontFamilies.bodySemi,
        fontSize: 15,
        color: theme.colors.text,
      },
    }),
  );

  const canContinue = draft.cueExisting.trim().length >= 2;

  const handleContinue = () => {
    update({ step: "schedule" });
    router.push("/(onboarding)/schedule");
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
          update({ step: "cue-insight" });
          if (router.canGoBack()) router.back();
          else router.replace("/(onboarding)/cue-insight");
        }}
      />

      <Text style={styles.eyebrow}>
        Attach it to something you already do — no willpower needed.
      </Text>
      <Text style={styles.headline}>What will trigger it?</Text>

      <View style={styles.formulaCard}>
        <Text style={styles.fieldLabel}>After</Text>
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
