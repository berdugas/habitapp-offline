import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { LucideIcon } from "@/components/LucideIconPicker";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { ZenCard } from "@/components/cards/ZenCard";
import { useReactivateHabitMutation } from "@/features/library/hooks";
import { formatLibraryDate } from "@/features/library/metrics";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

import type { LibraryHabit } from "@/features/library/hooks";

type LibraryHabitCardProps = {
  habit: LibraryHabit;
};

export function LibraryHabitCard({ habit }: LibraryHabitCardProps) {
  const [confirming, setConfirming] = useState(false);
  const reactivateMutation = useReactivateHabitMutation();

  const goToDetail = () => {
    router.push({
      pathname: "/(app)/habits/[habitId]",
      params: { habitId: habit.id },
    });
  };

  const handleConfirm = () => {
    reactivateMutation.mutate(
      { habitId: habit.id },
      {
        onSuccess: () => setConfirming(false),
      },
    );
  };

  const consistencyPct = Math.round(habit.preGraduationConsistency * 100);
  const automaticityScore = habit.latestSRHI?.average_score ?? null;

  return (
    <ZenCard gap={spacing.md}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${habit.title} details`}
        onPress={goToDetail}
        style={styles.tapZone}
      >
        <View style={styles.titleRow}>
          {habit.icon ? (
            <LucideIcon
              name={habit.icon}
              size={20}
              color={colors.primary}
              strokeWidth={1.75}
            />
          ) : null}
          <Text style={styles.title}>{habit.title}</Text>
        </View>

        <View style={styles.graduatedBadge}>
          <Text style={styles.graduatedBadgeText}>
            Automatic since {formatLibraryDate(habit.graduationDate)}
          </Text>
        </View>

        <View style={styles.metricsRow}>
          <Text style={styles.metric}>
            {habit.lifetimeDays} day{habit.lifetimeDays === 1 ? "" : "s"} to form
          </Text>
          <Text style={styles.metricDot}>·</Text>
          <Text style={styles.metric}>{consistencyPct}% consistency</Text>
        </View>

        {automaticityScore !== null ? (
          <Text style={styles.srhi}>
            Automaticity score: {automaticityScore.toFixed(1)}/5
          </Text>
        ) : null}
      </Pressable>

      {confirming ? (
        <View style={styles.confirmRow}>
          <Text style={styles.confirmText}>
            This will add the habit back to your daily tracking.
          </Text>
          <View style={styles.confirmButtons}>
            <SecondaryButton
              label="Cancel"
              onPress={() => setConfirming(false)}
              disabled={reactivateMutation.isPending}
            />
            <PrimaryButton
              label={reactivateMutation.isPending ? "Reactivating..." : "Reactivate"}
              onPress={handleConfirm}
              disabled={reactivateMutation.isPending}
            />
          </View>
          {reactivateMutation.isError ? (
            <Text style={styles.errorText}>
              Something went wrong. Please try again.
            </Text>
          ) : null}
        </View>
      ) : (
        <SecondaryButton
          label="Bring back to Today"
          onPress={() => setConfirming(true)}
        />
      )}
    </ZenCard>
  );
}

const styles = StyleSheet.create({
  confirmButtons: {
    flexDirection: "row",
    gap: spacing.md,
  },
  confirmRow: {
    gap: spacing.md,
  },
  confirmText: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    lineHeight: 20,
  },
  errorText: {
    color: colors.danger,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
  },
  graduatedBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.graduatedBadge,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  graduatedBadgeText: {
    color: colors.graduatedCircle,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.micro,
  },
  metric: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
  },
  metricDot: {
    color: colors.textFaint,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
  },
  metricsRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  srhi: {
    color: colors.textFaint,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
  },
  tapZone: {
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    flex: 1,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.titleMd,
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
});
