import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/useTheme";
import { useThemedStyles } from "@/theme/useThemedStyles";

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
  const theme = useTheme();
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      button: {
        borderRadius: t.radius.pill,
        overflow: "hidden",
      },
      buttonEnabled: {
        boxShadow: t.shadows.button,
      },
      buttonDisabled: {
        backgroundColor: t.colors.surfaceHigh,
      },
      buttonPressed: {
        opacity: 0.92,
      },
      inner: {
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "center",
        paddingHorizontal: t.spacing.xxl,
        paddingVertical: t.spacing.lg + 2,
        gap: 10,
      },
      label: {
        color: t.colors.primaryText,
        fontFamily: t.fontFamilies.bodyBold,
        fontSize: t.typography.bodyLg,
        letterSpacing: 0.16,
      },
      labelDisabled: {
        color: t.colors.textFaint,
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
        disabled ? styles.buttonDisabled : styles.buttonEnabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      {disabled ? (
        <View style={styles.inner}>
          <Text style={[styles.label, styles.labelDisabled]}>{label}</Text>
          {showArrow && (
            <ArrowRight color={theme.colors.textFaint} size={16} strokeWidth={2} />
          )}
        </View>
      ) : (
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.primaryGradientEnd]}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={styles.inner}
        >
          <Text style={styles.label}>{label}</Text>
          {showArrow && (
            <ArrowRight color={theme.colors.primaryText} size={16} strokeWidth={2} />
          )}
        </LinearGradient>
      )}
    </Pressable>
  );
}
