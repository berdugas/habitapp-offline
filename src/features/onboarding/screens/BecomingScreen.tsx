import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import { colors } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { shadows } from "@/theme/shadows";
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
      <View style={styles.card}>
        <Text selectable style={styles.header}>
          Who do you want to become?
        </Text>
        <TextInput
          autoCorrect
          multiline
          onChangeText={(text) => update({ becomingPhrase: text })}
          placeholder="Describe who you are becoming..."
          placeholderTextColor={colors.textMuted}
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
      </View>

      <PrimaryButton
        disabled={draft.becomingPhrase.trim().length === 0}
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
