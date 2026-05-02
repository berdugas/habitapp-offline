import { PenLine } from 'lucide-react-native';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/fontFamilies';
import { radius } from '@/theme/radius';
import { shadows } from '@/theme/shadows';

type OnboardingInputProps = {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
};

export function OnboardingInput({
  label,
  placeholder,
  value,
  onChangeText,
}: OnboardingInputProps) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputContainer}>
        <PenLine color={colors.primary} size={18} strokeWidth={1.5} />
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontFamily: fontFamilies.bodyMedium,
    color: colors.primary,
    marginBottom: 8,
    paddingLeft: 4,
  },
  inputContainer: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    paddingVertical: 16,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    boxShadow: shadows.inputField,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: fontFamilies.body,
    color: colors.text,
  },
});
