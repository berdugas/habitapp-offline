import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme/colors';

type ProgressBarProps = {
  currentStep: number;
  totalSteps: number;
};

export function ProgressBar({ currentStep, totalSteps }: ProgressBarProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: totalSteps }, (_, i) => (
        <View
          key={i}
          style={[styles.dot, i + 1 === currentStep ? styles.dotActive : styles.dotInactive]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 4,
    borderRadius: 2,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.primary,
  },
  dotInactive: {
    width: 8,
    backgroundColor: colors.surfaceHigh,
  },
});
