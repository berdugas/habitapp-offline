import { router } from "expo-router";
import { StyleSheet, Text } from "react-native";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { ChipSelector } from "@/components/forms/ChipSelector";
import { OnboardingInput } from "@/components/forms/OnboardingInput";
import { OnboardingLayout } from "@/components/layouts/OnboardingLayout";
import { OnboardingHeader } from "@/components/navigation/OnboardingHeader";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";

const CHIP_OPTIONS = [
  "a runner",
  "someone who reads daily",
  "a calmer person",
  "a better partner",
  "someone who saves consistently",
  "a writer",
  "a present parent",
];

export default function BecomingScreen() {
  const { draft, update } = useOnboarding();

  const handleContinue = () => {
    update({ step: "action-insight" });
    router.push("/(onboarding)/action-insight");
  };

  const handleChipSelect = (value: string) => {
    update({ becomingPhrase: value });
  };

  return (
    <OnboardingLayout
      keyboardAware
      footer={
        <PrimaryButton
          disabled={draft.becomingPhrase.trim().length < 2}
          label="Continue"
          showArrow
          onPress={handleContinue}
        />
      }
    >
      <OnboardingHeader
        currentStep={1}
        onBack={() => {
          update({ step: "insight" });
          if (router.canGoBack()) router.back();
          else router.replace("/(onboarding)/insight");
        }}
      />

      <Text style={styles.eyebrow}>
        Habits stick when they connect to who you want to be.
      </Text>
      <Text style={styles.headline}>Who do you want to become?</Text>

      <OnboardingInput
        label="Your answer"
        placeholder="Describe who you are becoming..."
        value={draft.becomingPhrase}
        onChangeText={(text) => update({ becomingPhrase: text })}
      />

      <Text style={styles.chipsLabel}>Try one of these</Text>
      <ChipSelector
        options={CHIP_OPTIONS}
        selectedValue={CHIP_OPTIONS.includes(draft.becomingPhrase) ? draft.becomingPhrase : null}
        onSelect={handleChipSelect}
      />
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 14,
    lineHeight: 21,
    color: colors.primary,
    marginBottom: 8,
  },
  headline: {
    fontFamily: fontFamilies.displayBold,
    fontSize: 28,
    lineHeight: 33,
    color: colors.text,
    marginBottom: 20,
  },
  chipsLabel: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 13,
    color: colors.textFaint,
    marginTop: 20,
    marginBottom: 10,
  },
});
