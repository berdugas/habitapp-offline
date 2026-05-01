import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { radius } from "@/theme/radius";
import { shadows } from "@/theme/shadows";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

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
              {isSelected ? (
                <LinearGradient
                  colors={[colors.primary, colors.primaryGradientEnd]}
                  end={{ x: 1, y: 1 }}
                  start={{ x: 0, y: 0 }}
                  style={styles.pillGradient}
                >
                  <Text style={[styles.pillLabel, styles.pillLabelSelected]}>
                    {option.label}
                  </Text>
                </LinearGradient>
              ) : (
                <View style={styles.pillInner}>
                  <Text style={styles.pillLabel}>{option.label}</Text>
                </View>
              )}
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
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.bodyMd,
  },
  pill: {
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  pillGradient: {
    boxShadow: shadows.lift,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  pillInner: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  pillLabel: {
    color: colors.text,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.bodyMd,
  },
  pillLabelSelected: {
    color: colors.primaryText,
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
    boxShadow: shadows.lift,
  },
  wrapper: {
    gap: spacing.sm,
  },
});
