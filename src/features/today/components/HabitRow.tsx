import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as icons from "lucide-react-native";
import { Check, ChevronRight } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import React from "react";

import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

import type { TodayHabitCardData } from "@/features/today/types";

type LucideIconComponent = React.ComponentType<{
  color?: string;
  size?: number;
  strokeWidth?: number;
}>;

function getIcon(name: string | null): LucideIconComponent {
  if (!name) return icons.Sparkles as unknown as LucideIconComponent;
  const resolved = (icons as Record<string, unknown>)[name];
  return ((resolved ?? icons.Sparkles) as unknown) as LucideIconComponent;
}

type HabitRowProps = {
  disabled: boolean;
  habit: TodayHabitCardData;
  onDone: (habitId: string) => void;
  onNavigate: (habitId: string) => void;
  onSkip: (habitId: string) => void;
};

export function HabitRow({
  disabled,
  habit,
  onDone,
  onNavigate,
  onSkip,
}: HabitRowProps) {
  const isDone = habit.todayStatus === "done";
  const isSkipped = habit.todayStatus === "skipped";
  const isLogged = isDone || isSkipped;
  const IconComponent = getIcon(habit.icon);

  const circleLabel = isDone
    ? `${habit.name} — done`
    : isSkipped
      ? `${habit.name} — skipped`
      : `Log ${habit.name}`;

  async function handleCirclePress() {
    if (disabled) return;
    onDone(habit.id);
  }

  function handleCircleLongPress() {
    if (disabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSkip(habit.id);
  }

  return (
    <Pressable
      accessibilityLabel={`Open ${habit.name}`}
      accessibilityRole="button"
      onPress={() => onNavigate(habit.id)}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed,
        isLogged && styles.rowLogged,
      ]}
    >
      <Pressable
        accessibilityLabel={circleLabel}
        accessibilityRole="button"
        onPress={() => void handleCirclePress()}
        onLongPress={handleCircleLongPress}
        style={styles.circleWrap}
      >
        {isDone ? (
          <LinearGradient
            colors={[colors.primary, colors.primaryGradientEnd]}
            end={{ x: 1, y: 1 }}
            start={{ x: 0, y: 0 }}
            style={styles.circleDone}
          >
            <Check color="white" size={18} strokeWidth={2.5} />
          </LinearGradient>
        ) : (
          <View
            style={[styles.circlePending, isSkipped && styles.circleSkipped]}
          />
        )}
      </Pressable>

      <View style={styles.iconWrap}>
        <IconComponent
          color={isLogged ? colors.textFaint : colors.primary}
          size={18}
          strokeWidth={1.75}
        />
      </View>

      <View style={styles.textWrap}>
        <Text
          style={[styles.habitName, isLogged && styles.habitNameLogged]}
          numberOfLines={1}
        >
          {habit.name}
        </Text>
        <Text style={styles.cueText} numberOfLines={1}>
          After {habit.cue}
        </Text>
      </View>

      <ChevronRight
        color={colors.textFaint}
        size={16}
        strokeWidth={1.75}
      />
    </Pressable>
  );
}

const CIRCLE_SIZE = 38;

const styles = StyleSheet.create({
  circleDone: {
    alignItems: "center",
    borderRadius: CIRCLE_SIZE / 2,
    height: CIRCLE_SIZE,
    justifyContent: "center",
    width: CIRCLE_SIZE,
  },
  circlePending: {
    borderColor: colors.primary,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 2,
    height: CIRCLE_SIZE,
    width: CIRCLE_SIZE,
  },
  circleSkipped: {
    borderColor: colors.textFaint,
    opacity: 0.5,
  },
  circleWrap: {
    flexShrink: 0,
  },
  cueText: {
    color: colors.textFaint,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd - 2,
    lineHeight: 16,
  },
  habitName: {
    color: colors.text,
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 15,
    fontWeight: "500",
  },
  habitNameLogged: {
    color: colors.textMuted,
    textDecorationLine: "line-through",
  },
  iconWrap: {
    flexShrink: 0,
    width: 22,
  },
  row: {
    alignItems: "center",
    borderBottomColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
  },
  rowLogged: {
    opacity: 0.6,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
});
