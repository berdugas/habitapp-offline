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

function GrowthIllustration() {
  return (
    <Svg width={220} height={150} viewBox="0 0 220 150">
      <Defs>
        <LinearGradient id="growGrad" x1="0" y1="75" x2="220" y2="75" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#446655" />
          <Stop offset="1" stopColor="#6b9e7d" />
        </LinearGradient>
      </Defs>

      {/* Small start circle */}
      <Circle cx={22} cy={112} r={10} fill="rgba(68,102,85,0.35)" />

      {/* Growing circles */}
      <Circle cx={62}  cy={96} r={17} fill="rgba(68,102,85,0.25)" />
      <Circle cx={112} cy={78} r={26} fill="rgba(68,102,85,0.18)" />

      {/* Large destination — halo + core */}
      <Circle cx={172} cy={58} r={42} fill="rgba(68,102,85,0.10)" />
      <Circle cx={172} cy={58} r={31} fill="rgba(68,102,85,0.16)" />
      <Circle cx={172} cy={58} r={21} fill="url(#growGrad)" />

    </Svg>
  );
}

export default function ShrinkInsightScreen() {
  const { update } = useOnboarding();

  const handleContinue = () => {
    update({ step: "shrink" });
    router.push("/(onboarding)/shrink");
  };

  return (
    <OnboardingLayout
      footer={<PrimaryButton label="Continue" showArrow onPress={handleContinue} />}
    >
      <View style={styles.header}>
        <BackButton
          onPress={() => {
            update({ step: "daily-action" });
            if (router.canGoBack()) router.back();
            else router.replace("/(onboarding)/daily-action");
          }}
        />
      </View>

      <View style={styles.illustration}>
        <GrowthIllustration />
      </View>

      <Text style={styles.headline}>
        Small habits grow into big ones. Not the other way around.
      </Text>

      <View style={styles.bodyContainer}>
        <Text style={styles.body}>
          The fastest way to build a lasting habit isn't to go big — it's to{" "}
          <Text style={styles.bodyPrimary}>
            start so small that showing up is effortless
          </Text>
          . Consistency comes first. Growth follows naturally.
        </Text>
        <Text style={styles.body}>
          One page becomes a chapter. One pushup becomes a workout. But only if
          you show up long enough for it to happen.
        </Text>
      </View>

      <View style={styles.callout}>
        <Text style={styles.calloutText}>
          Next, you'll shrink your action down to its smallest version — something
          you could do even on your worst day.
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
