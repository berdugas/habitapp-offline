import { forwardRef, useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useTheme } from "@/theme/useTheme";
import { useThemedStyles } from "@/theme/useThemedStyles";

const DURATION = 180;

type TextFieldProps = {
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  disabled?: boolean;
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
      disabled = false,
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
    const theme = useTheme();
    const styles = useThemedStyles((t) =>
      StyleSheet.create({
        error: {
          color: t.colors.danger,
          fontFamily: t.fontFamilies.body,
          fontSize: t.typography.labelMd,
        },
        input: {
          color: t.colors.text,
          fontFamily: t.fontFamilies.body,
          fontSize: t.typography.bodyLg,
          paddingHorizontal: t.spacing.lg,
          paddingVertical: t.spacing.md,
        },
        inputContainer: {
          borderRadius: t.radius.sm,
          borderWidth: 1.5,
          boxShadow: t.shadows.lift,
          overflow: "hidden",
        },
        inputContainerDisabled: {
          backgroundColor: t.colors.surfaceHigh,
          borderColor: "transparent",
        },
        inputContainerOnboarding: {
          backgroundColor: t.colors.surfaceHigh,
          borderRadius: t.radius.md,
          overflow: "hidden",
        },
        inputDisabled: {
          color: t.colors.textMuted,
        },
        inputOnboarding: {
          color: t.colors.text,
          fontFamily: t.fontFamilies.body,
          fontSize: t.typography.bodyLg,
          paddingHorizontal: 18,
          paddingVertical: 14,
        },
        inputMultiline: {
          minHeight: 100,
          textAlignVertical: "top",
        },
        label: {
          fontFamily: t.fontFamilies.bodySemi,
          fontSize: t.typography.bodyMd,
        },
        labelDisabled: {
          color: t.colors.textMuted,
        },
        labelOnboarding: {
          fontFamily: t.fontFamilies.bodyMedium,
          fontSize: t.typography.labelMd,
          color: t.colors.textMuted,
        },
        wrapper: {
          gap: t.spacing.sm,
        },
      }),
    );

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
      outputRange: [theme.colors.surface, theme.colors.surfaceCard],
    });

    const animatedBorder = focusAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ["transparent", theme.colors.primary],
    });

    const animatedLabelColor = focusAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [theme.colors.textMuted, theme.colors.primary],
    });

    if (variant === "onboarding") {
      return (
        <View style={styles.wrapper}>
          <Text
            style={[
              styles.labelOnboarding,
              disabled && styles.labelDisabled,
            ]}
          >
            {label}
          </Text>
          <View style={styles.inputContainerOnboarding}>
            <TextInput
              ref={ref}
              autoCapitalize={autoCapitalize}
              editable={!disabled}
              multiline={multiline}
              onChangeText={onChangeText}
              placeholder={placeholder}
              placeholderTextColor={theme.colors.textFaint}
              secureTextEntry={secureTextEntry}
              style={[
                styles.inputOnboarding,
                multiline && styles.inputMultiline,
                disabled && styles.inputDisabled,
              ]}
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

    // The default variant's focus animation is irrelevant when disabled —
    // skip the animated colors and render a static muted container so the
    // field looks visibly inert without a layout shift.
    if (disabled) {
      return (
        <View style={styles.wrapper}>
          <Text style={[styles.label, styles.labelDisabled]}>{label}</Text>
          <View style={[styles.inputContainer, styles.inputContainerDisabled]}>
            <TextInput
              ref={ref}
              autoCapitalize={autoCapitalize}
              editable={false}
              multiline={multiline}
              onChangeText={onChangeText}
              placeholder={placeholder}
              placeholderTextColor={theme.colors.textFaint}
              secureTextEntry={secureTextEntry}
              style={[
                styles.input,
                multiline && styles.inputMultiline,
                styles.inputDisabled,
              ]}
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
            placeholderTextColor={theme.colors.textFaint}
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
