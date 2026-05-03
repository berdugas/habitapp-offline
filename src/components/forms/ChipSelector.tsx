import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/fontFamilies';
import { radius } from '@/theme/radius';

type ChipSelectorProps = {
  options: string[];
  selectedValue: string | null;
  onSelect: (value: string) => void;
};

export function ChipSelector({ options, selectedValue, onSelect }: ChipSelectorProps) {
  return (
    <View style={styles.container}>
      {options.map((option) => {
        const selected = selectedValue === option;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            onPress={() => onSelect(option)}
            style={({ pressed }) => [
              styles.chip,
              selected ? styles.chipSelected : styles.chipDefault,
              pressed && styles.chipPressed,
            ]}
          >
            <Text style={[styles.chipText, selected ? styles.chipTextSelected : styles.chipTextDefault]}>
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  chipDefault: {
    backgroundColor: colors.surface,
  },
  chipSelected: {
    backgroundColor: colors.primary,
  },
  chipPressed: {
    opacity: 0.8,
  },
  chipText: {
    fontSize: 14,
    fontFamily: fontFamilies.body,
  },
  chipTextDefault: {
    color: colors.text,
  },
  chipTextSelected: {
    color: colors.primaryText,
  },
});
