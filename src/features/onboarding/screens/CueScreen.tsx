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
  "A routine cue beats a clock cue. Tying your habit to something you already " +
  "do every day means you don't have to remember — the previous action " +
  "becomes the reminder. Pick something that happens reliably without effort.";

const EXAMPLE_ROUTINES = [
  "after morning coffee",
  "after I brush my teeth",
  "after my last meeting",
  "before I make dinner",
  "when I sit down at my desk",
];

export default function CueScreen() {
  const { draft, update } = useOnboarding();

  const canContinue =
    draft.cueExisting.trim().length > 0 && draft.tinyAction.trim().length > 0;

  const handleContinue = () => {
    update({ step: "worst-day" });
    router.push("/(onboarding)/worst-day");
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
          What will trigger it?
        </Text>

        <View style={styles.field}>
          <Text selectable style={styles.label}>
            After I
          </Text>
          <TextInput
            autoCorrect
            multiline
            onChangeText={(text) => update({ cueExisting: text })}
            placeholder="my morning coffee"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={draft.cueExisting}
          />
        </View>

        <View style={styles.field}>
          <Text selectable style={styles.label}>
            I will
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
        </View>

        <Text selectable style={styles.coaching}>
          {COACHING_PARAGRAPH}
        </Text>

        <View style={styles.examples}>
          <Text selectable style={styles.examplesLabel}>
            Some routines that work well:
          </Text>
          {EXAMPLE_ROUTINES.map((example) => (
            <Text key={example} selectable style={styles.exampleItem}>
              {example}
            </Text>
          ))}
        </View>
      </View>

      <PrimaryButton
        disabled={!canContinue}
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
  field: {
    gap: spacing.sm,
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
  label: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: "600",
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
});
