import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Check, ChevronRight } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { LucideIcon } from "@/components/LucideIconPicker";
import { useTheme } from "@/theme/useTheme";
import { useThemedStyles } from "@/theme/useThemedStyles";

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

const CIRCLE_SIZE = 38;

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
  const theme = useTheme();
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      circleDone: {
        alignItems: "center",
        borderRadius: CIRCLE_SIZE / 2,
        height: CIRCLE_SIZE,
        justifyContent: "center",
        width: CIRCLE_SIZE,
      },
      circlePending: {
        alignItems: "center",
        borderColor: t.colors.primary,
        borderRadius: CIRCLE_SIZE / 2,
        borderWidth: 2,
        height: CIRCLE_SIZE,
        justifyContent: "center",
        width: CIRCLE_SIZE,
      },
      circleGraduated: {
        alignItems: "center",
        borderColor: t.colors.graduatedCircle,
        borderRadius: CIRCLE_SIZE / 2,
        borderWidth: 2,
        height: CIRCLE_SIZE,
        justifyContent: "center",
        width: CIRCLE_SIZE,
      },
      circleSkipped: {
        borderColor: t.colors.textFaint,
        borderRadius: CIRCLE_SIZE / 2,
        borderWidth: 2,
        height: CIRCLE_SIZE,
        opacity: 0.4,
        width: CIRCLE_SIZE,
      },
      circleOffDay: {
        borderColor: t.colors.textFaint,
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
        color: t.colors.textFaint,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyMd - 2,
        lineHeight: 14.9,
      },
      formulaTextSkipped: {
        color: t.colors.primary,
        fontStyle: "italic",
      },
      formulaTextGraduated: {
        color: t.colors.graduatedCircle,
        fontStyle: "italic",
      },
      habitName: {
        color: t.colors.text,
        fontFamily: t.fontFamilies.bodyMedium,
        fontSize: 15,
        fontWeight: "500",
      },
      habitNameDone: {
        color: t.colors.textMuted,
        textDecorationLine: "line-through",
      },
      habitNameOffDay: {
        opacity: 0.5,
      },
      habitNameSkipped: {
        color: t.colors.textMuted,
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
        borderBottomColor: t.colors.surface,
        borderBottomWidth: StyleSheet.hairlineWidth,
        flexDirection: "row",
        gap: t.spacing.md,
        paddingHorizontal: t.spacing.lg,
        paddingVertical: t.spacing.md + 2,
      },
      rowOffDay: {
        opacity: 0.6,
      },
      rowSkipped: {
        opacity: 0.7,
      },
      rowPressed: {
        backgroundColor: t.colors.surfaceMuted,
      },
    }),
  );

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
            color={theme.colors.textFaint}
            size={22}
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

        <ChevronRight color={theme.colors.textFaint} size={16} strokeWidth={1.75} />
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
            colors={[theme.colors.primary, theme.colors.primaryGradientEnd]}
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
              color={graduated ? theme.colors.graduatedBadge : theme.colors.primaryLight}
              size={16}
              strokeWidth={2.5}
            />
          </View>
        )}
      </Pressable>

      <View style={styles.iconWrap}>
        <LucideIcon
          name={habit.icon ?? "Sparkles"}
          color={isLogged ? theme.colors.textFaint : theme.colors.primary}
          size={22}
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
        color={theme.colors.textFaint}
        size={16}
        strokeWidth={1.75}
      />
    </Pressable>
  );
}
