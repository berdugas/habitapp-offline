import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { HabitCard } from "@/components/cards/HabitCard";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { useAuthSession } from "@/features/auth/hooks";
import { formatHabitFormula } from "@/features/habits/formatters";
import { useInactiveHabitsQuery } from "@/features/habits/hooks";
import { signOut } from "@/features/auth/api";
import { colors } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";
import { getLoadInactiveHabitsErrorMessage } from "@/utils/userFacingErrors";

export default function SettingsScreen() {
  const { user } = useAuthSession();
  const inactiveHabitsQuery = useInactiveHabitsQuery();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    await signOut();
    setIsSigningOut(false);
    router.replace("/");
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
    >
      <View style={styles.card}>
        <Text selectable style={styles.title}>
          Account
        </Text>
        <Text selectable style={styles.body}>
          {user?.email ?? "Signed in"}
        </Text>
      </View>
      <View style={styles.card}>
        <Text selectable style={styles.title}>
          Foundation status
        </Text>
        <Text selectable style={styles.body}>
          Current version: full non-AI habit builder. Weekly reviews and
          rule-based suggestions are enabled. AI coaching is planned for a later
          premium phase.
        </Text>
      </View>
      <View style={styles.card}>
        <Text selectable style={styles.title}>
          Inactive habits
        </Text>
        {inactiveHabitsQuery.isLoading ? (
          <LoadingState message="Loading inactive habits..." />
        ) : inactiveHabitsQuery.error ? (
          <ErrorState message={getLoadInactiveHabitsErrorMessage()} />
        ) : inactiveHabitsQuery.data?.length ? (
          <View style={styles.inactiveList}>
            <Text selectable style={styles.body}>
              Open any inactive habit to reactivate it from Habit Detail.
            </Text>
            {inactiveHabitsQuery.data.map((habit) => (
              <HabitCard
                formula={formatHabitFormula(
                  habit.stack_trigger,
                  habit.tiny_action,
                )}
                key={habit.id}
                metaText="Inactive habit"
                name={habit.name}
                onPress={() => router.push(`/(app)/habits/${habit.id}`)}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            body="Deactivated habits will appear here so you can inspect or reactivate them."
            title="No inactive habits"
          />
        )}
      </View>
      <PrimaryButton
        disabled={isSigningOut}
        label={isSigningOut ? "Signing out..." : "Sign Out"}
        onPress={handleSignOut}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.xl,
  },
  content: {
    gap: spacing.xl,
    padding: spacing.xl,
  },
  inactiveList: {
    gap: spacing.lg,
  },
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
});
