import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { AppLogo } from "@/components/branding/AppLogo";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { OnboardingLayout } from "@/components/layouts/OnboardingLayout";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import { useThemedStyles } from "@/theme/useThemedStyles";

export default function WelcomeScreen() {
  const { update } = useOnboarding();
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      logoContainer: {
        alignItems: "center",
        paddingTop: 180,
        marginBottom: 80,
      },
      headline: {
        fontFamily: theme.fontFamilies.displayBold,
        fontSize: 30,
        lineHeight: 35.4,
        color: theme.colors.text,
        marginBottom: 12,
      },
      subhead: {
        fontFamily: theme.fontFamilies.body,
        fontSize: theme.typography.bodyLg,
        lineHeight: 22.4,
        color: theme.colors.textMuted,
        letterSpacing: 0.32,
        marginBottom: 8,
      },
    }),
  );

  const handleBegin = () => {
    update({ step: "insight" });
    router.push("/(onboarding)/insight");
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
