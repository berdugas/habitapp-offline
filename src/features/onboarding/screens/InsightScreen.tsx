import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { ConcentricRings } from "@/components/branding/ConcentricRings";
import { BackButton } from "@/components/navigation/BackButton";
import { OnboardingLayout } from "@/components/layouts/OnboardingLayout";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import { useThemedStyles } from "@/theme/useThemedStyles";

export default function InsightScreen() {
  const { update } = useOnboarding();
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      header: {
        marginBottom: theme.spacing.xl,
      },
      rings: {
        alignSelf: "center",
        marginBottom: theme.spacing.xxl,
      },
      headline: {
        fontFamily: theme.fontFamilies.displaySemi,
        fontSize: 23,
        lineHeight: 30,
        color: theme.colors.text,
        marginBottom: theme.spacing.xl,
      },
      bodyContainer: {
        gap: theme.spacing.lg,
        marginBottom: theme.spacing.xxl,
      },
      body: {
        fontFamily: theme.fontFamilies.body,
        fontSize: 15,
        lineHeight: 24,
        color: theme.colors.textMuted,
      },
      bodyEmphasis: {
        fontFamily: theme.fontFamilies.bodyMedium,
        color: theme.colors.text,
      },
      bodyPrimary: {
        fontFamily: theme.fontFamilies.bodySemi,
        color: theme.colors.primary,
      },
      callout: {
        backgroundColor: theme.colors.surface,
        borderRadius: 12,
        padding: theme.spacing.lg,
      },
      calloutText: {
        fontFamily: theme.fontFamilies.body,
        fontSize: 13.5,
        lineHeight: 21,
        color: theme.colors.textMuted,
      },
    }),
  );

  const handleContinue = () => {
    update({ step: "becoming" });
    router.push("/(onboarding)/becoming");
  };

  return (
    <OnboardingLayout
      footer={<PrimaryButton label="Continue" showArrow onPress={handleContinue} />}
    >
      <View style={styles.header}>
        <BackButton
          onPress={() => {
            update({ step: "welcome" });
            if (router.canGoBack()) router.back();
            else router.replace("/(onboarding)/welcome");
          }}
        />
      </View>

      <ConcentricRings size={120} style={styles.rings} />

      <Text style={styles.headline}>
        The habits that last are the ones that feel like you.
      </Text>

      <View style={styles.bodyContainer}>
        <Text style={styles.body}>
          Most approaches start with{" "}
          <Text style={styles.bodyEmphasis}>what to do</Text>. But research
          shows something surprising: habits connected to{" "}
          <Text style={styles.bodyPrimary}>who you want to become</Text> stick
          far longer.
        </Text>
        <Text style={styles.body}>
          "I'm a runner" outlasts "I run 3× a week" — because it turns
          discipline into self‑expression.
        </Text>
      </View>

      <View style={styles.callout}>
        <Text style={styles.calloutText}>
          Next, we'll ask you to describe the person you're becoming. There's
          no wrong answer — just what feels true right now.
        </Text>
      </View>
    </OnboardingLayout>
  );
}
