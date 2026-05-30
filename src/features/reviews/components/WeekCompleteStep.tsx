import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Eyebrow } from "@/components/text/Eyebrow";
import { useThemedStyles } from "@/theme/useThemedStyles";
import { useTheme } from "@/theme/useTheme";

export type CatchUpState = "idle" | "pending" | "error" | "done";

type WeekCompleteStepProps = {
  identityPhrase: string;
  daysOnJourney: number;
  /** Percent of habit-days completed this week (0-100). When null, the
   * goal has zero active days this week (e.g., brand-new goal) and we
   * suppress the percent entirely — showing "0% consistent" to a new
   * user is misleading. */
  consistencyPercent: number | null;
  tunedCount: number;
  skippedCount: number;
  hasMutation: boolean;
  catchUpState: CatchUpState;
  onDone: () => void;
  onRetryCatchUp: () => void;
};

function getFootnote(tunedCount: number): string {
  if (tunedCount === 0) return "No changes this week — it's working.";
  if (tunedCount === 1) return "One small change, made on purpose.";
  return `${tunedCount} small changes, made on purpose.`;
}

// Emblem geometry — proportionally matches the design mockup's
// 104×104 emblem (insets 14 / 28 / 42 from each side, opacity 0.07 /
// 0.13 / 0.20 / 1.0).
const EMBLEM_SIZE = 104;

export function WeekCompleteStep({
  identityPhrase,
  daysOnJourney,
  consistencyPercent,
  tunedCount,
  skippedCount: _skippedCount,
  hasMutation: _hasMutation,
  catchUpState,
  onDone,
  onRetryCatchUp,
}: WeekCompleteStepProps) {
  const theme = useTheme();
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      breath: { height: t.spacing.md },
      consist: {
        color: t.colors.text,
        fontFamily: t.fontFamilies.bodySemi,
        fontSize: t.typography.titleLg,
        lineHeight: 27,
        textAlign: "center",
      },
      consistPct: {
        color: t.colors.primary,
        fontFamily: t.fontFamilies.displayBold,
        fontSize: t.typography.headlineLg,
      },
      container: { gap: t.spacing.xl },
      content: {
        alignItems: "center",
        paddingTop: t.spacing.md,
      },
      dayLine: {
        color: t.colors.text,
        fontFamily: t.fontFamilies.displayBold,
        fontSize: t.typography.displayLg,
        letterSpacing: -0.72,
        lineHeight: 40,
        marginTop: t.spacing.xs,
        textAlign: "center",
      },
      emblem: {
        height: EMBLEM_SIZE,
        marginBottom: t.spacing.xl,
        position: "relative",
        width: EMBLEM_SIZE,
      },
      emblemRing: {
        backgroundColor: t.colors.primary,
        position: "absolute",
      },
      emblemRing0: {
        borderRadius: EMBLEM_SIZE / 2,
        bottom: 0,
        left: 0,
        opacity: 0.07,
        right: 0,
        top: 0,
      },
      emblemRing1: {
        borderRadius: (EMBLEM_SIZE - 28) / 2,
        bottom: 14,
        left: 14,
        opacity: 0.13,
        right: 14,
        top: 14,
      },
      emblemRing2: {
        borderRadius: (EMBLEM_SIZE - 56) / 2,
        bottom: 28,
        left: 28,
        opacity: 0.2,
        right: 28,
        top: 28,
      },
      emblemRing3: {
        borderRadius: (EMBLEM_SIZE - 84) / 2,
        bottom: 42,
        left: 42,
        opacity: 1,
        right: 42,
        top: 42,
      },
      errorBlock: { gap: t.spacing.md },
      footnote: {
        color: t.colors.textMuted,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyMd,
        lineHeight: 18.6,
        marginTop: t.spacing.md,
        textAlign: "center",
      },
      hero: {
        alignSelf: "stretch",
        color: t.colors.primaryGradientEnd,
        fontFamily: t.fontFamilies.displaySemiItalic,
        fontSize: t.typography.headlineMd,
        lineHeight: 32.7,
        marginTop: t.spacing.md,
        paddingHorizontal: t.spacing.lg,
        textAlign: "center",
      },
      savingBlock: {
        alignItems: "center",
        gap: t.spacing.sm,
        paddingVertical: t.spacing.md,
      },
      savingText: {
        color: t.colors.textMuted,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyMd,
      },
    }),
  );

  const isPending = catchUpState === "pending" || catchUpState === "idle";
  const hasError = catchUpState === "error";
  const isDone = catchUpState === "done";

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Same concentric-ring emblem family as the intro screen. The
         * intro is 120×120; this is 104×104 — proportionally smaller
         * because the Complete content has more layered hierarchy
         * (eyebrow, hero, day, stat, footnote) competing for space. */}
        <View
          accessibilityRole="image"
          accessibilityLabel="Weekly review complete"
          style={styles.emblem}
        >
          <View style={[styles.emblemRing, styles.emblemRing0]} />
          <View style={[styles.emblemRing, styles.emblemRing1]} />
          <View style={[styles.emblemRing, styles.emblemRing2]} />
          <View style={[styles.emblemRing, styles.emblemRing3]} />
        </View>

        <Eyebrow label="Week reviewed" tone="primary" />

        {/* Identity as italic hero — the anchor for "what this is in
         * service of." Sage-italic color matches the mockup. */}
        <Text style={styles.hero}>Becoming {identityPhrase}</Text>

        {/* Day count is the big number — the identity's age. */}
        <Text style={styles.dayLine}>
          Day {daysOnJourney}
        </Text>

        <View style={styles.breath} />

        {/* This week's consistency — primary stat. When the goal has
         * no active days yet (brand-new), suppress the percent and
         * render a softer "first week" line instead of "0% consistent." */}
        {consistencyPercent === null ? (
          <Text style={styles.consist}>
            Your first week is just getting going.
          </Text>
        ) : (
          <Text style={styles.consist}>
            <Text style={styles.consistPct}>{consistencyPercent}%</Text>
            {" "}
            consistent this week.
          </Text>
        )}

        <Text style={styles.footnote}>{getFootnote(tunedCount)}</Text>
      </View>

      {isPending ? (
        <View style={styles.savingBlock}>
          <ActivityIndicator color={theme.colors.primary} size="small" />
          <Text style={styles.savingText}>Saving your review…</Text>
        </View>
      ) : null}

      {hasError ? (
        <View style={styles.errorBlock}>
          <ErrorState message="We couldn't save your review. Try again." />
          <SecondaryButton label="Retry" onPress={onRetryCatchUp} />
        </View>
      ) : null}

      {isDone ? <PrimaryButton label="Done" onPress={onDone} /> : null}
    </View>
  );
}

