import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/useTheme";
import { useThemedStyles } from "@/theme/useThemedStyles";

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
  const theme = useTheme();
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      label: {
        color: t.colors.text,
        fontFamily: t.fontFamilies.bodySemi,
        fontSize: t.typography.bodyMd,
      },
      pill: {
        borderRadius: t.radius.pill,
        overflow: "hidden",
      },
      pillGradient: {
        boxShadow: t.shadows.lift,
        paddingHorizontal: t.spacing.lg,
        paddingVertical: t.spacing.sm,
      },
      pillInner: {
        backgroundColor: t.colors.surface,
        paddingHorizontal: t.spacing.lg,
        paddingVertical: t.spacing.sm,
      },
      pillLabel: {
        color: t.colors.text,
        fontFamily: t.fontFamilies.bodySemi,
        fontSize: t.typography.bodyMd,
      },
      pillLabelSelected: {
        color: t.colors.primaryText,
      },
      pillPressed: {
        opacity: 0.86,
      },
      pillRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: t.spacing.sm,
      },
      pillSelected: {
        boxShadow: t.shadows.lift,
      },
      wrapper: {
        gap: t.spacing.sm,
      },
    }),
  );

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
                  colors={[theme.colors.primary, theme.colors.primaryGradientEnd]}
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
