import { forwardRef } from 'react';
import { PenLine } from 'lucide-react-native';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '@/theme/useTheme';
import { useThemedStyles } from '@/theme/useThemedStyles';

type OnboardingInputProps = {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
};

export const OnboardingInput = forwardRef<TextInput, OnboardingInputProps>(
  function OnboardingInput({ label, placeholder, value, onChangeText, onBlur }, ref) {
    const theme = useTheme();
    const styles = useThemedStyles((t) =>
      StyleSheet.create({
        label: {
          fontSize: t.typography.labelMd,
          fontFamily: t.fontFamilies.bodyMedium,
          color: t.colors.primary,
          marginBottom: 8,
          paddingLeft: 4,
        },
        inputContainer: {
          backgroundColor: t.colors.surfaceCard,
          borderRadius: t.radius.md,
          paddingVertical: 12,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          boxShadow: t.shadows.inputField,
        },
        input: {
          flex: 1,
          fontSize: 15,
          fontFamily: t.fontFamilies.body,
          color: t.colors.text,
        },
      }),
    );

    return (
      <View>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.inputContainer}>
          <PenLine color={theme.colors.primary} size={18} strokeWidth={1.5} />
          <TextInput
            ref={ref}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.textFaint}
            style={styles.input}
            value={value}
            onBlur={onBlur}
            onChangeText={onChangeText}
          />
        </View>
      </View>
    );
  },
);
