import { StyleSheet, Text, View } from "react-native";

import { AppLogo } from "@/components/branding/AppLogo";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { OnboardingLayout } from "@/components/layouts/OnboardingLayout";
import { OnboardingFinalizationError } from "@/features/onboarding/completion";
import { useFinalizeOnboardingMutation } from "@/features/onboarding/hooks";
import { LucideIcon } from "@/components/LucideIconPicker";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { radius } from "@/theme/radius";
import { shadows } from "@/theme/shadows";
import { spacing } from "@/theme/spacing";

function getFinalizeErrorMessage(error: unknown): string {
  if (error instanceof OnboardingFinalizationError) {
    if (error.reason === "cap_failed") {
      return "You already have a Focus habit. Finish that one first.";
    }
    return "Something went wrong while saving your habit. Please try again.";
  }
  return "Something went wrong. Please try again.";
}

export default function ConfirmationScreen() {
  const { draft } = useOnboarding();
  const finalizeMutation = useFinalizeOnboardingMutation(draft);

  const handleStart = () => {
    finalizeMutation.mutate();
  };

  const buttonLabel = finalizeMutation.isPending ? "Starting..." : "Let's go";

  return (
    <OnboardingLayout
      footer={
        <>
          {finalizeMutation.isError && (
            <Text style={styles.error}>
              {getFinalizeErrorMessage(finalizeMutation.error)}
            </Text>
          )}
          <PrimaryButton
            disabled={finalizeMutation.isPending}
            label={buttonLabel}
            showArrow
            onPress={handleStart}
          />
        </>
      }
    >
      <View style={styles.centeredContent}>
        {/* Header */}
        <View style={styles.header}>
          <AppLogo size={56} style={styles.logo} />
          <Text style={styles.headline}>Your first habit is ready.</Text>
          <Text style={styles.subhead}>
            Everything you need to start becoming who you want to be — one small action at a time.
          </Text>
        </View>

        {/* Summary card */}
        <View style={styles.summaryCard}>
          {/* Icon + name */}
          <View style={styles.summaryCardHeader}>
            <View style={styles.iconBubble}>
              {draft.habitIcon ? (
                <LucideIcon name={draft.habitIcon} size={20} color={colors.primary} strokeWidth={1.8} />
              ) : (
                <LucideIcon name="Sparkles" size={20} color={colors.primary} strokeWidth={1.8} />
              )}
            </View>
            <View>
              <Text style={styles.habitNameHint}>Habit name</Text>
              <Text style={styles.habitName}>{draft.habitName || draft.tinyAction}</Text>
            </View>
          </View>

          <View style={styles.summaryDivider} />

          {/* Formula */}
          <Text style={styles.formulaText}>
            {"After "}
            <Text style={styles.formulaEmphasis}>{draft.cueExisting}</Text>
            {", I will "}
            <Text style={styles.formulaEmphasis}>{draft.tinyAction}</Text>
            {"."}
          </Text>

          {/* Goal badge */}
          <View style={styles.goalBadge}>
            <LucideIcon name="Target" size={13} color={colors.primary} strokeWidth={2} />
            <Text style={styles.goalText}>Becoming {draft.becomingPhrase}</Text>
          </View>
        </View>
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  centeredContent: {
    flex: 1,
    justifyContent: "center",
    paddingVertical: spacing.xl,
  },
  header: {
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  logo: {
    marginBottom: 20,
  },
  headline: {
    fontFamily: fontFamilies.displayBold,
    fontSize: 28,
    lineHeight: 33,
    color: colors.text,
    textAlign: "center",
    marginBottom: 10,
  },
  subhead: {
    fontFamily: fontFamilies.body,
    fontSize: 15,
    lineHeight: 23,
    color: colors.textMuted,
    textAlign: "center",
  },
  summaryCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.xl,
    boxShadow: shadows.cardFloat,
    gap: spacing.lg,
  },
  summaryCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  habitNameHint: {
    fontFamily: fontFamilies.body,
    fontSize: 11,
    color: colors.textFaint,
    marginBottom: 1,
  },
  habitName: {
    fontFamily: fontFamilies.displayBold,
    fontSize: 17,
    color: colors.text,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.surfaceHigh,
    marginVertical: 2,
  },
  formulaText: {
    fontFamily: fontFamilies.body,
    fontSize: 17,
    lineHeight: 26,
    color: colors.textMuted,
  },
  formulaEmphasis: {
    fontFamily: fontFamilies.displaySemi,
    color: colors.text,
  },
  goalBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  goalText: {
    fontFamily: fontFamilies.bodySemi,
    fontSize: 13,
    color: colors.primary,
  },
  error: {
    fontFamily: fontFamilies.body,
    fontSize: 14,
    color: colors.danger,
    textAlign: "center",
    marginBottom: spacing.md,
  },
});
