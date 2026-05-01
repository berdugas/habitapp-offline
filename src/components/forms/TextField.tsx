import { forwardRef } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { colors } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";

type TextFieldProps = {
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  error?: string | null;
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  value: string;
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
    },
    ref,
  ) {
    return (
      <View style={styles.wrapper}>
        <Text selectable style={styles.label}>
          {label}
        </Text>
        <TextInput
          ref={ref}
          autoCapitalize={autoCapitalize}
          multiline={multiline}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secureTextEntry}
          style={[styles.input, multiline && styles.inputMultiline]}
          value={value}
        />
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
    fontSize: 13,
  },
  input: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  inputMultiline: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  wrapper: {
    gap: spacing.sm,
  },
});
