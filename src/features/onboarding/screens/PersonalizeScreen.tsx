import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { OnboardingLayout } from "@/components/layouts/OnboardingLayout";
import { OnboardingHeader } from "@/components/navigation/OnboardingHeader";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import {
  LucideIcon,
  LucideIconPicker,
} from "@/features/onboarding/components/LucideIconPicker";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { radius } from "@/theme/radius";
import { shadows } from "@/theme/shadows";
import { spacing } from "@/theme/spacing";

type Phase = "personalize" | "worstday";

export default function PersonalizeScreen() {
  const { draft, update } = useOnboarding();
  const [phase, setPhase] = useState<Phase>("personalize");
  const [showPicker, setShowPicker] = useState(false);

  const phase2Opacity = useRef(new Animated.Value(0)).current;
  const phase2Translate = useRef(new Animated.Value(16)).current;

  const nameTrimmed = draft.habitName.trim();
  const canLooksGood = nameTrimmed.length >= 2;

  const handleLooksGood = () => {
    setShowPicker(false);
    setPhase("worstday");
    Animated.parallel([
      Animated.timing(phase2Opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(phase2Translate, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  };

  const handlePass = () => {
    update({ worstDayPassed: true, step: "confirmation" });
    router.push("/(onboarding)/confirmation");
  };

  const handleFail = () => {
    update({ worstDayPassed: false, step: "shrink" });
    router.replace("/(onboarding)/shrink");
  };

  const footer =
    phase === "personalize" ? (
      <PrimaryButton
        disabled={!canLooksGood}
        label="Looks good"
        showArrow
        onPress={handleLooksGood}
      />
    ) : (
      <View style={styles.phase2Footer}>
        <PrimaryButton label="Yes, I could" showArrow onPress={handlePass} />
        <SecondaryButton
          label="Probably not — let me make it smaller"
          onPress={handleFail}
        />
      </View>
    );

  return (
    <OnboardingLayout footer={footer}>
      {phase === "personalize" && (
        <OnboardingHeader
          currentStep={5}
          onBack={() => {
            update({ step: "cue" });
            if (router.canGoBack()) router.back();
            else router.replace("/(onboarding)/cue");
          }}
        />
      )}

      {phase === "personalize" && (
        <>
          <Text style={styles.headline}>Personalize your habit.</Text>
          <Text style={styles.body}>Give it a name and an icon to make it yours.</Text>
        </>
      )}

      {/* Habit preview card */}
      <View style={[styles.previewCard, phase === "worstday" && styles.previewCardLocked]}>
        <View style={styles.cardHeader}>
          <Pressable
            disabled={phase === "worstday"}
            onPress={() => phase === "personalize" && setShowPicker((v) => !v)}
            style={styles.iconButton}
          >
            {draft.habitIcon ? (
              <LucideIcon name={draft.habitIcon} size={22} color={colors.primary} strokeWidth={1.8} />
            ) : (
              <LucideIcon name="Sparkles" size={22} color={colors.textFaint} strokeWidth={1.8} />
            )}
          </Pressable>

          <View style={styles.nameContainer}>
            <Text style={styles.nameHint}>Give it a name</Text>
            {phase === "personalize" ? (
              <TextInput
                autoCorrect
                placeholder="Tap to name your habit"
                placeholderTextColor={colors.textFaint}
                style={styles.nameInput}
                value={draft.habitName}
                onChangeText={(text) => update({ habitName: text })}
              />
            ) : (
              <Text style={styles.nameLocked}>{draft.habitName}</Text>
            )}
          </View>
        </View>

        {showPicker && phase === "personalize" && (
          <View style={styles.pickerContainer}>
            <LucideIconPicker
              selected={draft.habitIcon}
              onSelect={(name) => {
                update({ habitIcon: name });
                setShowPicker(false);
              }}
            />
          </View>
        )}

        <Text style={styles.formula}>
          After{" "}
          <Text style={styles.formulaBold}>{draft.cueExisting}</Text>
          {", "}I will{" "}
          <Text style={styles.formulaBold}>{draft.tinyAction}</Text>
        </Text>

        {draft.becomingPhrase ? (
          <View style={styles.goalBadge}>
            <LucideIcon name="Target" size={13} color={colors.primary} strokeWidth={2} />
            <Text style={styles.goalText}>Becoming {draft.becomingPhrase}</Text>
          </View>
        ) : null}
      </View>

      {phase === "personalize" && (
        <Text style={styles.micro}>You can rename or change the icon anytime.</Text>
      )}

      {/* Phase 2: worst-day check */}
      <Animated.View
        style={[
          styles.phase2Container,
          {
            opacity: phase2Opacity,
            transform: [{ translateY: phase2Translate }],
          },
        ]}
        pointerEvents={phase === "worstday" ? "auto" : "none"}
      >
        <Text style={styles.phase2Headline}>One last check.</Text>
        <Text style={styles.phase2Eyebrow}>
          Most people start too big and quit. This check helps you set a habit you'll actually keep.
        </Text>

        <Text style={styles.phase2Question}>
          Could you still do this on your worst day?
        </Text>
        <Text style={styles.phase2Body}>
          Imagine a low-energy day. Would this still feel doable?
        </Text>
      </Animated.View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  headline: {
    fontFamily: fontFamilies.displayBold,
    fontSize: 28,
    lineHeight: 33,
    color: colors.text,
    marginBottom: 8,
  },
  body: {
    fontFamily: fontFamilies.body,
    fontSize: 15,
    lineHeight: 23,
    color: colors.textMuted,
    marginBottom: 20,
  },
  previewCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.xl,
    boxShadow: shadows.cardFloat,
    gap: 16,
    marginBottom: spacing.md,
  },
  previewCardLocked: {
    opacity: 0.9,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  nameContainer: {
    flex: 1,
  },
  nameHint: {
    fontFamily: fontFamilies.body,
    fontSize: 11,
    color: colors.textFaint,
    marginBottom: 2,
  },
  nameInput: {
    fontFamily: fontFamilies.displayBold,
    fontSize: 18,
    color: colors.text,
    padding: 0,
  },
  nameLocked: {
    fontFamily: fontFamilies.displayBold,
    fontSize: 18,
    color: colors.text,
  },
  pickerContainer: {
    marginTop: 4,
  },
  formula: {
    fontFamily: fontFamilies.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
  },
  formulaBold: {
    fontFamily: fontFamilies.bodySemi,
    color: colors.text,
  },
  micro: {
    fontFamily: fontFamilies.body,
    fontSize: 13,
    color: colors.textFaint,
    marginTop: 4,
  },
  phase2Container: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  phase2Headline: {
    fontFamily: fontFamilies.displayBold,
    fontSize: 26,
    lineHeight: 31,
    color: colors.text,
  },
  phase2Eyebrow: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 14,
    lineHeight: 21,
    color: colors.primary,
  },
  phase2Question: {
    fontFamily: fontFamilies.displaySemi,
    fontSize: 20,
    lineHeight: 26,
    color: colors.text,
    marginTop: spacing.sm,
  },
  phase2Body: {
    fontFamily: fontFamilies.body,
    fontSize: 15,
    lineHeight: 23,
    color: colors.textMuted,
  },
  phase2Footer: {
    gap: spacing.md,
  },
  goalBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  goalText: {
    fontFamily: fontFamilies.bodySemi,
    fontSize: 13,
    color: colors.primary,
  },
});
