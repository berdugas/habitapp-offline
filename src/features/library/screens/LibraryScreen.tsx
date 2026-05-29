import { ScrollView, StyleSheet, Text, View } from "react-native";

import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { LibraryEmptyState } from "@/features/library/components/LibraryEmptyState";
import { LibraryGoalGroup } from "@/features/library/components/LibraryGoalGroup";
import { useLibraryHabits } from "@/features/library/hooks";
import { useThemedStyles } from "@/theme/useThemedStyles";

export default function LibraryScreen() {
  const libraryQuery = useLibraryHabits();
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      centered: {
        alignItems: "center",
        backgroundColor: t.colors.bg,
        flex: 1,
        justifyContent: "center",
        padding: t.spacing.xl,
      },
      content: {
        gap: t.spacing.lg,
        padding: t.spacing.xl,
        paddingBottom: t.spacing.xxl,
      },
      groupList: {
        gap: t.spacing.xl,
        marginTop: t.spacing.md,
      },
      screen: {
        backgroundColor: t.colors.bg,
        flex: 1,
      },
      subtitle: {
        color: t.colors.textMuted,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyLg,
        lineHeight: 21,
      },
      title: {
        color: t.colors.text,
        fontFamily: t.fontFamilies.displayBold,
        fontSize: t.typography.headlineLg,
      },
    }),
  );

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
