import { useEffect, useMemo, useState } from "react";
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
import { ArchivedGoalCard } from "@/features/habits/components/ArchivedGoalCard";
import { ArchivedHabitCard } from "@/features/habits/components/ArchivedHabitCard";
import { BacklogHabitCard } from "@/features/habits/components/BacklogHabitCard";
import {
  useArchivedGoalsQuery,
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
  const archivedGoalsQuery = useArchivedGoalsQuery();
  const backlogQuery = useBacklogHabitsQuery();
  const archivedQuery = useInactiveHabitsQuery();

  const archivedGoals = archivedGoalsQuery.data ?? [];
  const backlogHabits = backlogQuery.data ?? [];

  // Dedup: an archived habit whose identity_phrase is in the archived-goals
  // section is already represented up top (rolled into the goal row). Drop
  // those from the flat archived-habits list so the same habit doesn't
  // double-render. Goalless archived habits (identity_phrase null/empty) and
  // habits whose goal still has active/backlog rows remain in the flat list.
  const archivedHabits = useMemo(() => {
    const archivedGoalPhrases = new Set(
      archivedGoals.map((g) => g.identityPhrase),
    );
    return (archivedQuery.data ?? []).filter(
      (h) =>
        !h.identity_phrase || !archivedGoalPhrases.has(h.identity_phrase),
    );
  }, [archivedGoals, archivedQuery.data]);

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

  const isLoading =
    backlogQuery.isLoading ||
    archivedQuery.isLoading ||
    archivedGoalsQuery.isLoading;
  const hasError =
    backlogQuery.error || archivedQuery.error || archivedGoalsQuery.error;
  const isEmpty =
    archivedGoals.length === 0 &&
    archivedHabits.length === 0 &&
    backlogHabits.length === 0;

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
        <Text style={styles.title}>Archive</Text>
      </View>
      <Text style={styles.subtitle}>
        Goals and habits you&apos;ve put away or saved for later.
      </Text>

      {isLoading ? (
        <View style={styles.centered}>
          <LoadingState message="Loading..." />
        </View>
      ) : hasError ? (
        <View style={styles.centered}>
          <ErrorState message="We couldn't load your archive. Please try again." />
        </View>
      ) : isEmpty ? (
        <ArchiveEmptyState />
      ) : (
        <View style={styles.sections}>
          {archivedGoals.length > 0 ? (
            <View style={styles.section}>
              <Eyebrow label="Archived goals" />
              <View style={styles.cardList}>
                {archivedGoals.map((goal) => (
                  <ArchivedGoalCard key={goal.identityPhrase} goal={goal} />
                ))}
              </View>
            </View>
          ) : null}

          {archivedHabits.length > 0 ? (
            <View style={styles.section}>
              <Eyebrow label="Archived habits" />
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

          {backlogHabits.length > 0 ? (
            <View style={styles.section}>
              <Eyebrow label="Saved for later" />
              <View style={styles.cardList}>
                {backlogHabits.map((habit) => (
                  <BacklogHabitCard key={habit.id} habit={habit} />
                ))}
              </View>
            </View>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}

function ArchiveEmptyState() {
  return (
    <View style={styles.empty}>
      <Lightbulb color={colors.textFaint} size={48} strokeWidth={1.25} />
      <Text style={styles.emptyTitle}>Nothing in your archive yet</Text>
      <Text style={styles.emptyBody}>
        When you archive a goal or save a habit for later, it&apos;ll show up
        here.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  section: {
    gap: spacing.md,
  },
  sections: {
    gap: spacing.xl,
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
