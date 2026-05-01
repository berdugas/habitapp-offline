import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import Constants from "expo-constants";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { HabitCard } from "@/components/cards/HabitCard";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { useAuthSession } from "@/features/auth/hooks";
import { formatHabitFormula } from "@/features/habits/formatters";
import { useInactiveHabitsQuery } from "@/features/habits/hooks";
import { signOut } from "@/features/auth/api";
import { useTrialValidation } from "@/features/trial/hooks";
import { colors } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";
import { getLoadInactiveHabitsErrorMessage } from "@/utils/userFacingErrors";

import type { TrialEntitlementStatus } from "@/features/trial/types";

function formatEntitlementStatus(status: TrialEntitlementStatus | null): string | null {
  if (!status) return null;
  switch (status) {
    case "trial": return "Trial";
    case "active": return "Active";
    case "expired": return "Trial ended";
    case "paid": return "Paid";
    case "cancelled": return "Cancelled";
  }
}

export default function SettingsScreen() {
  const { user } = useAuthSession();
  const inactiveHabitsQuery = useInactiveHabitsQuery();
  const { entitlementStatus } = useTrialValidation();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const statusLabel = formatEntitlementStatus(entitlementStatus);
  const appVersion = Constants.expoConfig?.version ?? "—";

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
        {statusLabel ? (
          <Text selectable style={styles.statusLabel}>
            {statusLabel}
          </Text>
        ) : null}
      </View>
      <View style={styles.card}>
        <Text selectable style={styles.title}>
          Your archived habits
        </Text>
        <Text selectable style={styles.body}>
          Pause and resume habits without losing their history.
        </Text>
        {inactiveHabitsQuery.isLoading ? (
          <LoadingState message="Loading archived habits..." />
        ) : inactiveHabitsQuery.error ? (
          <ErrorState message={getLoadInactiveHabitsErrorMessage()} />
        ) : inactiveHabitsQuery.data?.length ? (
          <View style={styles.inactiveList}>
            {inactiveHabitsQuery.data.map((habit) => (
              <HabitCard
                formula={formatHabitFormula(
                  habit.cue,
                  habit.tiny_action,
                )}
                key={habit.id}
                metaText="Archived habit"
                name={habit.title}
                onPress={() => router.push(`/(app)/habits/${habit.id}`)}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            body="Habits you've paused will appear here so you can come back to them."
            title="No archived habits"
          />
        )}
      </View>
      <View style={styles.card}>
        <Text selectable style={styles.title}>
          About
        </Text>
        <View style={styles.aboutRow}>
          <Text selectable style={styles.aboutLabel}>
            Version
          </Text>
          <Text selectable style={styles.aboutValue}>
            {appVersion}
          </Text>
        </View>
        <View style={styles.aboutRow}>
          <Text selectable style={styles.aboutLabelMuted}>
            Privacy Policy
          </Text>
          <Text selectable style={styles.aboutValueMuted}>
            Coming soon
          </Text>
        </View>
        <View style={styles.aboutRow}>
          <Text selectable style={styles.aboutLabelMuted}>
            Terms of Service
          </Text>
          <Text selectable style={styles.aboutValueMuted}>
            Coming soon
          </Text>
        </View>
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
  aboutLabel: {
    color: colors.text,
    fontSize: 15,
    flex: 1,
  },
  aboutLabelMuted: {
    color: colors.textMuted,
    fontSize: 15,
    flex: 1,
  },
  aboutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  aboutValue: {
    color: colors.text,
    fontSize: 15,
  },
  aboutValueMuted: {
    color: colors.textMuted,
    fontSize: 15,
  },
  body: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: 'transparent',
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
    backgroundColor: colors.bg,
    flex: 1,
  },
  statusLabel: {
    color: colors.textMuted,
    fontSize: 14,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
});
