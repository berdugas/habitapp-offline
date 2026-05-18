import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { ChevronLeft, Lightbulb } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { Eyebrow } from "@/components/text/Eyebrow";
import { ArchivedHabitCard } from "@/features/habits/components/ArchivedHabitCard";
import { BacklogHabitCard } from "@/features/habits/components/BacklogHabitCard";
import {
  useBacklogHabitsQuery,
  useInactiveHabitsQuery,
} from "@/features/habits/hooks";
import {
  isArchiveIntroSeen,
  markArchiveIntroSeen,
} from "@/features/habits/onboardingStorage";
import { FirstRunTipBanner } from "@/features/reviews/components/FirstRunTipBanner";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { SCREEN_TOP_PADDING, spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

export default function BacklogScreen() {
  const insets = useSafeAreaInsets();
  const backlogQuery = useBacklogHabitsQuery();
  const archivedQuery = useInactiveHabitsQuery();

  const backlogHabits = backlogQuery.data ?? [];
  const archivedHabits = archivedQuery.data ?? [];

  // Tri-state: null while the preference read is in flight, false/true after.
  // Banner only renders when explicitly false — null suppresses to avoid a
  // flash before storage resolves.
  const [archiveIntroSeen, setArchiveIntroSeen] = useState<boolean | null>(
    null,
  );
  useEffect(() => {
    isArchiveIntroSeen()
      .then(setArchiveIntroSeen)
      .catch(() => setArchiveIntroSeen(true));
  }, []);

  async function handleDismissArchiveIntro() {
    // Optimistically hide so the dismiss feels instant; revert if the write
    // fails so the user gets another chance and the onboarding isn't falsely
    // consumed.
    setArchiveIntroSeen(true);
    const persisted = await markArchiveIntroSeen();
    if (!persisted) setArchiveIntroSeen(false);
  }

  const isLoading = backlogQuery.isLoading || archivedQuery.isLoading;
  const hasError = backlogQuery.error || archivedQuery.error;
  const isEmpty = backlogHabits.length === 0 && archivedHabits.length === 0;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + SCREEN_TOP_PADDING },
      ]}
      style={styles.screen}
    >
      <View style={styles.headerRow}>
        <Pressable
          accessibilityLabel="Go back"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ChevronLeft color={colors.textMuted} size={22} strokeWidth={1.75} />
        </Pressable>
        <Text style={styles.title}>Habit Ideas</Text>
      </View>
      <Text style={styles.subtitle}>
        Habits you&apos;ve saved for later. Activate one when you&apos;re ready.
      </Text>

      {isLoading ? (
        <View style={styles.centered}>
          <LoadingState message="Loading..." />
        </View>
      ) : hasError ? (
        <View style={styles.centered}>
          <ErrorState message="We couldn't load your habits. Please try again." />
        </View>
      ) : isEmpty ? (
        <BacklogEmptyState />
      ) : (
        <View style={styles.sections}>
          {backlogHabits.length > 0 ? (
            <View style={styles.cardList}>
              {backlogHabits.map((habit) => (
                <BacklogHabitCard key={habit.id} habit={habit} />
              ))}
            </View>
          ) : null}

          {archivedHabits.length > 0 ? (
            <View style={styles.archivedSection}>
              {backlogHabits.length > 0 ? <Eyebrow label="Archived" /> : null}
              {archiveIntroSeen === false ? (
                <FirstRunTipBanner
                  message="Tap an archived habit to view its history or delete it permanently."
                  onDismiss={() => void handleDismissArchiveIntro()}
                  testID="archive-intro-banner"
                />
              ) : null}
              <View style={styles.cardList}>
                {archivedHabits.map((habit) => (
                  <ArchivedHabitCard key={habit.id} habit={habit} />
                ))}
              </View>
            </View>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}

function BacklogEmptyState() {
  return (
    <View style={styles.empty}>
      <Lightbulb color={colors.textFaint} size={48} strokeWidth={1.25} />
      <Text style={styles.emptyTitle}>No habit ideas yet</Text>
      <Text style={styles.emptyBody}>
        When you have more ideas than active slots, save them here.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  archivedSection: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  backButton: {
    alignItems: "center",
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  cardList: {
    gap: spacing.lg,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
  },
  content: {
    flexGrow: 1,
    gap: spacing.md,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  empty: {
    alignItems: "center",
    flex: 1,
    gap: spacing.md,
    justifyContent: "center",
    paddingTop: spacing.xxl,
  },
  emptyBody: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    textAlign: "center",
  },
  emptyTitle: {
    color: colors.text,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.titleMd,
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  screen: {
    backgroundColor: colors.bg,
    flex: 1,
  },
  sections: {
    gap: spacing.lg,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyLg,
    lineHeight: 24,
  },
  title: {
    color: colors.text,
    fontFamily: fontFamilies.displayBold,
    fontSize: typography.headlineLg,
  },
});
