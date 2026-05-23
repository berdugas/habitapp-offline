import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
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
              accessibilityLabel={`${label}: ${opt.label}${isSelected ? " selected" : ""}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              key={String(opt.value)}
              onPress={() => onChange(isSelected ? null : opt.value)}
              style={({ pressed }) => [
                styles.pill,
                isSelected ? styles.pillSelected : styles.pillUnselected,
                pressed && styles.pillPressed,
              ]}
            >
              <Text
                style={[
                  styles.pillLabel,
                  isSelected
                    ? styles.pillLabelSelected
                    : styles.pillLabelUnselected,
                ]}
              >
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
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.bodyMd,
  },
  pill: {
    // The border lives on both states so a selected pill doesn't shift
    // neighbors when toggled. Width is identical (1.5px); only color
    // changes between states.
    borderRadius: radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  pillLabel: {
    fontSize: typography.bodyMd,
  },
  pillLabelSelected: {
    // White-on-primary matches PrimaryButton's text style — the
    // selected state should read as decisively "chosen," not just
    // tinted. Pairs with the solid `colors.primary` background below.
    color: colors.primaryText,
    fontFamily: fontFamilies.bodyBold,
  },
  pillLabelUnselected: {
    color: colors.textMuted,
    fontFamily: fontFamilies.bodyMedium,
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
    borderColor: colors.primary,
  },
  pillUnselected: {
    backgroundColor: colors.surface,
    borderColor: colors.surfaceHigh,
  },
  wrapper: {
    gap: spacing.sm,
  },
});
