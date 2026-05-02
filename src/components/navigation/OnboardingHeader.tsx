import { StyleSheet, View } from 'react-native';

import { BackButton } from './BackButton';
import { ProgressBar } from './ProgressBar';

type OnboardingHeaderProps = {
  currentStep: number;
  totalSteps?: number;
  onBack?: () => void;
};

export function OnboardingHeader({
  currentStep,
  totalSteps = 5,
  onBack,
}: OnboardingHeaderProps) {
  return (
    <View style={styles.container}>
      <BackButton onPress={onBack} />
      <ProgressBar currentStep={currentStep} totalSteps={totalSteps} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 44,
  },
});
