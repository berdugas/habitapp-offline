import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { ZenCard } from "@/components/cards/ZenCard";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

const COACHING_PARAGRAPH =
  "Habits form through repetition, not intensity. The smaller the action, " +
  "the more reliable it becomes. Most people start too big and quit. " +
  "Start absurdly small. You can always do more on the day. The goal is " +
  "showing up, not achieving.";

const EXAMPLES = [
  "Run for 2 minutes",
  "Read one page",
  "Sit quietly for one breath",
];

export default function ShrinkScreen() {
  const { draft, update } = useOnboarding();

  const handleContinue = () => {
    update({ step: "cue" });
    router.push("/(onboarding)/cue");
  };

  const headerCopy =
    draft.worstDayPassed === false
      ? "Let's make it smaller. What would survive a hard day?"
      : "That's a great direction. Now let's make it laughably small for tomorrow.";

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={styles.screen}
    >
      <ZenCard padding="xxl">
        <Text selectable style={styles.header}>
          {headerCopy}
        </Text>
        <TextInput
          autoCorrect
          multiline
          onChangeText={(text) => update({ tinyAction: text })}
          placeholder=""
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          value={draft.tinyAction}
        />
        <Text selectable style={styles.coaching}>
          {COACHING_PARAGRAPH}
        </Text>
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
        disabled={draft.tinyAction.trim().length === 0}
        label="Continue"
        onPress={handleContinue}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  coaching: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyLg,
    lineHeight: 24,
  },
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
