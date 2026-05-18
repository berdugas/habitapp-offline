import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { ConcentricRings } from "@/components/branding/ConcentricRings";
import { BackButton } from "@/components/navigation/BackButton";
import { OnboardingLayout } from "@/components/layouts/OnboardingLayout";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";

export default function InsightScreen() {
  const { update } = useOnboarding();

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

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.xl,
  },
  rings: {
    alignSelf: "center",
    marginBottom: spacing.xxl,
  },
  headline: {
    fontFamily: fontFamilies.displaySemi,
    fontSize: 23,
    lineHeight: 30,
    color: colors.text,
    marginBottom: spacing.xl,
  },
  bodyContainer: {
    gap: spacing.lg,
    marginBottom: spacing.xxl,
  },
  body: {
    fontFamily: fontFamilies.body,
    fontSize: 15,
    lineHeight: 24,
    color: colors.textMuted,
  },
  bodyEmphasis: {
    fontFamily: fontFamilies.bodyMedium,
    color: colors.text,
  },
  bodyPrimary: {
    fontFamily: fontFamilies.bodySemi,
    color: colors.primary,
  },
  callout: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.lg,
  },
  calloutText: {
    fontFamily: fontFamilies.body,
    fontSize: 13.5,
    lineHeight: 21,
    color: colors.textMuted,
  },
});
