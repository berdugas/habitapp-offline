import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import Constants from "expo-constants";

import { TertiaryButton } from "@/components/buttons/TertiaryButton";
import { HabitCard } from "@/components/cards/HabitCard";
import { RowLV } from "@/components/cards/RowLV";
import { ZenCard } from "@/components/cards/ZenCard";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { Eyebrow } from "@/components/text/Eyebrow";
import { useAuthSession } from "@/features/auth/hooks";
import { formatHabitFormula } from "@/features/habits/formatters";
import { useInactiveHabitsQuery } from "@/features/habits/hooks";
import { signOut } from "@/features/auth/api";
import { useTrialValidation } from "@/features/trial/hooks";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
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
      <ZenCard>
        <Eyebrow label="Account" />
        <Text selectable style={styles.email}>
          {user?.email ?? "Signed in"}
        </Text>
        {statusLabel ? (
          <Text selectable style={styles.statusLabel}>
            {statusLabel}
          </Text>
        ) : null}
      </ZenCard>

      <ZenCard>
        <Eyebrow label="Your archived habits" />
        <Text selectable style={styles.helper}>
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
                formula={formatHabitFormula(habit.cue, habit.tiny_action)}
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
      </ZenCard>

      <ZenCard>
        <Eyebrow label="About" />
        <RowLV label="Version" value={appVersion} />
        <RowLV label="Privacy Policy" value="Coming soon" />
        <RowLV label="Terms of Service" value="Coming soon" />
      </ZenCard>

      <TertiaryButton
        label={isSigningOut ? "Signing out..." : "Sign Out"}
        onPress={handleSignOut}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
    padding: spacing.xl,
  },
  email: {
    color: colors.text,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyLg,
  },
  helper: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    lineHeight: 22,
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
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    fontStyle: "italic",
  },
});
