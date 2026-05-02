import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

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
  showArrow?: boolean;
};

export function PrimaryButton({
  disabled = false,
  label,
  onPress,
  showArrow = false,
}: PrimaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        disabled ? styles.buttonDisabled : styles.buttonEnabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      {disabled ? (
        <View style={styles.inner}>
          <Text style={[styles.label, styles.labelDisabled]}>{label}</Text>
          {showArrow && (
            <ArrowRight color={colors.textFaint} size={16} strokeWidth={2} />
          )}
        </View>
      ) : (
        <LinearGradient
          colors={[colors.primary, colors.primaryGradientEnd]}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={styles.inner}
        >
          <Text style={styles.label}>{label}</Text>
          {showArrow && (
            <ArrowRight color={colors.primaryText} size={16} strokeWidth={2} />
          )}
        </LinearGradient>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  buttonEnabled: {
    boxShadow: shadows.button,
  },
  buttonDisabled: {
    backgroundColor: colors.surfaceHigh,
  },
  buttonPressed: {
    opacity: 0.92,
  },
  inner: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg + 2,
    gap: 10,
  },
  label: {
    color: colors.primaryText,
    fontFamily: fontFamilies.bodyBold,
    fontSize: typography.bodyLg,
    letterSpacing: 0.16,
  },
  labelDisabled: {
    color: colors.textFaint,
  },
});
