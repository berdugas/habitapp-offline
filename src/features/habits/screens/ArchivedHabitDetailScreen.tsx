import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { ZenCard } from "@/components/cards/ZenCard";
import { DangerZone } from "@/components/sections/DangerZone";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { Eyebrow } from "@/components/text/Eyebrow";
import { LucideIcon } from "@/components/LucideIconPicker";
import {
  useDeleteHabitMutation,
  useOwnedHabitQuery,
  useRestoreHabitMutation,
} from "@/features/habits/hooks";
import { AccessGateBanner } from "@/features/trial/AccessGateBanner";
import { isPaywallLocked, isReadOnly as computeIsReadOnly } from "@/features/trial/accessMode";
import { useTrialValidation } from "@/features/trial/hooks";
import { usePaywall } from "@/features/paywall/PaywallController";
import { paywallCopy } from "@/features/paywall/copy";
import {
  getDeleteHabitErrorMessage,
  getRestoreHabitErrorMessage,
} from "@/utils/userFacingErrors";
import { useTheme } from "@/theme/useTheme";
import { useThemedStyles } from "@/theme/useThemedStyles";

export default function ArchivedHabitDetailScreen() {
  const { habitId: rawParam } = useLocalSearchParams<{ habitId?: string | string[] }>();
  const habitId = Array.isArray(rawParam) ? rawParam[0] : rawParam;
  const insets = useSafeAreaInsets();

  const theme = useTheme();
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      archivedChip: {
        backgroundColor: theme.colors.surfaceMuted,
        borderRadius: theme.radius.pill,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 2,
      },
      archivedChipText: {
        color: theme.colors.textFaint,
        fontFamily: theme.fontFamilies.bodySemi,
        fontSize: theme.typography.micro,
        letterSpacing: 0.5,
      },
      backButton: {
        alignItems: "center",
        height: 36,
        justifyContent: "center",
        width: 36,
      },
      bodyText: {
        color: theme.colors.textMuted,
        fontFamily: theme.fontFamilies.body,
        fontSize: theme.typography.bodyMd,
        lineHeight: 18.6,
      },
      cardContainer: {
        gap: theme.spacing.sm,
      },
      content: {
        gap: theme.spacing.xl,
        padding: theme.spacing.xl,
      },
      goalLabel: {
        color: theme.colors.textFaint,
        fontFamily: theme.fontFamilies.bodySemi,
        fontSize: theme.typography.labelMd,
        letterSpacing: 0.5,
      },
      header: {
        gap: theme.spacing.xs,
      },
      headerRow: {
        alignItems: "center",
        flexDirection: "row",
        gap: theme.spacing.sm,
      },
      headlineText: {
        color: theme.colors.text,
        flexShrink: 1,
        fontFamily: theme.fontFamilies.bodyMedium,
        fontSize: 21,
        fontWeight: "500",
      },
      metaCard: {
        marginTop: theme.spacing.sm,
      },
      metaCue: {
        color: theme.colors.textFaint,
        fontFamily: theme.fontFamilies.body,
        fontSize: theme.typography.bodyMd,
      },
      metaTinyAction: {
        color: theme.colors.textMuted,
        fontFamily: theme.fontFamilies.bodyMedium,
        fontSize: theme.typography.bodyMd,
      },
      restoreCard: {
        backgroundColor: theme.colors.surfaceMuted,
      },
      screen: {
        backgroundColor: theme.colors.bg,
        flex: 1,
      },
      titleIconRow: {
        alignItems: "center",
        flexDirection: "row",
        flexShrink: 1,
        gap: theme.spacing.sm,
      },
      titleRow: {
        alignItems: "center",
        flexDirection: "row",
        flexWrap: "wrap",
        gap: theme.spacing.sm,
      },
    }),
  );

  const { accessMode, isValidating, refresh } = useTrialValidation();
  const isReadOnly = computeIsReadOnly(accessMode);
  const isFreeTierLocked = isPaywallLocked(accessMode);
  const isOfflineReadOnly = accessMode === "read_only";
  const { showCapBlockPaywall } = usePaywall();

  const query = useOwnedHabitQuery(habitId);
  const restoreHabitMutation = useRestoreHabitMutation();
  const deleteHabitMutation = useDeleteHabitMutation();

  const habit = query.data ?? null;
  const isFullyArchived = habit?.status === "archived";

  // Submit-lock + stale-route guard. Set true synchronously inside the
  // confirm-Alert's destructive handler before mutateAsync runs — without it,
  // the post-mutation invalidation refetch would trigger the stale-route
  // useEffect's own router.replace and clobber the intentional success-path
  // nav. Reset on failure so retries work and the fallback remains live for
  // genuine empty-from-out-of-band cases.
  const isExitingRef = useRef(false);

  // Render-visible companion to isExitingRef. The ref alone can't gate the
  // visible render because ref mutations don't trigger re-renders — so after
  // mutateAsync's await resolves the screen would re-render with the new
  // (post-restore) data and flash a degraded view for one tick before
  // dismissAll fires. The state flag forces LoadingState during the entire
  // transition. Reset on failure.
  const [isExiting, setIsExiting] = useState(false);
  function startExit() {
    isExitingRef.current = true;
    setIsExiting(true);
  }
  function cancelExit() {
    isExitingRef.current = false;
    setIsExiting(false);
  }

  // Two stale-route cases:
  //   1. Habit exists but status != 'archived' (restored/activated elsewhere,
  //      or this route was opened for a live habit) — go to the live detail.
  //   2. Habit doesn't exist at all (deleted out-of-band, deep-linked to a
  //      never-existed id) — go to Archive list.
  // Gated on settled-fetch + no-error so we don't redirect during loading or
  // mask real failures.
  const shouldRedirect =
    !isExitingRef.current &&
    query.isFetched &&
    !query.isLoading &&
    !query.error &&
    !isFullyArchived;

  useEffect(() => {
    if (!shouldRedirect) return;
    if (habit && habit.status !== "archived") {
      router.replace({
        pathname: "/(app)/habits/[habitId]",
        params: { habitId: habit.id },
      });
      return;
    }
    router.replace("/(app)/habits/backlog");
  }, [shouldRedirect, habit?.id, habit?.status]);

  function confirmRestoreHabit() {
    Alert.alert("Restore this habit?", "It will move back to your active list.", [
      { text: "Cancel", style: "cancel" },
      { text: "Restore", onPress: () => void handleRestoreHabit() },
    ]);
  }

  async function handleRestoreHabit() {
    if (!habit || restoreHabitMutation.isPending) return;
    startExit();
    try {
      await restoreHabitMutation.mutateAsync({ habitId: habit.id });
      // Pop the entire archive-side stack (Archive list + this detail) off,
      // then explicitly switch to the Today tab. dismissAll alone is NOT
      // enough — it pops the non-tab stack but leaves the *active tab*
      // unchanged. If the user reached Archive from the Settings tab,
      // dismissAll would land them back on Settings. The follow-up replace
      // forces Today active. Same "go home" pattern used by delete-habit
      // success in HabitDetailScreen. The restored habit's appearance in
      // Today is its own confirmation.
      router.dismissAll();
      router.replace("/(app)/(tabs)/today");
    } catch {
      // Re-arm the stale-route fallback so retries work; failure surfaced via
      // mutation state below.
      cancelExit();
    }
  }

  function confirmDeleteHabit() {
    if (!habit) return;
    Alert.alert(
      "Delete this habit?",
      `"${habit.title}" and all its history will be permanently deleted. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => void handleDeleteHabit(),
        },
      ],
    );
  }

  async function handleDeleteHabit() {
    if (!habit || deleteHabitMutation.isPending) return;
    startExit();
    try {
      // api.ts deleteHabit cancels the OS reminder before deleting the row.
      await deleteHabitMutation.mutateAsync({ habitId: habit.id });
      // Pop every pushed route back to the active tab root — returns the
      // user to whichever tab launched the archive flow (Settings if they
      // came to clean up, Today if they came via a goal). Deliberately
      // does NOT force-replace to Today like restore does: a deleted habit
      // has no destination view, so anchoring there would mislead. The
      // canDismiss fallback covers deep-link cold-starts where this screen
      // is the only route on the stack — without it the user would be
      // stranded on a screen showing the deleted habit.
      if (router.canDismiss()) {
        router.dismissAll();
      } else {
        router.replace("/(app)/(tabs)/today");
      }
    } catch {
      cancelExit();
    }
  }

  if (query.isLoading) {
    return <LoadingState message="Loading habit..." />;
  }

  if (query.error) {
    return (
      <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
        <View style={[styles.headerRow, { paddingTop: insets.top + theme.spacing.lg }]}>
          <Pressable
            accessibilityLabel="Go back"
            hitSlop={12}
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <ChevronLeft color={theme.colors.textMuted} size={22} strokeWidth={1.75} />
          </Pressable>
        </View>
        <ErrorState message="We couldn't load this archived habit. Try again." />
      </ScrollView>
    );
  }

  // Suppress the action shell during the brief window between the redirect
  // effect firing and the new route taking over. Without this, a stale-route
  // case briefly flashes the archived surface before navigation completes.
  // isExiting covers the success-path transition: between mutateAsync
  // resolving (cache now reflects restored/deleted shape) and dismissAll
  // firing, this screen would otherwise render the stale-but-renderable
  // archived view for one tick. Gate on both.
  if (shouldRedirect || isExiting || !habit) {
    return <LoadingState message="Loading..." />;
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
    >
      <AccessGateBanner
        accessMode={accessMode}
        isReconnecting={isValidating}
        onReconnect={() => void refresh()}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + theme.spacing.lg }]}>
        <Pressable
          accessibilityLabel="Go back"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ChevronLeft color={theme.colors.textMuted} size={22} strokeWidth={1.75} />
        </Pressable>
        <View style={styles.titleRow}>
          <View style={styles.titleIconRow}>
            {habit.icon ? (
              <LucideIcon
                name={habit.icon}
                size={22}
                color={theme.colors.textMuted}
                strokeWidth={1.75}
              />
            ) : null}
            <Text style={styles.headlineText}>{habit.title}</Text>
          </View>
          <View style={styles.archivedChip}>
            <Text style={styles.archivedChipText}>Archived</Text>
          </View>
        </View>
        {habit.identity_phrase ? (
          <Text style={styles.goalLabel}>Become {habit.identity_phrase}</Text>
        ) : null}
      </View>

      {/* Read-only meta card. Communicates "frozen" surface — no chevron, no
          press feedback, muted type. */}
      <View>
        <Eyebrow label="Habit" />
        <ZenCard style={styles.metaCard} gap={theme.spacing.xs}>
          <Text style={styles.metaTinyAction}>{habit.tiny_action}</Text>
          {habit.cue ? (
            <Text style={styles.metaCue}>Cue: {habit.cue}</Text>
          ) : null}
        </ZenCard>
      </View>

      {/* Restore — neutral. Ex-backlog reminders rematerialize via the api
          wrapper; ex-active reminders were cancelled at archive time and stay
          off (user re-enables per habit).
          Three-way branch:
            1. free-tier (expired_no_purchase) → "Unlock $1.99 to restore" CTA → paywall
            2. full/trial access → normal restore card
            3. offline read_only → hidden */}
      {isFreeTierLocked ? (
        <View style={styles.cardContainer}>
          <ZenCard style={styles.restoreCard}>
            <Eyebrow label="Restore habit" />
            <Text style={styles.bodyText}>Restoring is part of the paid plan.</Text>
            <SecondaryButton
              label={paywallCopy.unlockToRestore}
              onPress={() => showCapBlockPaywall("cap_restore")}
            />
          </ZenCard>
        </View>
      ) : !isOfflineReadOnly ? (
        <View style={styles.cardContainer}>
          <ZenCard style={styles.restoreCard}>
            <Eyebrow label="Restore habit" />
            <Text style={styles.bodyText}>Brings this habit back as active.</Text>
            <SecondaryButton
              disabled={
                restoreHabitMutation.isPending || deleteHabitMutation.isPending
              }
              label={
                restoreHabitMutation.isPending ? "Restoring…" : "Restore habit"
              }
              onPress={confirmRestoreHabit}
            />
          </ZenCard>
          {restoreHabitMutation.error ? (
            <ErrorState message={getRestoreHabitErrorMessage()} />
          ) : null}
        </View>
      ) : null}

      {/* Delete permanently — terminal action. Lives here, not on live Habit
          Detail, so the user has to commit to opening the archived view
          before nuking it. */}
      {!isReadOnly ? (
        <View style={styles.cardContainer}>
          <DangerZone
            title="Delete permanently"
            body="Permanently removes this habit — including logs, reviews, and reminders. This cannot be undone."
            buttonLabel="Delete permanently"
            disabled={restoreHabitMutation.isPending}
            isPending={deleteHabitMutation.isPending}
            onPress={confirmDeleteHabit}
          />
          {deleteHabitMutation.error ? (
            <ErrorState message={getDeleteHabitErrorMessage()} />
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}
