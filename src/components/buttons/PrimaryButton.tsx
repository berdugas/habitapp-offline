import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text } from "react-native";

import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { radius } from "@/theme/radius";
import { shadows } from "@/theme/shadows";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

type PrimaryButtonProps = {
  disabled?: boolean;
  label: string;
  onPress: () => void;
};

export function PrimaryButton({
  disabled = false,
  label,
  onPress,
}: PrimaryButtonProps) {
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
      <LinearGradient
        colors={[colors.primary, colors.primaryGradientEnd]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.gradient}
      >
        <Text style={styles.label}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.pill,
    boxShadow: shadows.button,
    overflow: "hidden",
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonPressed: {
    opacity: 0.92,
  },
  gradient: {
    alignItems: "center",
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg + 2,
  },
  label: {
    color: colors.primaryText,
    fontFamily: fontFamilies.bodyBold,
    fontSize: typography.bodyLg,
    letterSpacing: 0.16,
  },
});
