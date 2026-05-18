import { useState } from "react";
import { ChevronLeft } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { ZenCard } from "@/components/cards/ZenCard";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { Eyebrow } from "@/components/text/Eyebrow";
import { SRHIQuestion } from "@/features/graduation/components/SRHIQuestion";
import { useRecordGraduationMutation } from "@/features/graduation/hooks";
import { scoreGraduation } from "@/features/graduation/graduation";
import { useHabitDetail } from "@/features/habits/hooks";
import { useTrialValidation } from "@/features/trial/hooks";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { SCREEN_TOP_PADDING, spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { now } from "@/utils/clock";
import { daysBetweenDates, toDeviceDateString } from "@/utils/dates";
import {
  getLoadGraduationErrorMessage,
  getSaveGraduationErrorMessage,
} from "@/utils/userFacingErrors";

function normalizeHabitId(habitId: string | string[] | undefined) {
  if (Array.isArray(habitId)) {
    return habitId[0];
  }
  return habitId;
}

// Inclusive calendar-day count from start_date through today (start day = 1),
// matching the inclusive habit-age semantics used elsewhere in the app.
function daysSinceStart(startDate: string | null | undefined): number {
  if (!startDate) return 0;
  const today = toDeviceDateString(now());
  const elapsed = daysBetweenDates(startDate, today);
  return Math.max(0, elapsed) + 1;
}

function safeBack() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/(app)/(tabs)/today");
  }
}

type CeremonyState = "answering" | "submitting" | "outcome";

const QUESTIONS = [
  "I do this without having to consciously remember.",
  "It would feel strange not to do this.",
  "I do this automatically.",
];

