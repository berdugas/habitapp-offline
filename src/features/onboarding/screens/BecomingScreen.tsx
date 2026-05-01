import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { ZenCard } from "@/components/cards/ZenCard";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

const EXAMPLES = [
  "a runner",
  "someone who reads daily",
  "a calmer person",
  "a writer",
  "someone who sleeps well",
];

export default function BecomingScreen() {
  const { draft, update } = useOnboarding();

  const handleContinue = () => {
    update({ step: "daily-action" });
    router.push("/(onboarding)/daily-action");
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={styles.screen}
    >
      <ZenCard padding="xxl">
        <Text selectable style={styles.header}>
          Who do you want to become?
        </Text>
        <TextInput
          autoCorrect
          multiline
          onChangeText={(text) => update({ becomingPhrase: text })}
          placeholder="Describe who you are becoming..."
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          value={draft.becomingPhrase}
        />
        <View style={styles.examples}>
          <Text selectable style={styles.examplesLabel}>
            For example:
          </Text>
          {EXAMPLES.map((example) => (
            <Text key={example} selectable style={styles.exampleItem}>
              {example}
            </Text>
          ))}
        </View>
      </ZenCard>

      <PrimaryButton
        disabled={draft.becomingPhrase.trim().length === 0}
        label="Continue"
        onPress={handleContinue}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    gap: spacing.xxl,
    justifyContent: "center",
    padding: spacing.xl,
  },
  exampleItem: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyLg,
    lineHeight: 24,
  },
  examples: {
    gap: spacing.md,
  },
  examplesLabel: {
    color: colors.text,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.bodyLg,
  },
  header: {
    color: colors.text,
    fontFamily: fontFamilies.displayBold,
    fontSize: typography.headlineLg,
    lineHeight: 36,
  },
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: typography.bodyLg,
    lineHeight: 24,
    minHeight: 80,
    padding: spacing.md,
  },
  screen: {
    backgroundColor: colors.bg,
    flex: 1,
  },
});
