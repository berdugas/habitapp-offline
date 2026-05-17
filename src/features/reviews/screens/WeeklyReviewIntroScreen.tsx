import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { OnboardingLayout } from "@/components/layouts/OnboardingLayout";
import { Eyebrow } from "@/components/text/Eyebrow";
import { ReviewStepIndicator } from "@/features/reviews/components/ReviewStepIndicator";
import { markWeeklyReviewIntroSeen } from "@/features/reviews/onboardingStorage";
import {
  goalReviewRoute,
  normalizeReturnTo,
} from "@/features/reviews/reviewRoutes";
import { trackEvent } from "@/services/analytics";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";
import { normalizeParam } from "@/utils/params";

type SlideContent = {
  headline: string;
  body: string;
};

const SLIDES: readonly SlideContent[] = [
  {
    headline: "This isn't a report card.",
    body: "It's how the habit stays alive. Each week, we tune what's not fitting yet — that's how the identity sticks.",
  },
  {
    headline: "Five quick steps.",
    body: "We'll look at the week, name what's working, diagnose what isn't, and pick one small adjustment. Takes about 3 minutes.",
  },
];

export default function WeeklyReviewIntroScreen() {
  const params = useLocalSearchParams<{
    identityPhrase?: string;
    returnTo?: string | string[];
  }>();
  const rawIdentityPhrase = normalizeParam(
    params.identityPhrase as string | string[] | undefined,
  );
  const hasTarget = Boolean(rawIdentityPhrase);

  const [slideIndex, setSlideIndex] = useState<0 | 1>(0);
  const slide = SLIDES[slideIndex]!;
  const isLastSlide = slideIndex === SLIDES.length - 1;

  useEffect(() => {
    trackEvent("weekly_review_intro_viewed", { slide: slideIndex + 1 });
  }, [slideIndex]);

  async function finishIntro(action: "completed" | "skipped") {
    // Only emit the "intro done" analytics when the write actually
    // persisted — otherwise the next session will show the intro again,
    // and the analytics would have falsely claimed it was completed.
    // Navigate either way to avoid a dead tap on transient DB failure.
    const persisted = await markWeeklyReviewIntroSeen();
    if (persisted) {
      trackEvent(`weekly_review_intro_${action}`, { slide: slideIndex + 1 });
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
    if (isLastSlide) {
      void finishIntro("completed");
      return;
    }
    setSlideIndex(1);
  }

  function handleSkip() {
    void finishIntro("skipped");
  }

  const primaryLabel = isLastSlide
    ? hasTarget
      ? "Start review"
      : "Got it"
    : "Continue";

  return (
    <OnboardingLayout
      footer={
        <View style={styles.footerStack}>
          <ReviewStepIndicator
            currentIndex={slideIndex}
            total={SLIDES.length}
          />
          <PrimaryButton
            label={primaryLabel}
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

      <Text style={styles.headline}>{slide.headline}</Text>
      <Text style={styles.body}>{slide.body}</Text>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: 16,
    letterSpacing: 0.16,
    lineHeight: 26,
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
    fontSize: 28,
    letterSpacing: -0.2,
    lineHeight: 34,
    marginBottom: spacing.lg,
  },
  skipButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  skipLabel: {
    color: colors.textMuted,
    fontFamily: fontFamilies.bodySemi,
    fontSize: 14,
  },
});
