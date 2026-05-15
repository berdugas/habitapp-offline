import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Check, ChevronRight } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { LucideIcon } from "@/components/LucideIconPicker";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

import type { TodayHabitCardData } from "@/features/today/types";

type HabitRowProps = {
  disabled: boolean;
  graduated?: boolean;
  habit: TodayHabitCardData;
  onDone: (habitId: string) => void;
  onNavigate: (habitId: string) => void;
  onSkip: (habitId: string) => void;
  onUndo: (habitId: string) => void;
  offDay?: boolean;
};

export function HabitRow({
  disabled,
  graduated = false,
  habit,
  onDone,
  onNavigate,
  onSkip,
  onUndo,
  offDay,
}: HabitRowProps) {
  const isDone = habit.todayStatus === "done";
  const isSkipped = habit.todayStatus === "skipped";
  const isLogged = isDone || isSkipped;

  const circleLabel = isDone
    ? `${habit.name} — done`
    : isSkipped
      ? `${habit.name} — skipped`
      : `Log ${habit.name}`;

  async function handleCirclePress() {
    if (disabled) return;
    if (isLogged) {
      onUndo(habit.id);
    } else {
      onDone(habit.id);
    }
  }

  function handleCircleLongPress() {
    if (disabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSkip(habit.id);
  }

  if (offDay) {
    return (
      <Pressable
        accessibilityLabel={`Open ${habit.name}`}
        accessibilityRole="button"
        onPress={() => onNavigate(habit.id)}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed, styles.rowOffDay]}
      >
        <View style={styles.circleWrap}>
          <View style={styles.circleOffDay} />
        </View>

        <View style={styles.iconWrap}>
          <LucideIcon
            name={habit.icon ?? "Sparkles"}
            color={colors.textFaint}
            size={18}
            strokeWidth={1.75}
          />
        </View>

        <View style={styles.textWrap}>
          <Text style={[styles.habitName, styles.habitNameOffDay]} numberOfLines={1}>
            {habit.name}
          </Text>
          <Text style={styles.formulaText} numberOfLines={1}>
            Off day
          </Text>
        </View>

        <ChevronRight color={colors.textFaint} size={16} strokeWidth={1.75} />
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityLabel={`Open ${habit.name}`}
      accessibilityRole="button"
      onPress={() => onNavigate(habit.id)}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed,
        isSkipped && styles.rowSkipped,
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
        ) : isSkipped ? (
          <View style={styles.circleSkipped} />
        ) : (
          <View style={graduated ? styles.circleGraduated : styles.circlePending}>
            <Check
              color={graduated ? colors.graduatedBadge : colors.primaryLight}
              size={16}
              strokeWidth={2.5}
            />
          </View>
        )}
      </Pressable>

      <View style={styles.iconWrap}>
        <LucideIcon
          name={habit.icon ?? "Sparkles"}
          color={isLogged ? colors.textFaint : colors.primary}
          size={18}
          strokeWidth={1.75}
        />
      </View>

      <View style={styles.textWrap}>
        <Text
          style={[
            styles.habitName,
            isDone && styles.habitNameDone,
            isSkipped && styles.habitNameSkipped,
          ]}
          numberOfLines={1}
        >
          {habit.name}
        </Text>
        <Text
          style={[
            styles.formulaText,
            isSkipped && styles.formulaTextSkipped,
            !isSkipped && graduated && styles.formulaTextGraduated,
          ]}
          numberOfLines={1}
        >
          {isSkipped
            ? "Skipped today"
            : graduated
              ? "Automatic"
              : habit.formula}
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
    alignItems: "center",
    borderColor: colors.primary,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 2,
    height: CIRCLE_SIZE,
    justifyContent: "center",
    width: CIRCLE_SIZE,
  },
  circleGraduated: {
    alignItems: "center",
    borderColor: colors.graduatedCircle,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 2,
    height: CIRCLE_SIZE,
    justifyContent: "center",
    width: CIRCLE_SIZE,
  },
  circleSkipped: {
    borderColor: colors.textFaint,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 2,
    height: CIRCLE_SIZE,
    opacity: 0.4,
    width: CIRCLE_SIZE,
  },
  circleOffDay: {
    borderColor: colors.textFaint,
    borderRadius: CIRCLE_SIZE / 2,
    borderStyle: "dashed",
    borderWidth: 1.5,
    height: CIRCLE_SIZE,
    opacity: 0.5,
    width: CIRCLE_SIZE,
  },
  circleWrap: {
    flexShrink: 0,
  },
  formulaText: {
    color: colors.textFaint,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd - 2,
    lineHeight: 16,
  },
  formulaTextSkipped: {
    color: colors.primary,
    fontStyle: "italic",
  },
  formulaTextGraduated: {
    color: colors.graduatedCircle,
    fontStyle: "italic",
  },
  habitName: {
    color: colors.text,
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 15,
    fontWeight: "500",
  },
  habitNameDone: {
    color: colors.textMuted,
    textDecorationLine: "line-through",
  },
  habitNameOffDay: {
    opacity: 0.5,
  },
  habitNameSkipped: {
    color: colors.textMuted,
  },
  iconWrap: {
    flexShrink: 0,
    width: 22,
  },
  textWrap: {
    flex: 1,
    gap: 2,
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
  rowOffDay: {
    opacity: 0.6,
  },
  rowSkipped: {
    opacity: 0.7,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
});
