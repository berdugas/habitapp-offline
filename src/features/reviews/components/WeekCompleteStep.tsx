import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { ZenCard } from "@/components/cards/ZenCard";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Eyebrow } from "@/components/text/Eyebrow";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

type WeekCompleteStepProps = {
  identityPhrase: string;
  daysOnJourney: number;
  totalDaysShowedUp: number;
  isSaving: boolean;
  saveError: boolean;
  onDone: () => void;
  onRetry: () => void;
};

export function WeekCompleteStep({
  identityPhrase,
  daysOnJourney,
  totalDaysShowedUp,
  isSaving,
  saveError,
  onDone,
  onRetry,
}: WeekCompleteStepProps) {
  // During a retry, the parent clears saveError before the batch write
  // settles. The success card / Done button must wait until the write has
  // actually returned — otherwise the user can tap Done and walk away while
  // the save is still in flight.
  if (isSaving) {
    return (
      <View style={styles.container}>
        <View style={styles.savingBlock}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.savingText}>Saving your review...</Text>
        </View>
      </View>
    );
  }

  if (saveError) {
    return (
      <View style={styles.container}>
        <ErrorState message="We couldn't save your review. Try again." />
        <SecondaryButton label="Retry" onPress={onRetry} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ZenCard style={styles.card}>
        <Eyebrow label="Week reviewed" tone="primary" />
        <Text style={styles.streakLine}>
          You're {daysOnJourney} day{daysOnJourney === 1 ? "" : "s"} into
          becoming {identityPhrase}.
        </Text>
        <Text style={styles.summaryLine}>
          You showed up {totalDaysShowedUp} of 7 days this week.
        </Text>
      </ZenCard>

      <PrimaryButton label="Done" onPress={onDone} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primarySoft,
  },
  container: {
    gap: spacing.xl,
  },
  savingBlock: {
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xxl,
  },
  savingText: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
  },
  streakLine: {
    color: colors.primary,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyLg,
    fontStyle: "italic",
    lineHeight: 24,
  },
  summaryLine: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    lineHeight: 20,
  },
});