export default function GraduationCeremonyScreen() {
  const { habitId: habitIdParam } = useLocalSearchParams<{
    habitId?: string | string[];
  }>();
  const habitId = normalizeHabitId(habitIdParam);
  const insets = useSafeAreaInsets();
  const { accessMode } = useTrialValidation();
  const isReadOnly = accessMode === "read_only";
  const habitDetail = useHabitDetail(habitId);
  const recordGraduation = useRecordGraduationMutation();

  const [q1, setQ1] = useState<number | null>(null);
  const [q2, setQ2] = useState<number | null>(null);
  const [q3, setQ3] = useState<number | null>(null);
  const [state, setState] = useState<CeremonyState>("answering");
  const [outcome, setOutcome] = useState<{
    averageScore: number;
    graduated: boolean;
    message: string;
  } | null>(null);
  const [saveError, setSaveError] = useState(false);

  if (habitDetail.isLoading) {
    return <LoadingState message="Loading..." />;
  }

  if (habitDetail.error || !habitDetail.habit) {
    return (
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + SCREEN_TOP_PADDING }]}
        contentInsetAdjustmentBehavior="automatic"
        style={styles.screen}
      >
        <ErrorState message={getLoadGraduationErrorMessage()} />
      </ScrollView>
    );
  }

  const habit = habitDetail.habit;

  // Blocked-state guards only apply before the ceremony starts. Once the user
  // has begun submitting or has an outcome to view, we own the screen — a
  // successful mutation flips habit_state to "automatic" and we must not yank
  // the user away from their own pass/fail card.
  if (state === "answering") {
    if (isReadOnly) {
      return (
        <BlockedState
          body="Graduation isn't available while the app is in read-only mode. Reconnect to restore full access."
          topInset={insets.top}
        />
      );
    }

    if (habit.habit_state === "automatic") {
      return (
        <BlockedState
          body="This habit is already marked Automatic."
          topInset={insets.top}
        />
      );
    }
  }

  const allAnswered = q1 !== null && q2 !== null && q3 !== null;
  const disableQuestions = state === "submitting";
  const days = daysSinceStart(habit.start_date);

  async function handleSubmit() {
    if (!allAnswered || state === "submitting" || recordGraduation.isPending) {
      return;
    }
    setSaveError(false);
    setState("submitting");
    try {
      const { response } = await recordGraduation.mutateAsync({
        habit_id: habit.id,
        q1_score: q1!,
        q2_score: q2!,
        q3_score: q3!,
      });
      // Outcome is sourced from the persisted response so the UI can never
      // disagree with what's in the DB; scoreGraduation is reused only to
      // pick the deterministic copy for that average.
      const { message } = scoreGraduation({ q1: q1!, q2: q2!, q3: q3! });
      setOutcome({
        averageScore: response.average_score,
        graduated: response.graduated,
        message,
      });
      setState("outcome");
    } catch {
      setSaveError(true);
      setState("answering");
    }
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: insets.top + SCREEN_TOP_PADDING }]}
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Back"
          hitSlop={12}
          onPress={safeBack}
          style={styles.backButton}
        >
          <ChevronLeft color={colors.textMuted} size={22} strokeWidth={1.75} />
        </Pressable>
        <Text selectable style={styles.habitTitle}>
          {habit.title}
        </Text>
        {habit.identity_phrase ? (
          <Text style={styles.identityText}>Become {habit.identity_phrase}</Text>
        ) : null}
        <Text style={styles.framingText}>
          This habit has been part of your life for {days} days. Let&apos;s
          check whether it&apos;s become automatic — or whether it still needs
          your attention.
        </Text>
      </View>

      {state === "outcome" && outcome ? (
        <ZenCard>
          <Eyebrow label={outcome.graduated ? "Graduation" : "Not yet"} />
          <Text style={styles.outcomeMessage}>{outcome.message}</Text>
          <Text style={styles.outcomeScore}>
            Score: {outcome.averageScore.toFixed(1)} / 5
          </Text>
          <PrimaryButton
            label="Back to habit"
            onPress={() => {
              router.replace({
                pathname: "/(app)/habits/[habitId]",
                params: { habitId: habit.id },
              });
            }}
          />
        </ZenCard>
      ) : (
        <View style={styles.questionsBlock}>
          <Eyebrow label="Three quick questions" />
          <SRHIQuestion
            disabled={disableQuestions}
            onSelect={setQ1}
            questionNumber={1}
            questionText={QUESTIONS[0]}
            selectedScore={q1}
          />
          <SRHIQuestion
            disabled={disableQuestions}
            onSelect={setQ2}
            questionNumber={2}
            questionText={QUESTIONS[1]}
            selectedScore={q2}
          />
          <SRHIQuestion
            disabled={disableQuestions}
            onSelect={setQ3}
            questionNumber={3}
            questionText={QUESTIONS[2]}
            selectedScore={q3}
          />
          {saveError ? (
            <ErrorState message={getSaveGraduationErrorMessage()} />
          ) : null}
          <PrimaryButton
            disabled={!allAnswered || state === "submitting"}
            label={state === "submitting" ? "Saving..." : "See result"}
            onPress={() => void handleSubmit()}
          />
        </View>
      )}
    </ScrollView>
  );
}

function BlockedState({
  body,
  topInset,
}: {
  body: string;
  topInset: number;
}) {
  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingTop: topInset + SCREEN_TOP_PADDING }]}
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
    >
      <ZenCard>
        <Eyebrow label="Graduation" />
        <Text selectable style={styles.blockedBody}>
          {body}
        </Text>
      </ZenCard>
      <SecondaryButton label="Go back" onPress={safeBack} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  blockedBody: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyLg,
    lineHeight: 24,
  },
  content: {
    gap: spacing.xl,
    padding: spacing.xl,
  },
  framingText: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyLg,
    lineHeight: 24,
  },
  habitTitle: {
    color: colors.text,
    fontFamily: fontFamilies.displayBold,
    fontSize: typography.headlineLg,
  },
  header: {
    gap: spacing.sm,
  },
  identityText: {
    color: colors.primary,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    fontStyle: "italic",
  },
  outcomeMessage: {
    color: colors.text,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyLg,
    lineHeight: 24,
  },
  outcomeScore: {
    color: colors.textFaint,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
  },
  questionsBlock: {
    gap: spacing.lg,
  },
  screen: {
    backgroundColor: colors.bg,
    flex: 1,
  },
});
