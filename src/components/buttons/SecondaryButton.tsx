import { Pressable, StyleSheet, Text } from "react-native";

import { useThemedStyles } from "@/theme/useThemedStyles";

type SecondaryButtonProps = {
  disabled?: boolean;
  isDanger?: boolean;
  label: string;
  onPress: () => void;
};

export function SecondaryButton({
  disabled = false,
  isDanger = false,
  label,
  onPress,
}: SecondaryButtonProps) {
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      button: {
        alignItems: "center",
        backgroundColor: theme.colors.surfaceCard,
        borderRadius: theme.radius.pill,
        boxShadow: theme.shadows.lift,
        paddingHorizontal: theme.spacing.xxl,
        paddingVertical: theme.spacing.lg + 2,
      },
      buttonDisabled: {
        opacity: 0.55,
      },
      buttonPressed: {
        opacity: 0.88,
      },
      label: {
        color: theme.colors.text,
        fontFamily: theme.fontFamilies.bodySemi,
        fontSize: theme.typography.bodyLg,
      },
      labelDanger: {
        color: theme.colors.danger,
      },
    }),
  );

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      <Text style={[styles.label, isDanger && styles.labelDanger]}>{label}</Text>
    </Pressable>
  );
}
