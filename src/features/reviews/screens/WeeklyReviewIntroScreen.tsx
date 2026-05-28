import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { OnboardingLayout } from "@/components/layouts/OnboardingLayout";
import { Eyebrow } from "@/components/text/Eyebrow";
import { markWeeklyReviewIntroSeen } from "@/features/reviews/onboardingStorage";
import {
  goalReviewRoute,
  normalizeReturnTo,
} from "@/features/reviews/reviewRoutes";
import { trackEvent } from "@/services/analytics";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { normalizeParam } from "@/utils/params";

const HEADLINE = "A weekly look back.";
const BODY =
  "See what's settling in, and what isn't fitting yet — that's information, not failure. Where a habit needs to change, you write the change yourself, in your own words. That's how it stays yours.";

export default function WeeklyReviewIntroScreen() {
  const params = useLocalSearchParams<{
    identityPhrase?: string;
    returnTo?: string | string[];
  }>();
  const rawIdentityPhrase = normalizeParam(
    params.identityPhrase as string | string[] | undefined,
  );
  const hasTarget = Boolean(rawIdentityPhrase);

  useEffect(() => {
    trackEvent("weekly_review_intro_viewed");
  }, []);

  async function finishIntro(action: "completed" | "skipped") {
    // Only emit the "intro done" analytics when the write actually
    // persisted — otherwise the next session will show the intro again,
    // and the analytics would have falsely claimed it was completed.
    // Navigate either way to avoid a dead tap on transient DB failure.
    const persisted = await markWeeklyReviewIntroSeen();
    if (persisted) {
      trackEvent(`weekly_review_intro_${action}`);
    }

    if (hasTarget && rawIdentityPhrase) {
      const decoded = decodeURIComponent(rawIdentityPhrase);
      router.replace(goalReviewRoute(decoded, normalizeReturnTo(params.returnTo)));
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace("/(app)/(tabs)/today");
  }

  function handlePrimaryPress() {
    void finishIntro("completed");
  }

  function handleSkip() {
    void finishIntro("skipped");
  }

  return (
    <OnboardingLayout
      footer={
        <View style={styles.footerStack}>
          <PrimaryButton
            label={hasTarget ? "Start review" : "Got it"}
            onPress={handlePrimaryPress}
            showArrow
          />
        </View>
      }
    >
      <View style={styles.header}>
        <Eyebrow label="Weekly Review · Intro" tone="primary" />
        <Pressable
          accessibilityLabel="Skip intro"
          accessibilityRole="button"
          hitSlop={12}
          onPress={handleSkip}
          style={styles.skipButton}
        >
          <Text style={styles.skipLabel}>Skip</Text>
        </Pressable>
      </View>

      {/* Centered axis: emblem + headline + body share one center line.
       * The "Centered emblem · left text" variant in the mockup was
       * marked as accidental-looking; this matches the recommended
       * fully-centered composition. */}
      <View style={styles.centeredContent}>
        {/* Four nested concentric rings of `colors.primary` at
         * increasing opacities, matching the design mockup's
         * 4-ring emblem (no Lucide icon, no halo discs). Built with
         * absolute-positioned children inside a 120×120 box. */}
        <View
          accessibilityRole="image"
          accessibilityLabel="Weekly review emblem"
          style={styles.emblem}
        >
          <View style={[styles.emblemRing, styles.emblemRing0]} />
          <View style={[styles.emblemRing, styles.emblemRing1]} />
          <View style={[styles.emblemRing, styles.emblemRing2]} />
          <View style={[styles.emblemRing, styles.emblemRing3]} />
        </View>

        <Text style={styles.headline}>{HEADLINE}</Text>
        <Text style={styles.body}>{BODY}</Text>
      </View>
    </OnboardingLayout>
  );
}

const EMBLEM_SIZE = 120;

const styles = StyleSheet.create({
  body: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyLg,
    letterSpacing: 0.16,
    lineHeight: 22.8,
    maxWidth: 330,
    textAlign: "center",
  },
  centeredContent: {
    alignItems: "center",
  },
  emblem: {
    height: EMBLEM_SIZE,
    marginBottom: spacing.xl + spacing.sm, // ~34px to match mockup
    marginTop: spacing.xs,
    position: "relative",
    width: EMBLEM_SIZE,
  },
  emblemRing: {
    backgroundColor: colors.primary,
    position: "absolute",
  },
  // Outermost ring: full 120×120, faintest.
  emblemRing0: {
    borderRadius: EMBLEM_SIZE / 2,
    bottom: 0,
    left: 0,
    opacity: 0.07,
    right: 0,
    top: 0,
  },
  // Inset 16px on each side → 88×88.
  emblemRing1: {
    borderRadius: (EMBLEM_SIZE - 32) / 2,
    bottom: 16,
    left: 16,
    opacity: 0.13,
    right: 16,
    top: 16,
  },
  // Inset 32px → 56×56.
  emblemRing2: {
    borderRadius: (EMBLEM_SIZE - 64) / 2,
    bottom: 32,
    left: 32,
    opacity: 0.2,
    right: 32,
    top: 32,
  },
  // Inset 48px → 24×24, solid center dot.
  emblemRing3: {
    borderRadius: (EMBLEM_SIZE - 96) / 2,
    bottom: 48,
    left: 48,
    opacity: 1,
    right: 48,
    top: 48,
  },
  footerStack: {
    alignItems: "stretch",
    gap: spacing.lg,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xxl,
  },
  headline: {
    color: colors.text,
    fontFamily: fontFamilies.displayBold,
    fontSize: typography.headlineLg,
    letterSpacing: -0.2,
    lineHeight: 29.1,
    marginBottom: spacing.lg,
    textAlign: "center",
  },
  skipButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  skipLabel: {
    color: colors.textMuted,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.bodyMd,
  },
});
