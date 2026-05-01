import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";

type ChoicePillOption = {
  label: string;
  value: string;
};

type ChoicePillsProps = {
  label: string;
  onChange: (value: string) => void;
  options: ChoicePillOption[];
  value: string;
};

export function ChoicePills({
  label,
  onChange,
  options,
  value,
}: ChoicePillsProps) {
  const displayedOptions =
    value && !options.some((option) => option.value === value)
      ? [...options, { label: value, value }]
      : options;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.pillRow}>
        {displayedOptions.map((option) => {
          const isSelected = option.value === value;
          const accessibilityLabel = `${option.label} ${label.toLowerCase()}${
            isSelected ? " selected" : ""
          }`;

          return (
            <Pressable
              accessibilityLabel={accessibilityLabel}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              key={option.value}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                styles.pill,
                isSelected && styles.pillSelected,
                pressed && styles.pillPressed,
              ]}
            >
              <Text
                style={[styles.pillLabel, isSelected && styles.pillLabelSelected]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  pill: {
    backgroundColor: colors.surfaceCard,
    borderColor: 'transparent',
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  pillLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  pillLabelSelected: {
    color: colors.surfaceCard,
  },
  pillPressed: {
    opacity: 0.86,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  pillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  wrapper: {
    gap: spacing.sm,
  },
});
