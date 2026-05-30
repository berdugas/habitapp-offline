import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useThemedStyles } from '@/theme/useThemedStyles';

type ChipSelectorProps = {
  options: string[];
  selectedValue: string | null;
  onSelect: (value: string) => void;
};

export function ChipSelector({ options, selectedValue, onSelect }: ChipSelectorProps) {
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      container: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
      },
      chip: {
        borderRadius: theme.radius.pill,
        paddingVertical: 10,
        paddingHorizontal: 18,
      },
      chipDefault: {
        backgroundColor: theme.colors.surface,
      },
      chipSelected: {
        backgroundColor: theme.colors.primary,
      },
      chipPressed: {
        opacity: 0.8,
      },
      chipText: {
        fontSize: theme.typography.bodyMd,
        fontFamily: theme.fontFamilies.body,
      },
      chipTextDefault: {
        color: theme.colors.text,
      },
      chipTextSelected: {
        color: theme.colors.primaryText,
      },
    }),
  );

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
