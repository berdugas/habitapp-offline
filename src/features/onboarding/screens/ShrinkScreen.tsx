import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import { colors } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { shadows } from "@/theme/shadows";
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
      <View style={styles.card}>
        <Text selectable style={styles.header}>
          {headerCopy}
        </Text>
        <TextInput
          autoCorrect
          multiline
          onChangeText={(text) => update({ tinyAction: text })}
          placeholder=""
          placeholderTextColor={colors.textMuted}
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
      </View>

      <PrimaryButton
        disabled={draft.tinyAction.trim().length === 0}
        label="Continue"
        onPress={handleContinue}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    boxShadow: shadows.card,
    gap: spacing.lg,
    padding: spacing.xxl,
  },
  coaching: {
    color: colors.textMuted,
    fontSize: typography.body,
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
    fontSize: typography.body,
    lineHeight: 24,
  },
  examples: {
    gap: spacing.md,
  },
  examplesLabel: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "600",
  },
  header: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: "800",
    lineHeight: 36,
  },
  input: {
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 24,
    minHeight: 80,
    padding: spacing.md,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
});
