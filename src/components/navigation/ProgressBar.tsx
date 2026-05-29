import { StyleSheet, View } from 'react-native';

import { useThemedStyles } from '@/theme/useThemedStyles';

type ProgressBarProps = {
  currentStep: number;
  totalSteps: number;
};

export function ProgressBar({ currentStep, totalSteps }: ProgressBarProps) {
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
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
        backgroundColor: t.colors.primary,
      },
      dotInactive: {
        width: 8,
        backgroundColor: t.colors.surfaceHigh,
      },
    }),
  );

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
