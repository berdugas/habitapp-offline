import { ScrollView, StyleSheet, Text } from "react-native";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { RowLV } from "@/components/cards/RowLV";
import { ZenCard } from "@/components/cards/ZenCard";
import { OnboardingFinalizationError } from "@/features/onboarding/completion";
import { useFinalizeOnboardingMutation } from "@/features/onboarding/hooks";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import { colors } from "@/theme/colors";
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
  const finalizeMutation = useFinalizeOnboardingMutation(draft);

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
      <ZenCard padding="xxl">
        <RowLV label="Your becoming" value={draft.becomingPhrase} />
        <RowLV
          label="Your habit"
          value={`After I ${draft.cueExisting}, I will ${draft.tinyAction}`}
        />
        <RowLV label="Starts" value="today" />
      </ZenCard>

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
  content: {
    flexGrow: 1,
    gap: spacing.xxl,
    justifyContent: "center",
    padding: spacing.xl,
  },
  error: {
    color: colors.danger,
    fontSize: typography.bodyLg,
    lineHeight: 22,
  },
  screen: {
    backgroundColor: colors.bg,
    flex: 1,
  },
});
