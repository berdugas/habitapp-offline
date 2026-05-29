import { Pressable, StyleSheet, Text, View } from "react-native";

import { getActiveDaysLabel } from "@/features/habits/activeDays";
import { useThemedStyles } from "@/theme/useThemedStyles";

// ISO weekday: Mon=1 … Sun=7
const DAY_LABELS: { day: number; label: string }[] = [
  { day: 1, label: "M" },
  { day: 2, label: "T" },
  { day: 3, label: "W" },
  { day: 4, label: "T" },
  { day: 5, label: "F" },
  { day: 6, label: "S" },
  { day: 7, label: "S" },
];

type ActiveDaysPickerProps = {
  disabled?: boolean;
  onChange: (days: number[]) => void;
  value: number[];
};

export function ActiveDaysPicker({ disabled, onChange, value }: ActiveDaysPickerProps) {
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      container: {
        gap: theme.spacing.sm,
      },
      fieldLabel: {
        color: theme.colors.textMuted,
        fontFamily: theme.fontFamilies.bodyMedium,
        fontSize: theme.typography.labelMd,
      },
      row: {
        flexDirection: "row",
        gap: 8,
      },
      circle: {
        alignItems: "center",
        backgroundColor: theme.colors.surface,
        borderRadius: CIRCLE_SIZE / 2,
        height: CIRCLE_SIZE,
        justifyContent: "center",
        width: CIRCLE_SIZE,
      },
      circleSelected: {
        backgroundColor: theme.colors.primary,
      },
      circleDisabled: {
        opacity: 0.4,
      },
      letter: {
        color: theme.colors.textMuted,
        fontFamily: theme.fontFamilies.bodySemi,
        fontSize: theme.typography.labelMd,
      },
      letterSelected: {
        color: theme.colors.primaryText,
      },
      scheduleLabel: {
        color: theme.colors.textFaint,
        fontFamily: theme.fontFamilies.body,
        fontSize: theme.typography.labelMd,
      },
    }),
  );

  function toggle(day: number) {
    if (disabled) return;
    const isSelected = value.includes(day);
    if (isSelected && value.length === 1) return; // last day — can't deselect
    const next = isSelected ? value.filter((d) => d !== day) : [...value, day];
    onChange(next.sort((a, b) => a - b));
  }

  const label = getActiveDaysLabel(value);

  return (
    <View style={styles.container}>
      <Text style={styles.fieldLabel}>Active days</Text>
      <View style={styles.row}>
        {DAY_LABELS.map(({ day, label: letter }) => {
          const isSelected = value.includes(day);
          const isLastRemaining = isSelected && value.length === 1;
          return (
            <Pressable
              key={day}
              accessibilityLabel={`Day ${day}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected, disabled: isLastRemaining || disabled }}
              disabled={disabled || isLastRemaining}
              onPress={() => toggle(day)}
              style={[
                styles.circle,
                isSelected && styles.circleSelected,
                (isLastRemaining || disabled) && styles.circleDisabled,
              ]}
            >
              <Text style={[styles.letter, isSelected && styles.letterSelected]}>
                {letter}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.scheduleLabel}>{label}</Text>
    </View>
  );
}

const CIRCLE_SIZE = 38;
