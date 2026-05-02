import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

type NullableBooleanFieldProps = {
  label: string;
  onChange: (value: boolean | null) => void;
  value: boolean | null;
};

export function NullableBooleanField({
  label,
  onChange,
  value,
}: NullableBooleanFieldProps) {
  const options: { label: string; value: boolean }[] = [
    { label: "Yes", value: true },
    { label: "No", value: false },
  ];

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.pillRow}>
        {options.map((opt) => {
          const isSelected = value === opt.value;
          return (
            <Pressable
              accessibilityLabel={`${opt.label}${isSelected ? " selected" : ""}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              key={String(opt.value)}
              onPress={() => onChange(isSelected ? null : opt.value)}
              style={({ pressed }) => [
                styles.pill,
                isSelected && styles.pillSelected,
                pressed && styles.pillPressed,
              ]}
            >
              <Text style={[styles.pillLabel, isSelected && styles.pillLabelSelected]}>
                {opt.label}
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
    fontSize: typography.bodyMd,
    fontWeight: "600",
  },
  pill: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  pillLabel: {
    color: colors.text,
    fontSize: typography.bodyMd,
    fontWeight: "600",
  },
  pillLabelSelected: {
    color: colors.primaryText,
  },
  pillPressed: {
    opacity: 0.86,
  },
  pillRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  pillSelected: {
    backgroundColor: colors.primary,
  },
  wrapper: {
    gap: spacing.sm,
  },
});
