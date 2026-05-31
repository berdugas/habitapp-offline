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

export default function DailyActionScreen() {
  const { draft, update } = useOnboarding();
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      headline: {
        fontFamily: theme.fontFamilies.displayBold,
        fontSize: 24,
        lineHeight: 30,
        color: theme.colors.text,
        marginBottom: theme.spacing.sm,
      },
      body: {
        fontFamily: theme.fontFamilies.body,
        fontSize: 14.5,
        lineHeight: 22,
        color: theme.colors.textFaint,
        marginBottom: theme.spacing.xl,
      },
      goalSection: {
        marginBottom: theme.spacing.sm,
      },
      sectionLabel: {
        fontFamily: theme.fontFamilies.bodyMedium,
        fontSize: theme.typography.labelMd,
        color: theme.colors.textMuted,
        marginBottom: theme.spacing.sm,
      },
      goalCard: {
        backgroundColor: theme.colors.surface,
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: theme.spacing.lg,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      },
      goalDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: theme.colors.primary,
        flexShrink: 0,
      },
      goalText: {
        fontFamily: theme.fontFamilies.bodyMedium,
        fontSize: 15,
        color: theme.colors.primary,
        flex: 1,
      },
      actionSection: {
        marginTop: theme.spacing.lg,
        marginBottom: theme.spacing.sm,
      },
    }),
  );

  const handleContinue = () => {
    update({ step: "shrink-insight" });
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
