import { StyleSheet, View } from 'react-native';

import { BackButton } from './BackButton';
import { ProgressBar } from './ProgressBar';

type OnboardingHeaderProps = {
  currentStep: number;
  totalSteps?: number;
  onBack?: () => void;
  showBack?: boolean;
};

export function OnboardingHeader({
  currentStep,
  totalSteps = 7,
  onBack,
  showBack = true,
}: OnboardingHeaderProps) {
  return (
    <View style={styles.container}>
      {showBack ? (
        <BackButton onPress={onBack} />
      ) : (
        <View accessibilityElementsHidden style={styles.backSpacer} />
      )}
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
  backSpacer: {
    width: 40,
    height: 40,
  },
});
