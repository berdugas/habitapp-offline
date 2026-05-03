import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { AppLogo } from "@/components/branding/AppLogo";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { OnboardingLayout } from "@/components/layouts/OnboardingLayout";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";

export default function WelcomeScreen() {
  const { update } = useOnboarding();

  const handleBegin = () => {
    update({ step: "becoming" });
    router.push("/(onboarding)/becoming");
  };

  return (
    <OnboardingLayout footer={<PrimaryButton label="Begin" showArrow onPress={handleBegin} />}>
      <View style={styles.logoContainer}>
        <AppLogo size={56} />
      </View>

      <Text style={styles.headline}>Let's build your first habit.</Text>
      <Text style={styles.subhead}>We'll walk you through it — step by step.</Text>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  logoContainer: {
    alignItems: "center",
    paddingTop: 180,
    marginBottom: 80,
  },
  headline: {
    fontFamily: fontFamilies.displayBold,
    fontSize: 30,
    lineHeight: 35.4,
    color: colors.text,
    marginBottom: 12,
  },
  subhead: {
    fontFamily: fontFamilies.body,
    fontSize: 16,
    lineHeight: 25.6,
    color: colors.textMuted,
    letterSpacing: 0.32,
    marginBottom: 8,
  },
});
