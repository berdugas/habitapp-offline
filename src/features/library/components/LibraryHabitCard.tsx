import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { LucideIcon } from "@/components/LucideIconPicker";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { ZenCard } from "@/components/cards/ZenCard";
import { useReactivateHabitMutation } from "@/features/library/hooks";
import { formatLibraryDate } from "@/features/library/metrics";
import { useTheme } from "@/theme/useTheme";
import { useThemedStyles } from "@/theme/useThemedStyles";

import type { LibraryHabit } from "@/features/library/hooks";

type LibraryHabitCardProps = {
  habit: LibraryHabit;
};

export function LibraryHabitCard({ habit }: LibraryHabitCardProps) {
  const [confirming, setConfirming] = useState(false);
  const reactivateMutation = useReactivateHabitMutation();
  const theme = useTheme();
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      confirmButtons: {
        flexDirection: "row",
        gap: t.spacing.md,
      },
      confirmRow: {
        gap: t.spacing.md,
      },
      confirmText: {
        color: t.colors.textMuted,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyMd,
        lineHeight: 18.6,
      },
      errorText: {
        color: t.colors.danger,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyMd,
      },
      graduatedBadge: {
        alignSelf: "flex-start",
        backgroundColor: t.colors.graduatedBadge,
        borderRadius: t.radius.pill,
        paddingHorizontal: t.spacing.sm + 2,
        paddingVertical: t.spacing.xs,
      },
      graduatedBadgeText: {
        color: t.colors.graduatedCircle,
        fontFamily: t.fontFamilies.bodySemi,
        fontSize: t.typography.micro,
      },
      metric: {
        color: t.colors.textMuted,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyMd,
      },
      metricDot: {
        color: t.colors.textFaint,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyMd,
      },
      metricsRow: {
        alignItems: "center",
        flexDirection: "row",
        gap: t.spacing.sm,
      },
      srhi: {
        color: t.colors.textFaint,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyMd,
      },
      tapZone: {
        gap: t.spacing.sm,
      },
      title: {
        color: t.colors.text,
        flex: 1,
        fontFamily: t.fontFamilies.bodySemi,
        fontSize: t.typography.titleMd,
      },
      titleRow: {
        alignItems: "center",
        flexDirection: "row",
        gap: t.spacing.sm,
      },
    }),
  );

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
    <ZenCard gap={theme.spacing.md}>
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
              color={theme.colors.primary}
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
