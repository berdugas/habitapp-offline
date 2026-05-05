import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { BackButton } from "@/components/navigation/BackButton";
import { OnboardingLayout } from "@/components/layouts/OnboardingLayout";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";

function CueIllustration() {
  return (
    <Svg width={180} height={160} viewBox="0 0 180 160">
      <Defs>
        <LinearGradient id="moonGrad" x1="125" y1="38" x2="150" y2="63" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#446655" />
          <Stop offset="1" stopColor="#6b9e7d" />
        </LinearGradient>
      </Defs>

      {/* Subtle orbit ring */}
      <Circle cx={80} cy={80} r={68} stroke="rgba(68,102,85,0.07)" strokeWidth={1} fill="none" />

      {/* Large stable circle — existing routine */}
      <Circle cx={80} cy={80} r={48} fill="rgba(68,102,85,0.05)" />
      <Circle cx={80} cy={80} r={36} fill="rgba(68,102,85,0.08)" />
      <Circle cx={80} cy={80} r={24} fill="rgba(68,102,85,0.13)" />
      <Circle cx={80} cy={80} r={14} fill="rgba(68,102,85,0.20)" />

      {/* Small gradient moon — new habit nestled at upper-right */}
      <Circle cx={136} cy={46} r={16} fill="rgba(68,102,85,0.10)" />
      <Circle cx={136} cy={46} r={11} fill="rgba(68,102,85,0.18)" />
      <Circle cx={136} cy={46} r={7}  fill="url(#moonGrad)" />
    </Svg>
  );
}

export default function CueInsightScreen() {
  const { update } = useOnboarding();

  const handleContinue = () => {
    update({ step: "cue" });
    router.push("/(onboarding)/cue");
  };

  return (
    <OnboardingLayout
      footer={<PrimaryButton label="Continue" showArrow onPress={handleContinue} />}
    >
      <View style={styles.header}>
        <BackButton
          onPress={() => {
            update({ step: "shrink" });
            if (router.canGoBack()) router.back();
            else router.replace("/(onboarding)/shrink");
          }}
        />
      </View>

      <View style={styles.illustration}>
        <CueIllustration />
      </View>

      <Text style={styles.headline}>
        You don't need willpower if you have a trigger.
      </Text>

      <View style={styles.bodyContainer}>
        <Text style={styles.body}>
          The most reliable habits don't depend on motivation — they're{" "}
          <Text style={styles.bodyPrimary}>
            attached to something you already do
          </Text>
          . Your existing routine becomes the reminder.
        </Text>
        <Text style={styles.body}>
          "After I pour my morning coffee, I'll read one page." The coffee is
          the cue. No alarm needed, no decision to make.
        </Text>
      </View>

      <View style={styles.callout}>
        <Text style={styles.calloutText}>
          Next, you'll pick something you already do every day and attach your
          new habit to it. Think about the moments in your day that happen like
          clockwork.
        </Text>
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.xl,
  },
  illustration: {
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
