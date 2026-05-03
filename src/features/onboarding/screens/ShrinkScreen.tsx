import { router } from "expo-router";
import { CheckCircle } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { GuidanceCard } from "@/components/cards/GuidanceCard";
import { GuidanceExample } from "@/components/cards/GuidanceExample";
import { OnboardingInput } from "@/components/forms/OnboardingInput";
import { OnboardingLayout } from "@/components/layouts/OnboardingLayout";
import { OnboardingHeader } from "@/components/navigation/OnboardingHeader";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";

export default function ShrinkScreen() {
  const { draft, update } = useOnboarding();

  const handleContinue = () => {
    update({ step: "cue" });
    router.push("/(onboarding)/cue");
  };

  return (
    <OnboardingLayout
      keyboardAware
      footer={
        <PrimaryButton
          disabled={draft.tinyAction.trim().length < 2}
          label="Continue"
          showArrow
          onPress={handleContinue}
        />
      }
    >
      <OnboardingHeader
        currentStep={3}
        onBack={() => {
          update({ step: "daily-action" });
          if (router.canGoBack()) router.back();
          else router.replace("/(onboarding)/daily-action");
        }}
      />

      <Text style={styles.headline}>Now make the action laughably small.</Text>
      <Text style={styles.body}>
        The goal is showing up, not achieving. Start so small you can't say no.
      </Text>

      {draft.dailyAction.trim().length > 0 && (
        <View style={styles.contextChip}>
          <CheckCircle color={colors.primary} size={16} strokeWidth={1.8} />
          <Text style={styles.contextText}>
            Your action:{" "}
            <Text style={styles.contextBold}>{draft.dailyAction}</Text>
          </Text>
        </View>
      )}

      <OnboardingInput
        label="Your tiny version"
        placeholder="Make it even smaller..."
        value={draft.tinyAction}
        onChangeText={(text) => update({ tinyAction: text })}
      />

      <GuidanceCard
        title="How small is small enough?"
        body="Shrink it until you could do it on your worst, most exhausting day — and still say 'I showed up.'"
      >
        <GuidanceExample
          before="Run for 10 minutes →"
          after="Put on my running shoes"
        />
        <GuidanceExample
          before="Read for 30 minutes →"
          after="Read one page"
        />
        <GuidanceExample
          before="Meditate for 20 minutes →"
          after="Sit quietly for one breath"
        />
      </GuidanceCard>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  headline: {
    fontFamily: fontFamilies.displayBold,
    fontSize: 28,
    lineHeight: 33,
    color: colors.text,
    marginBottom: 12,
  },
  body: {
    fontFamily: fontFamilies.body,
    fontSize: 15,
    lineHeight: 23,
    color: colors.textMuted,
    marginBottom: 16,
  },
  contextChip: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  contextText: {
    fontFamily: fontFamilies.body,
    fontSize: 14,
    color: colors.text,
    flex: 1,
  },
  contextBold: {
    fontFamily: fontFamilies.bodySemi,
  },
});
