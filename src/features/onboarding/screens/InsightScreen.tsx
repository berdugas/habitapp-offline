import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { BackButton } from "@/components/navigation/BackButton";
import { OnboardingLayout } from "@/components/layouts/OnboardingLayout";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";

const RING_SIZE = 120;

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

      <View style={styles.ringsContainer}>
        <View style={[styles.ring, { top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(68,102,85,0.07)" }]} />
        <View style={[styles.ring, { top: 16, left: 16, right: 16, bottom: 16, backgroundColor: "rgba(68,102,85,0.13)" }]} />
        <View style={[styles.ring, { top: 32, left: 32, right: 32, bottom: 32, backgroundColor: "rgba(68,102,85,0.20)" }]} />
        <View style={[styles.ring, { top: 48, left: 48, right: 48, bottom: 48, backgroundColor: colors.primary }]} />
      </View>

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
  ringsContainer: {
    alignSelf: "center",
    width: RING_SIZE,
    height: RING_SIZE,
    marginBottom: spacing.xxl,
  },
  ring: {
    position: "absolute",
    borderRadius: 999,
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
