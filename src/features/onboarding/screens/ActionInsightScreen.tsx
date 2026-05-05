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

function TrailsIllustration() {
  return (
    <Svg width={180} height={170} viewBox="0 0 180 170">
      <Defs>
        <LinearGradient id="coreGrad" x1="70" y1="65" x2="110" y2="105" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#446655" />
          <Stop offset="1" stopColor="#6b9e7d" />
        </LinearGradient>
      </Defs>

      {/* Trail: top-center */}
      <Circle cx={90} cy={14} r={6.5} fill="rgba(68,102,85,0.10)" />
      <Circle cx={90} cy={33} r={8.5} fill="rgba(68,102,85,0.16)" />
      <Circle cx={90} cy={52} r={11}  fill="rgba(68,102,85,0.24)" />

      {/* Trail: bottom-left */}
      <Circle cx={36} cy={138} r={6.5} fill="rgba(68,102,85,0.10)" />
      <Circle cx={52} cy={122} r={8.5} fill="rgba(68,102,85,0.16)" />
      <Circle cx={66} cy={108} r={11}  fill="rgba(68,102,85,0.24)" />

      {/* Trail: bottom-right */}
      <Circle cx={144} cy={138} r={6.5} fill="rgba(68,102,85,0.10)" />
      <Circle cx={128} cy={122} r={8.5} fill="rgba(68,102,85,0.16)" />
      <Circle cx={114} cy={108} r={11}  fill="rgba(68,102,85,0.24)" />

      {/* Central halo */}
      <Circle cx={90} cy={85} r={38} fill="rgba(68,102,85,0.10)" />
      <Circle cx={90} cy={85} r={28} fill="rgba(68,102,85,0.16)" />

      {/* Core */}
      <Circle cx={90} cy={85} r={20} fill="url(#coreGrad)" />
    </Svg>
  );
}

export default function ActionInsightScreen() {
  const { update } = useOnboarding();

  const handleContinue = () => {
    update({ step: "daily-action" });
    router.push("/(onboarding)/daily-action");
  };

  return (
    <OnboardingLayout
      footer={<PrimaryButton label="Continue" showArrow onPress={handleContinue} />}
    >
      <View style={styles.header}>
        <BackButton
          onPress={() => {
            update({ step: "becoming" });
            if (router.canGoBack()) router.back();
            else router.replace("/(onboarding)/becoming");
          }}
        />
      </View>

      <View style={styles.illustration}>
        <TrailsIllustration />
      </View>

      <Text style={styles.headline}>
        A habit without purpose is just a task on a list.
      </Text>

      <View style={styles.bodyContainer}>
        <Text style={styles.body}>
          You've described who you're becoming. Now pick an action that{" "}
          <Text style={styles.bodyPrimary}>directly serves that identity</Text>
          {" "}— not just something that sounds productive.
        </Text>
        <Text style={styles.body}>
          "Read for 10 minutes" serves{" "}
          <Text style={styles.bodyEmphasis}>becoming a reader</Text>. "Drink
          more water" doesn't. The clearer the connection, the more natural the
          habit feels.
        </Text>
      </View>

      <View style={styles.callout}>
        <Text style={styles.calloutText}>
          Next, you'll choose one action that brings you closer to the person
          you described. Ask yourself:{" "}
          <Text style={styles.calloutItalic}>would this person do this?</Text>
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
  bodyEmphasis: {
    fontFamily: fontFamilies.bodyMedium,
    color: colors.text,
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
  calloutItalic: {
    fontFamily: fontFamilies.body,
    fontStyle: "italic",
    color: colors.text,
  },
});
