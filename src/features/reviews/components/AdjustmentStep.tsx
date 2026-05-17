import { Pressable, StyleSheet, Text, View } from "react-native";

import { ZenCard } from "@/components/cards/ZenCard";
import { TextField } from "@/components/forms/TextField";
import { Eyebrow } from "@/components/text/Eyebrow";
import { FirstRunTipBanner } from "@/features/reviews/components/FirstRunTipBanner";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

import type { HabitWeekSummary } from "@/features/reviews/buildGoalWeekSummary";
import type { HabitAdjustmentSuggestion } from "@/features/recommendations/types";

type AdjustmentStepProps = {
  suggestion: HabitAdjustmentSuggestion | null;
  targetHabit: HabitWeekSummary | null;
  customAdjustment: string;
  onCustomAdjustmentChange: (text: string) => void;
  useCustom: boolean;
  onToggleCustom: () => void;
  showFirstRunTip?: boolean;
  onDismissFirstRunTip?: () => void;
};

export function AdjustmentStep({
  suggestion,
  targetHabit,
  customAdjustment,
  onCustomAdjustmentChange,
  useCustom,
  onToggleCustom,
  showFirstRunTip,
  onDismissFirstRunTip,
}: AdjustmentStepProps) {
  return (
    <View style={styles.wrapper}>
      {showFirstRunTip && onDismissFirstRunTip ? (
        <FirstRunTipBanner
          message="Two questions per habit. Honest 'no' answers are the most useful — they tell us what to change next week."
          onDismiss={onDismissFirstRunTip}
          testID="adjustment-first-run-tip"
        />
      ) : null}
    <ZenCard>
      <Eyebrow label="One thing to try" />

      {suggestion ? (
        <View style={styles.suggestionBlock}>
          <Text style={styles.title}>{suggestion.title}</Text>
          {targetHabit ? (
            <Text style={styles.targetLabel}>For: {targetHabit.title}</Text>
          ) : null}
          <Text style={styles.body}>{suggestion.body}</Text>
          <Text style={styles.reasonLabel}>Why this suggestion</Text>
          <Text style={styles.reasonBody}>{suggestion.reason}</Text>
        </View>
      ) : (
        <Text style={styles.body}>
          Take what you've noticed this week and try one small change next week.
        </Text>
      )}

      <View style={styles.pillRow}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (useCustom) onToggleCustom();
          }}
          style={[
            styles.pill,
            !useCustom ? styles.pillSelected : styles.pillUnselected,
          ]}
        >
          <Text
            style={[
              styles.pillLabel,
              !useCustom
                ? styles.pillLabelSelected
                : styles.pillLabelUnselected,
            ]}
          >
            Sounds good
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (!useCustom) onToggleCustom();
          }}
          style={[
            styles.pill,
            useCustom ? styles.pillSelected : styles.pillUnselected,
          ]}
        >
          <Text
            style={[
              styles.pillLabel,
              useCustom
                ? styles.pillLabelSelected
                : styles.pillLabelUnselected,
            ]}
          >
            I'll try something else
          </Text>
        </Pressable>
      </View>

      {useCustom ? (
        <TextField
          label="What you'll try"
          multiline
          onChangeText={onCustomAdjustmentChange}
          placeholder="One small change for next week"
          value={customAdjustment}
        />
      ) : null}
    </ZenCard>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    lineHeight: 20,
  },
  pill: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  pillLabel: {
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.bodyMd,
  },
  pillLabelSelected: {
    color: colors.primary,
  },
  pillLabelUnselected: {
    color: colors.textMuted,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  pillSelected: {
    backgroundColor: colors.primarySoft,
  },
  pillUnselected: {
    backgroundColor: colors.surface,
  },
  reasonBody: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    lineHeight: 20,
  },
  reasonLabel: {
    color: colors.text,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.labelMd,
  },
  suggestionBlock: {
    gap: spacing.sm,
  },
  targetLabel: {
    color: colors.textFaint,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
  },
  title: {
    color: colors.text,
    fontFamily: fontFamilies.displaySemi,
    fontSize: typography.titleMd,
  },
  wrapper: {
    gap: spacing.md,
  },
});
