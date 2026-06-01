import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { OnboardingLayout } from "@/components/layouts/OnboardingLayout";
import { OnboardingHeader } from "@/components/navigation/OnboardingHeader";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import { stripLeadingAfter, stripLeadingIWill } from "@/features/habits/formatters";
import {
  LucideIcon,
  LucideIconPicker,
} from "@/components/LucideIconPicker";
import { useTheme } from "@/theme/useTheme";
import { useThemedStyles } from "@/theme/useThemedStyles";

type Phase = "personalize" | "worstday";

export default function PersonalizeScreen() {
  const { draft, update } = useOnboarding();
  const [phase, setPhase] = useState<Phase>("personalize");
  const [showPicker, setShowPicker] = useState(false);
  const [iconTapped, setIconTapped] = useState(false);
  const theme = useTheme();
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      headline: {
        fontFamily: t.fontFamilies.displayBold,
        fontSize: 28,
        lineHeight: 33,
        color: t.colors.text,
        marginBottom: 8,
      },
      body: {
        fontFamily: t.fontFamilies.body,
        fontSize: 15,
        lineHeight: 23,
        color: t.colors.textMuted,
        marginBottom: 20,
      },
      previewCard: {
        backgroundColor: t.colors.surfaceCard,
        borderRadius: t.radius.lg,
        padding: t.spacing.xl,
        boxShadow: t.shadows.cardFloat,
        gap: 16,
        marginBottom: t.spacing.md,
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
        backgroundColor: t.colors.primarySoft,
        alignItems: "center",
        justifyContent: "center",
      },
      nameContainer: {
        flex: 1,
      },
      nameHint: {
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.micro,
        color: t.colors.textFaint,
        marginBottom: 2,
      },
      nameInput: {
        fontFamily: t.fontFamilies.displaySemi,
        fontSize: t.typography.titleSm,
        color: t.colors.text,
        padding: 0,
      },
      nameLocked: {
        fontFamily: t.fontFamilies.displaySemi,
        fontSize: t.typography.titleSm,
        color: t.colors.text,
      },
      pickerContainer: {
        marginTop: 4,
      },
      formula: {
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyMd,
        lineHeight: 19.5,
        color: t.colors.textMuted,
      },
      formulaBold: {
        fontFamily: t.fontFamilies.bodySemi,
        color: t.colors.text,
      },
      micro: {
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.labelMd,
        color: t.colors.textFaint,
        marginTop: 4,
      },
      phase2Container: {
        marginTop: t.spacing.xl,
        gap: t.spacing.md,
      },
      phase2Headline: {
        fontFamily: t.fontFamilies.displayBold,
        fontSize: 26,
        lineHeight: 31,
        color: t.colors.text,
      },
      phase2Eyebrow: {
        fontFamily: t.fontFamilies.bodyMedium,
        fontSize: t.typography.bodyMd,
        lineHeight: 19.5,
        color: t.colors.primary,
      },
      phase2Question: {
        fontFamily: t.fontFamilies.displaySemi,
        fontSize: t.typography.titleLg,
        lineHeight: 23.4,
        color: t.colors.text,
        marginTop: t.spacing.sm,
      },
      phase2Body: {
        fontFamily: t.fontFamilies.body,
        fontSize: 15,
        lineHeight: 23,
        color: t.colors.textMuted,
      },
      phase2Footer: {
        gap: t.spacing.md,
      },
      goalBadge: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 6,
        backgroundColor: t.colors.primarySoft,
        borderRadius: t.radius.pill,
        paddingHorizontal: 12,
        paddingVertical: 6,
      },
      goalText: {
        fontFamily: t.fontFamilies.bodySemi,
        fontSize: t.typography.labelMd,
        color: t.colors.primary,
      },
    }),
  );

  const phase2Opacity = useRef(new Animated.Value(0)).current;
  const phase2Translate = useRef(new Animated.Value(16)).current;
  const iconScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (iconTapped || phase !== "personalize") return;

    // Heartbeat: two quick beats, longer rest, loop until tapped.
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(iconScale, { toValue: 1.2, duration: 220, useNativeDriver: true }),
        Animated.timing(iconScale, { toValue: 1.0, duration: 220, useNativeDriver: true }),
        Animated.delay(120),
        Animated.timing(iconScale, { toValue: 1.2, duration: 220, useNativeDriver: true }),
        Animated.timing(iconScale, { toValue: 1.0, duration: 220, useNativeDriver: true }),
        Animated.delay(900),
      ]),
    );

    const startTimer = setTimeout(() => pulse.start(), 400);

    return () => {
      clearTimeout(startTimer);
      pulse.stop();
    };
  }, [iconTapped, phase, iconScale]);

  const handleIconPress = () => {
    if (!iconTapped) {
      setIconTapped(true);
      // Snap back to 1.0 in case the loop was mid-beat when stopped.
      Animated.timing(iconScale, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    }
    setShowPicker((v) => !v);
  };

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
    update({ worstDayPassed: true, step: "make-it-yours" });
    router.push("/(onboarding)/make-it-yours");
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
          currentStep={6}
          onBack={() => {
            update({ step: "schedule" });
            if (router.canGoBack()) router.back();
            else router.replace("/(onboarding)/schedule");
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
          <Animated.View style={{ transform: [{ scale: iconScale }] }}>
            <Pressable
              disabled={phase === "worstday"}
              onPress={handleIconPress}
              style={styles.iconButton}
            >
              {draft.habitIcon ? (
                <LucideIcon name={draft.habitIcon} size={22} color={theme.colors.primary} strokeWidth={1.8} />
              ) : (
                <LucideIcon name="Sparkles" size={22} color={theme.colors.textFaint} strokeWidth={1.8} />
              )}
            </Pressable>
          </Animated.View>

          <View style={styles.nameContainer}>
            <Text style={styles.nameHint}>Give it a name</Text>
            {phase === "personalize" ? (
              <TextInput
                autoCorrect
                placeholder="Tap to name"
                placeholderTextColor={theme.colors.textFaint}
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
          <Text style={styles.formulaBold}>{stripLeadingAfter(draft.cueExisting)}</Text>
          {", "}I will{" "}
          <Text style={styles.formulaBold}>{stripLeadingIWill(draft.tinyAction)}</Text>
        </Text>

        {draft.becomingPhrase ? (
          <View style={styles.goalBadge}>
            <LucideIcon name="Target" size={13} color={theme.colors.primary} strokeWidth={2} />
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
