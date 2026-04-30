import { ScrollView, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { OnboardingFinalizationError } from "@/features/onboarding/completion";
import { useFinalizeOnboardingMutation } from "@/features/onboarding/hooks";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import { colors } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { shadows } from "@/theme/shadows";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

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
  const finalizeMutation = useFinalizeOnboardingMutation();

  const handleStart = () => {
    finalizeMutation.mutate();
  };

  const buttonLabel = finalizeMutation.isPending
    ? "Starting..."
    : "Start showing up.";

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
    >
      <View style={styles.card}>
        <View style={styles.field}>
          <Text selectable style={styles.label}>
            Your becoming
          </Text>
          <Text selectable style={styles.value}>
            {draft.becomingPhrase}
          </Text>
        </View>

        <View style={styles.field}>
          <Text selectable style={styles.label}>
            Your habit
          </Text>
          <Text selectable style={styles.value}>
            After I {draft.cueExisting}, I will {draft.tinyAction}
          </Text>
        </View>

        <View style={styles.field}>
          <Text selectable style={styles.label}>
            Starts
          </Text>
          <Text selectable style={styles.value}>
            today
          </Text>
        </View>
      </View>

      {finalizeMutation.isError && (
        <Text selectable style={styles.error}>
          {getFinalizeErrorMessage(finalizeMutation.error)}
        </Text>
      )}

      <PrimaryButton
        disabled={finalizeMutation.isPending}
        label={buttonLabel}
        onPress={handleStart}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    boxShadow: shadows.card,
    gap: spacing.xl,
    padding: spacing.xxl,
  },
  content: {
    flexGrow: 1,
    gap: spacing.xxl,
    justifyContent: "center",
    padding: spacing.xl,
  },
  error: {
    color: colors.danger,
    fontSize: typography.body,
    lineHeight: 22,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  value: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 26,
  },
});
