import { useEffect, useRef } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ReadOnlyBanner } from "@/components/ReadOnlyBanner";
import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { ZenCard } from "@/components/cards/ZenCard";
import { DangerZone } from "@/components/sections/DangerZone";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { Eyebrow } from "@/components/text/Eyebrow";
import { LucideIcon } from "@/components/LucideIconPicker";
import {
  useArchivedGoalDetailQuery,
  useDeleteGoalMutation,
  useRestoreGoalMutation,
} from "@/features/habits/hooks";
import { useTrialValidation } from "@/features/trial/hooks";
import {
  getDeleteGoalErrorMessage,
  getRestoreGoalErrorMessage,
} from "@/utils/userFacingErrors";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { radius } from "@/theme/radius";
import { SCREEN_TOP_PADDING, spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

export default function ArchivedGoalDetailScreen() {
  const { identityPhrase: rawParam } = useLocalSearchParams<{
    identityPhrase?: string;
  }>();
  const identityPhrase = rawParam
    ? decodeURIComponent(rawParam as string)
    : undefined;
  const insets = useSafeAreaInsets();

  const { accessMode, isValidating, refresh } = useTrialValidation();
  const isReadOnly = accessMode === "read_only";

  // Query returns ALL habits under the phrase (every status), not just
  // archived. We need the full picture to gate on "fully archived" —
  // otherwise a direct-open or stale route into a phrase with live
  // (active/backlog) habits would show an archived-only view but the
  // delete button still wipes every status (deleteGoal cascades across
  // all rows). The guard MUST match the cascade's scope, not just what's
  // rendered.
  const query = useArchivedGoalDetailQuery(identityPhrase);
  const restoreGoalMutation = useRestoreGoalMutation();
  const deleteGoalMutation = useDeleteGoalMutation();

  const allHabits = query.data ?? [];
  const archivedHabits = allHabits.filter((h) => h.status === "archived");
  const hasLiveHabits = allHabits.some(
    (h) => h.status === "active" || h.status === "backlog",
  );
  const habitCount = archivedHabits.length;
  // "Fully archived" mirrors listArchivedGoals' predicate: zero active,
  // zero backlog, >=1 archived. This is the only safe shape for this
  // screen — anything else means we're on the wrong route.
  const isFullyArchived = !hasLiveHabits && archivedHabits.length > 0;

  // Submit-lock + stale-route guard. Set true synchronously inside the
  // confirm-Alert's destructive handler before mutateAsync runs — this
  // prevents the post-mutation invalidation (which refetches the now-empty
  // archived-goal-detail) from triggering the stale-route useEffect's own
  // router.replace, which would clobber the intentional success-path nav.
  // Reset on failure so the user can retry and the stale-route fallback
  // remains live for genuine empty-from-out-of-band cases.
  const isExitingRef = useRef(false);

  // The stale-route condition fires for two distinct cases:
  //   1. No habits exist under this phrase at all (deleted elsewhere,
  //      deep-linked to a never-existed phrase, etc).
  //   2. Mixed-state phrase (has live habits) — this isn't an archived
  //      goal at all; the route is wrong.
  // Both redirect to the Archive list. Gated on settled-fetch + no-error
  // so we don't redirect during loading or mask real failures.
  const shouldRedirect =
    !isExitingRef.current &&
    query.isFetched &&
    !query.isLoading &&
    !query.error &&
    !isFullyArchived;

  useEffect(() => {
    if (shouldRedirect) {
      router.replace("/(app)/habits/backlog");
    }
  }, [shouldRedirect]);

  function confirmRestoreGoal() {
    Alert.alert(
      "Restore this goal?",
      `${habitCount} habit${
        habitCount !== 1 ? "s" : ""
      } will move back to active.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Restore", onPress: () => void handleRestoreGoal() },
      ],
    );
  }

  async function handleRestoreGoal() {
    if (!identityPhrase || restoreGoalMutation.isPending) return;
    isExitingRef.current = true;
    try {
      await restoreGoalMutation.mutateAsync({ identityPhrase });
      router.replace({
        pathname: "/(app)/goals/[identityPhrase]",
        params: { identityPhrase: encodeURIComponent(identityPhrase) },
      });
    } catch {
      // Re-arm the stale-route fallback so the user can retry; failure
      // surfaced via mutation state below.
      isExitingRef.current = false;
    }
  }

  function confirmDeleteGoal() {
    Alert.alert(
      "Delete this goal?",
      `"Become ${identityPhrase ?? ""}" and all habits under it will be permanently deleted. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => void handleDeleteGoal(),
        },
      ],
    );
  }

  async function handleDeleteGoal() {
    if (!identityPhrase || deleteGoalMutation.isPending) return;
    isExitingRef.current = true;
    try {
      await deleteGoalMutation.mutateAsync({ identityPhrase });
      // .replace, not .back — direct-open / stale-stack cases make .back
      // non-deterministic, and the destination is always Archive list.
      router.replace("/(app)/habits/backlog");
    } catch {
      isExitingRef.current = false;
    }
  }

  if (query.isLoading) {
    return <LoadingState message="Loading goal..." />;
  }

  if (query.error) {
    return (
      <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
        <View style={[styles.headerRow, { paddingTop: insets.top + SCREEN_TOP_PADDING }]}>
          <Pressable
            accessibilityLabel="Go back"
            hitSlop={12}
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <ChevronLeft color={colors.textMuted} size={22} strokeWidth={1.75} />
          </Pressable>
        </View>
        <ErrorState message="We couldn't load this archived goal. Try again." />
      </ScrollView>
    );
  }

  // Suppress the action shell during the brief window between the
  // redirect effect firing and the new route taking over. Without this,
  // a stale-route case (mixed-state or empty phrase) briefly flashes a
  // "0 habits — Restore / Delete" surface before navigation completes.
  if (shouldRedirect) {
    return <LoadingState message="Loading..." />;
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
    >
      {isReadOnly ? (
        <ReadOnlyBanner
          isReconnecting={isValidating}
          onReconnect={() => void refresh()}
        />
      ) : null}

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + SCREEN_TOP_PADDING }]}>
        <Pressable
          accessibilityLabel="Go back"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ChevronLeft color={colors.textMuted} size={22} strokeWidth={1.75} />
        </Pressable>
        <View style={styles.titleRow}>
          <Text style={styles.headlineText}>
            Become {identityPhrase ?? ""}
          </Text>
          <View style={styles.archivedChip}>
            <Text style={styles.archivedChipText}>Archived</Text>
          </View>
        </View>
      </View>

      {/* Read-only habits list. No chevron, no press feedback, muted type.
          Communicates "frozen" surface. */}
      {archivedHabits.length > 0 ? (
        <View>
          <Eyebrow label="Habits in this goal" />
          <ZenCard style={styles.habitsCard} gap={0}>
            {archivedHabits.map((habit, i) => (
              <View
                key={habit.id}
                style={[
                  styles.habitRow,
                  i > 0 && styles.habitRowBorder,
                ]}
              >
                <View style={styles.habitNameRow}>
                  {habit.icon ? (
                    <LucideIcon
                      name={habit.icon}
                      size={16}
                      color={colors.textMuted}
                      strokeWidth={1.75}
                    />
                  ) : null}
                  <Text style={styles.habitName}>{habit.title}</Text>
                </View>
                <Text style={styles.habitSubtitle}>{habit.tiny_action}</Text>
              </View>
            ))}
          </ZenCard>
        </View>
      ) : null}

      {/* Restore — neutral. Reminders for ex-backlog rows rematerialize via
          the API wrapper; ex-active reminders stay off and the user can
          re-enable per habit. */}
      {!isReadOnly ? (
        <View style={styles.cardContainer}>
          {/* Tinted card surface — matches the live Archive card on
              GoalDetailScreen. Gives the white SecondaryButton a surface
              to lift off of without using the red destructive tint. */}
          <ZenCard style={styles.restoreCard}>
            <Eyebrow label="Restore goal" />
            <Text style={styles.bodyText}>
              Brings this goal and its {habitCount} habit
              {habitCount !== 1 ? "s" : ""} back as active.
            </Text>
            <SecondaryButton
              disabled={
                restoreGoalMutation.isPending || deleteGoalMutation.isPending
              }
              label={
                restoreGoalMutation.isPending ? "Restoring…" : "Restore goal"
              }
              onPress={confirmRestoreGoal}
            />
          </ZenCard>
          {restoreGoalMutation.error ? (
            <ErrorState message={getRestoreGoalErrorMessage()} />
          ) : null}
        </View>
      ) : null}

      {/* Delete permanently — terminal action. Lives here, not on live Goal
          Detail, so the user has to commit to opening the archived goal
          before nuking it. */}
      {!isReadOnly ? (
        <View style={styles.cardContainer}>
          <DangerZone
            title="Delete permanently"
            body="Permanently removes this goal and all habits — including logs, reviews, and reminders. This cannot be undone."
            buttonLabel="Delete permanently"
            disabled={restoreGoalMutation.isPending}
            isPending={deleteGoalMutation.isPending}
            onPress={confirmDeleteGoal}
          />
          {deleteGoalMutation.error ? (
            <ErrorState message={getDeleteGoalErrorMessage()} />
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  archivedChip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  archivedChipText: {
    color: colors.textFaint,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.micro,
    letterSpacing: 0.5,
  },
  backButton: {
    alignItems: "center",
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  bodyText: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: 14,
    lineHeight: 20,
  },
  restoreCard: {
    backgroundColor: colors.surfaceMuted,
  },
  cardContainer: {
    gap: spacing.sm,
  },
  content: {
    gap: spacing.xl,
    padding: spacing.xl,
  },
  habitName: {
    color: colors.textMuted,
    flexShrink: 1,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.bodyMd,
  },
  habitNameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
  habitRow: {
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  habitRowBorder: {
    borderTopColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  habitSubtitle: {
    color: colors.textFaint,
    fontFamily: fontFamilies.body,
    fontSize: typography.micro,
  },
  habitsCard: {
    marginTop: spacing.sm,
    overflow: "hidden",
  },
  header: {
    gap: spacing.xs,
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  headlineText: {
    color: colors.text,
    flexShrink: 1,
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 21,
    fontWeight: "500",
  },
  screen: {
    backgroundColor: colors.bg,
    flex: 1,
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});
