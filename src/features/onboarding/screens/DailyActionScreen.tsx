import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import { getDailyActionPlaceholder } from "@/features/onboarding/dailyActionPlaceholder";
import { colors } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { shadows } from "@/theme/shadows";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

export default function DailyActionScreen() {
  const { draft, update } = useOnboarding();

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      style={styles.screen}
    >
      <View style={styles.card}>
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
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          value={draft.dailyAction}
        />
        <Text selectable style={styles.helper}>
          Even one minute counts. We'll make it smaller in the next step.
        </Text>
      </View>

      <Text selectable style={styles.savedNote}>
        Saved. More coming next.
      </Text>
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
  header: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: "800",
    lineHeight: 36,
  },
  helper: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24,
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
  reflection: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontStyle: "italic",
  },
  savedNote: {
    color: colors.textMuted,
    fontSize: typography.body,
    textAlign: "center",
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
});
