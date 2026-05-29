import { Pressable, StyleSheet, Text, View } from "react-native";

import { useThemedStyles } from "@/theme/useThemedStyles";

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
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      label: {
        color: theme.colors.text,
        fontFamily: theme.fontFamilies.bodySemi,
        fontSize: theme.typography.bodyMd,
      },
      pill: {
        // The border lives on both states so a selected pill doesn't shift
        // neighbors when toggled. Width is identical (1.5px); only color
        // changes between states.
        borderRadius: theme.radius.pill,
        borderWidth: 1.5,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.sm,
      },
      pillLabel: {
        fontSize: theme.typography.bodyMd,
      },
      pillLabelSelected: {
        // White-on-primary matches PrimaryButton's text style — the
        // selected state should read as decisively "chosen," not just
        // tinted. Pairs with the solid `colors.primary` background below.
        color: theme.colors.primaryText,
        fontFamily: theme.fontFamilies.bodyBold,
      },
      pillLabelUnselected: {
        color: theme.colors.textMuted,
        fontFamily: theme.fontFamilies.bodyMedium,
      },
      pillPressed: {
        opacity: 0.86,
      },
      pillRow: {
        flexDirection: "row",
        gap: theme.spacing.sm,
      },
      pillSelected: {
        backgroundColor: theme.colors.primary,
        borderColor: theme.colors.primary,
      },
      pillUnselected: {
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.surfaceHigh,
      },
      wrapper: {
        gap: theme.spacing.sm,
      },
    }),
  );

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
