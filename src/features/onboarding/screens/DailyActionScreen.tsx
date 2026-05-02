import { ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { router } from "expo-router";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { ZenCard } from "@/components/cards/ZenCard";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import { getDailyActionPlaceholder } from "@/features/onboarding/dailyActionPlaceholder";
import type { OnboardingDraft } from "@/features/onboarding/types";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

export default function DailyActionScreen() {
  const { draft, update } = useOnboarding();

  const handleContinue = () => {
    const next: Partial<OnboardingDraft> = { step: "shrink" };
    if (draft.tinyAction.trim().length === 0) {
      next.tinyAction = draft.dailyAction;
    }
    update(next);
    router.push("/(onboarding)/shrink");
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
          What does that person do every day?
        </Text>
        {draft.becomingPhrase.trim().length > 0 && (
          <Text selectable style={styles.reflection}>
            Becoming: {draft.becomingPhrase}
          </Text>
        )}
        <TextInput
          autoCorrect
          multiline
          onChangeText={(text) => update({ dailyAction: text })}
          placeholder={getDailyActionPlaceholder(draft.becomingPhrase)}
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          value={draft.dailyAction}
        />
        <Text selectable style={styles.helper}>
          Even one minute counts. We'll make it smaller in the next step.
        </Text>
      </ZenCard>

      <PrimaryButton
        disabled={draft.dailyAction.trim().length === 0}
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
  header: {
    color: colors.text,
    fontFamily: fontFamilies.displayBold,
    fontSize: typography.headlineLg,
    lineHeight: 36,
  },
  helper: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyLg,
    lineHeight: 24,
  },
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: typography.bodyLg,
    lineHeight: 24,
    minHeight: 80,
    padding: spacing.md,
  },
  reflection: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    fontStyle: "italic",
  },
  screen: {
    backgroundColor: colors.bg,
    flex: 1,
  },
});
