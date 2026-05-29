import { StyleSheet, Text, View } from "react-native";

import { AppLogo } from "@/components/branding/AppLogo";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { OnboardingLayout } from "@/components/layouts/OnboardingLayout";
import { OnboardingFinalizationError } from "@/features/onboarding/completion";
import { useFinalizeOnboardingMutation } from "@/features/onboarding/hooks";
import { LucideIcon } from "@/components/LucideIconPicker";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import { useTheme } from "@/theme/useTheme";
import { useThemedStyles } from "@/theme/useThemedStyles";

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
  const theme = useTheme();
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      centeredContent: {
        flex: 1,
        justifyContent: "center",
        paddingVertical: t.spacing.xl,
      },
      header: {
        alignItems: "center",
        marginBottom: t.spacing.xl,
      },
      logo: {
        marginBottom: 20,
      },
      headline: {
        fontFamily: t.fontFamilies.displayBold,
        fontSize: 28,
        lineHeight: 33,
        color: t.colors.text,
        textAlign: "center",
        marginBottom: 10,
      },
      subhead: {
        fontFamily: t.fontFamilies.body,
        fontSize: 15,
        lineHeight: 23,
        color: t.colors.textMuted,
        textAlign: "center",
      },
      summaryCard: {
        backgroundColor: t.colors.surfaceCard,
        borderRadius: t.radius.lg,
        padding: t.spacing.xl,
        boxShadow: t.shadows.cardFloat,
        gap: t.spacing.lg,
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
        backgroundColor: t.colors.primaryLight,
        alignItems: "center",
        justifyContent: "center",
      },
      habitNameHint: {
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.micro,
        color: t.colors.textFaint,
        marginBottom: 1,
      },
      habitName: {
        fontFamily: t.fontFamilies.displayBold,
        fontSize: 17,
        color: t.colors.text,
      },
      summaryDivider: {
        height: 1,
        backgroundColor: t.colors.surfaceHigh,
        marginVertical: 2,
      },
      formulaText: {
        fontFamily: t.fontFamilies.body,
        fontSize: 17,
        lineHeight: 26,
        color: t.colors.textMuted,
      },
      formulaEmphasis: {
        fontFamily: t.fontFamilies.displaySemi,
        color: t.colors.text,
      },
      goalBadge: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 6,
        backgroundColor: t.colors.primarySoft,
        borderRadius: t.radius.pill,
        paddingHorizontal: 12,
        paddingVertical: 6,
      },
      goalText: {
        fontFamily: t.fontFamilies.bodySemi,
        fontSize: t.typography.labelMd,
        color: t.colors.primary,
      },
      error: {
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyMd,
        color: t.colors.danger,
        textAlign: "center",
        marginBottom: t.spacing.md,
      },
    }),
  );

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
                <LucideIcon name={draft.habitIcon} size={20} color={theme.colors.primary} strokeWidth={1.8} />
              ) : (
                <LucideIcon name="Sparkles" size={20} color={theme.colors.primary} strokeWidth={1.8} />
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
            <LucideIcon name="Target" size={13} color={theme.colors.primary} strokeWidth={2} />
            <Text style={styles.goalText}>Becoming {draft.becomingPhrase}</Text>
          </View>
        </View>
      </View>
    </OnboardingLayout>
  );
}
