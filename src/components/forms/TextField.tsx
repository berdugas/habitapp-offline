import { forwardRef, useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { radius } from "@/theme/radius";
import { shadows } from "@/theme/shadows";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

const DURATION = 180;

type TextFieldProps = {
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  error?: string | null;
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  value: string;
  variant?: "default" | "onboarding";
};

export const TextField = forwardRef<TextInput, TextFieldProps>(
  function TextField(
    {
      autoCapitalize = "sentences",
      error,
      label,
      multiline = false,
      onChangeText,
      placeholder,
      secureTextEntry = false,
      value,
      variant = "default",
    },
    ref,
  ) {
    const focusAnim = useRef(new Animated.Value(0)).current;

    const handleFocus = () => {
      Animated.timing(focusAnim, {
        duration: DURATION,
        toValue: 1,
        useNativeDriver: false,
      }).start();
    };

    const handleBlur = () => {
      Animated.timing(focusAnim, {
        duration: DURATION,
        toValue: 0,
        useNativeDriver: false,
      }).start();
    };

    const animatedBg = focusAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [colors.surface, colors.surfaceCard],
    });

    const animatedBorder = focusAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ["transparent", colors.primary],
    });

    const animatedLabelColor = focusAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [colors.textMuted, colors.primary],
    });

    if (variant === "onboarding") {
      return (
        <View style={styles.wrapper}>
          <Text style={styles.labelOnboarding}>{label}</Text>
          <View style={styles.inputContainerOnboarding}>
            <TextInput
              ref={ref}
              autoCapitalize={autoCapitalize}
              multiline={multiline}
              onChangeText={onChangeText}
              placeholder={placeholder}
              placeholderTextColor={colors.textFaint}
              secureTextEntry={secureTextEntry}
              style={[styles.inputOnboarding, multiline && styles.inputMultiline]}
              value={value}
            />
          </View>
          {error ? (
            <Text selectable style={styles.error}>
              {error}
            </Text>
          ) : null}
        </View>
      );
    }

    return (
      <View style={styles.wrapper}>
        <Animated.Text style={[styles.label, { color: animatedLabelColor }]}>
          {label}
        </Animated.Text>
        <Animated.View
          style={[
            styles.inputContainer,
            {
              backgroundColor: animatedBg,
              borderColor: animatedBorder,
            },
          ]}
        >
          <TextInput
            ref={ref}
            autoCapitalize={autoCapitalize}
            multiline={multiline}
            onBlur={handleBlur}
            onChangeText={onChangeText}
            onFocus={handleFocus}
            placeholder={placeholder}
            placeholderTextColor={colors.textFaint}
            secureTextEntry={secureTextEntry}
            style={[styles.input, multiline && styles.inputMultiline]}
            value={value}
          />
        </Animated.View>
        {error ? (
          <Text selectable style={styles.error}>
            {error}
          </Text>
        ) : null}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  error: {
    color: colors.danger,
    fontFamily: fontFamilies.body,
    fontSize: typography.labelMd,
  },
  input: {
    color: colors.text,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyLg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  inputContainer: {
    borderRadius: radius.sm,
    borderWidth: 1.5,
    boxShadow: shadows.lift,
    overflow: "hidden",
  },
  inputContainerOnboarding: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  inputOnboarding: {
    color: colors.text,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyLg,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  label: {
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.bodyMd,
  },
  labelOnboarding: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: typography.labelMd,
    color: colors.textMuted,
  },
  wrapper: {
    gap: spacing.sm,
  },
});
