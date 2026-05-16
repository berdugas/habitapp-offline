import { ScrollView, StyleSheet, Text, View } from "react-native";

import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { LibraryEmptyState } from "@/features/library/components/LibraryEmptyState";
import { LibraryGoalGroup } from "@/features/library/components/LibraryGoalGroup";
import { useLibraryHabits } from "@/features/library/hooks";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

export default function LibraryScreen() {
  const libraryQuery = useLibraryHabits();

  if (libraryQuery.isLoading) {
    return (
      <View style={styles.centered}>
        <LoadingState message="Loading your library..." />
      </View>
    );
  }

  if (libraryQuery.error) {
    return (
      <View style={styles.centered}>
        <ErrorState message="We couldn't load your library. Please try again." />
      </View>
    );
  }

  const groups = libraryQuery.data ?? [];

  if (groups.length === 0) {
    return (
      <View style={styles.centered}>
        <LibraryEmptyState />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <Text style={styles.title}>Library</Text>
      <Text style={styles.subtitle}>
        Habits that have become part of who you are.
      </Text>
      <View style={styles.groupList}>
        {groups.map((group, idx) => (
          <LibraryGoalGroup
            key={group.identityPhrase ?? `__other__-${idx}`}
            group={group}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: "center",
    backgroundColor: colors.bg,
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl,
  },
  content: {
    gap: spacing.lg,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  groupList: {
    gap: spacing.xl,
    marginTop: spacing.md,
  },
  screen: {
    backgroundColor: colors.bg,
    flex: 1,
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
