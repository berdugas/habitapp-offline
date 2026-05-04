import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import { GoalContextChip } from "@/components/GoalContextChip";
import { LucideIcon, LucideIconPicker } from "@/components/LucideIconPicker";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { ChoicePills } from "@/components/forms/ChoicePills";
import { OnboardingInput } from "@/components/forms/OnboardingInput";
import { OnboardingLayout } from "@/components/layouts/OnboardingLayout";
import { ErrorState } from "@/components/feedback/ErrorState";
import { useAuthSession } from "@/features/auth/hooks";
import { listEligibleHabitsForToday } from "@/features/habits/api";
import { formatHabitFormula } from "@/features/habits/formatters";
import {
  getEligibleHabitsQueryKey,
  useCreateHabitMutation,
} from "@/features/habits/hooks";
import { PREFERRED_TIME_WINDOW_OPTIONS } from "@/features/habits/preferredTimeWindows";
import { logger } from "@/services/logger";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { radius } from "@/theme/radius";
import { shadows } from "@/theme/shadows";
import { spacing } from "@/theme/spacing";
import { toDeviceDateString } from "@/utils/dates";
import { getCreateHabitErrorMessage } from "@/utils/userFacingErrors";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "goal" | "action" | "build" | "personalize";

export type CreateHabitDraft = {
  identityPhrase: string;
  dailyAction: string;
  tinyAction: string;
  cue: string;
  habitName: string;
  icon: string;
  minimumViableAction: string;
  preferredTimeWindow: string;
};

const EMPTY_DRAFT: CreateHabitDraft = {
  identityPhrase: "",
  dailyAction: "",
  tinyAction: "",
  cue: "",
  habitName: "",
  icon: "",
  minimumViableAction: "",
  preferredTimeWindow: "",
};

const STEP_ORDER: Step[] = ["goal", "action", "build", "personalize"];

// ─── Main component ───────────────────────────────────────────────────────────

export default function CreateHabitFlow() {
  const params = useLocalSearchParams<{ goalIdentityPhrase?: string | string[] }>();
  const inheritedPhrase = Array.isArray(params.goalIdentityPhrase)
    ? params.goalIdentityPhrase[0]
    : params.goalIdentityPhrase;

  const goalMode = inheritedPhrase ? "existing" : "new";
  const initialStep: Step = goalMode === "existing" ? "action" : "goal";

  const { user } = useAuthSession();
  const queryClient = useQueryClient();
  const createHabitMutation = useCreateHabitMutation();

  const [step, setStep] = useState<Step>(initialStep);
  const [draft, setDraft] = useState<CreateHabitDraft>({
    ...EMPTY_DRAFT,
    identityPhrase: inheritedPhrase ?? "",
  });
  const [focusTinyActionOnBuild, setFocusTinyActionOnBuild] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const submitLockRef = useRef(false);

  const entryOpacity = useRef(new Animated.Value(1)).current;
  const entryTranslate = useRef(new Animated.Value(0)).current;

  function update(patch: Partial<CreateHabitDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  function advanceTo(nextStep: Step) {
    entryOpacity.setValue(0);
    entryTranslate.setValue(16);
    setStep(nextStep);
    Animated.parallel([
      Animated.timing(entryOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(entryTranslate, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  }

  function handleBack() {
    const idx = STEP_ORDER.indexOf(step);
    const firstStep = goalMode === "existing" ? "action" : "goal";
    if (step === firstStep) {
      router.back();
    } else {
      advanceTo(STEP_ORDER[idx - 1] as Step);
    }
  }

  function handleReturnToBuild() {
    setFocusTinyActionOnBuild(true);
    advanceTo("build");
  }

  async function handleSave() {
    if (submitLockRef.current || createHabitMutation.isPending || !user?.id) return;
    setSaveError(null);
    submitLockRef.current = true;
    let hasSaved = false;

    try {
      await createHabitMutation.mutateAsync({
        identityPhrase: draft.identityPhrase.trim(),
        title: draft.habitName.trim(),
        cue: draft.cue.trim(),
        tinyAction: draft.tinyAction.trim(),
        minimumViableAction: draft.minimumViableAction.trim(),
        preferredTimeWindow: draft.preferredTimeWindow.trim(),
        icon: draft.icon.trim(),
        habitState: "active",
      });
      hasSaved = true;

      const todayDate = toDeviceDateString();
      const queryKey = getEligibleHabitsQueryKey(user.id, todayDate);
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.fetchQuery({
        queryFn: () => listEligibleHabitsForToday(user.id, todayDate),
        queryKey,
      });
      router.replace("/(app)/(tabs)/today");
    } catch (error) {
      if (hasSaved) {
        logger.warn("Eligible habits refresh failed after successful create", { error });
        router.replace("/(app)/(tabs)/today");
      } else {
        logger.error("CreateHabitFlow save failed", { error });
        setSaveError(getCreateHabitErrorMessage());
      }
    } finally {
      submitLockRef.current = false;
    }
  }

  const showChip = step !== "goal" && draft.identityPhrase.trim().length > 0;

  let stepContent: React.ReactNode;

  if (step === "goal") {
    const canContinue = draft.identityPhrase.trim().length >= 2;
    stepContent = (
      <OnboardingLayout
        keyboardAware
        footer={
          <PrimaryButton
            disabled={!canContinue}
            label="Continue"
            showArrow
            onPress={() => advanceTo("action")}
          />
        }
      >
        <BackRow onBack={handleBack} />
        <Text style={styles.headline}>What kind of person do you want to become?</Text>
        <Text style={styles.subline}>This is the transformation your new habits will support.</Text>
        <OnboardingInput
          label="Become someone who..."
          placeholder="runs regularly, reads daily..."
          value={draft.identityPhrase}
          onChangeText={(text) => update({ identityPhrase: text })}
        />
      </OnboardingLayout>
    );
  } else if (step === "action") {
    stepContent = (
      <ActionStep
        draft={draft}
        update={update}
        onBack={handleBack}
        onContinue={() => advanceTo("build")}
        showChip={showChip}
      />
    );
  } else if (step === "build") {
    stepContent = (
      <BuildStep
        draft={draft}
        update={update}
        onBack={handleBack}
        onContinue={() => advanceTo("personalize")}
        showChip={showChip}
        focusTinyAction={focusTinyActionOnBuild}
        onFocusConsumed={() => setFocusTinyActionOnBuild(false)}
      />
    );
  } else {
    stepContent = (
      <PersonalizeStep
        draft={draft}
        update={update}
        onBack={handleBack}
        onReturnToBuild={handleReturnToBuild}
        onSave={() => void handleSave()}
        isSaving={createHabitMutation.isPending}
        saveError={saveError}
        showChip={showChip}
      />
    );
  }

  return (
    <Animated.View
      style={[
        styles.root,
        { opacity: entryOpacity, transform: [{ translateY: entryTranslate }] },
      ]}
    >
      {stepContent}
    </Animated.View>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function BackRow({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.backRow}>
      <Pressable onPress={onBack} style={styles.backButton} accessibilityLabel="Go back">
        <ArrowLeft color={colors.textMuted} size={20} strokeWidth={1.75} />
      </Pressable>
    </View>
  );
}

// ─── Action step ──────────────────────────────────────────────────────────────

type ActionStepProps = {
  draft: CreateHabitDraft;
  update: (patch: Partial<CreateHabitDraft>) => void;
  onBack: () => void;
  onContinue: () => void;
  showChip: boolean;
};

function ActionStep({ draft, update, onBack, onContinue, showChip }: ActionStepProps) {
  const canContinue = draft.dailyAction.trim().length >= 2;
  return (
    <OnboardingLayout
      keyboardAware
      footer={
        <PrimaryButton
          disabled={!canContinue}
          label="Continue"
          showArrow
          onPress={onContinue}
        />
      }
    >
      <BackRow onBack={onBack} />
      {showChip ? <GoalContextChip identityPhrase={draft.identityPhrase} /> : null}
      <Text style={styles.headline}>What's one thing this person does every day?</Text>
      <Text style={styles.subline}>Don't worry about making it small yet — we'll do that next.</Text>
      <OnboardingInput
        label="Daily action"
        placeholder="Goes for a walk, reads before bed..."
        value={draft.dailyAction}
        onChangeText={(text) => update({ dailyAction: text })}
      />
    </OnboardingLayout>
  );
}

// ─── Build step (shrink + cue combined) ───────────────────────────────────────

type BuildStepProps = {
  draft: CreateHabitDraft;
  update: (patch: Partial<CreateHabitDraft>) => void;
  onBack: () => void;
  onContinue: () => void;
  showChip: boolean;
  focusTinyAction: boolean;
  onFocusConsumed: () => void;
};

function BuildStep({
  draft,
  update,
  onBack,
  onContinue,
  showChip,
  focusTinyAction,
  onFocusConsumed,
}: BuildStepProps) {
  const tinyActionRef = useRef<TextInput>(null);
  const canContinue =
    draft.tinyAction.trim().length >= 2 && draft.cue.trim().length >= 2;

  useEffect(() => {
    if (focusTinyAction) {
      setTimeout(() => {
        tinyActionRef.current?.focus();
        onFocusConsumed();
      }, 100);
    }
  }, [focusTinyAction, onFocusConsumed]);

  const formulaPreview = formatHabitFormula(draft.cue, draft.tinyAction);
  const showFormula =
    draft.tinyAction.trim().length > 0 || draft.cue.trim().length > 0;

  return (
    <OnboardingLayout
      keyboardAware
      footer={
        <PrimaryButton
          disabled={!canContinue}
          label="Continue"
          showArrow
          onPress={onContinue}
        />
      }
    >
      <BackRow onBack={onBack} />
      {showChip ? <GoalContextChip identityPhrase={draft.identityPhrase} /> : null}

      <Text style={styles.headline}>Now make it tiny.</Text>
      <Text style={styles.subline}>So small you can't say no, even on your worst day.</Text>

      {draft.dailyAction.trim().length > 0 ? (
        <View style={styles.readOnlyPill}>
          <Text style={styles.readOnlyPillText} numberOfLines={2}>
            {draft.dailyAction.trim()}
          </Text>
        </View>
      ) : null}

      <View style={styles.sectionGap}>
        <OnboardingInput
          ref={tinyActionRef}
          label="Your tiny version"
          placeholder="Make it even smaller..."
          value={draft.tinyAction}
          onChangeText={(text) => update({ tinyAction: text })}
        />
      </View>

      <Text style={styles.sectionLabel}>What triggers it?</Text>
      <OnboardingInput
        label="After I..."
        placeholder="brush my teeth, have coffee..."
        value={draft.cue}
        onChangeText={(text) => update({ cue: text })}
      />

      {showFormula ? (
        <View style={styles.formulaCard}>
          <Text style={styles.formulaText}>{formulaPreview}</Text>
        </View>
      ) : null}
    </OnboardingLayout>
  );
}

// ─── Personalize step (two-phase: personalize + worst-day gate) ───────────────

type PersonalizeStepProps = {
  draft: CreateHabitDraft;
  update: (patch: Partial<CreateHabitDraft>) => void;
  onBack: () => void;
  onReturnToBuild: () => void;
  onSave: () => void;
  isSaving: boolean;
  saveError: string | null;
  showChip: boolean;
};

type PersonalizePhase = "personalize" | "worstday";

function PersonalizeStep({
  draft,
  update,
  onBack,
  onReturnToBuild,
  onSave,
  isSaving,
  saveError,
  showChip,
}: PersonalizeStepProps) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<PersonalizePhase>("personalize");
  const [showPicker, setShowPicker] = useState(false);

  const phase2Opacity = useRef(new Animated.Value(0)).current;
  const phase2Translate = useRef(new Animated.Value(16)).current;
  const scrollRef = useRef<ScrollView>(null);

  const canLooksGood = draft.habitName.trim().length >= 2;

  function handleLooksGood() {
    setShowPicker(false);
    setPhase("worstday");
    Animated.parallel([
      Animated.timing(phase2Opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(phase2Translate, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  }

  const formula = formatHabitFormula(draft.cue, draft.tinyAction);

  const footer =
    phase === "personalize" ? (
      <PrimaryButton
        disabled={!canLooksGood}
        label="Looks good"
        showArrow
        onPress={handleLooksGood}
      />
    ) : (
      <View style={styles.gateFooter}>
        <PrimaryButton
          disabled={isSaving}
          label={isSaving ? "Saving..." : "Yes, I could"}
          showArrow
          onPress={onSave}
        />
        <SecondaryButton
          label="Let me make it smaller"
          onPress={onReturnToBuild}
        />
      </View>
    );

  return (
    <View style={styles.personalizeRoot}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.personalizeScroll,
          { paddingTop: insets.top + spacing.lg },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {phase === "personalize" ? <BackRow onBack={onBack} /> : null}
        {showChip ? <GoalContextChip identityPhrase={draft.identityPhrase} /> : null}

        {phase === "personalize" ? (
          <>
            <Text style={styles.headline}>Personalize your habit.</Text>
            <Text style={styles.subline}>Give it a name and an icon to make it yours.</Text>
          </>
        ) : null}

        {/* Preview card */}
        <View style={[styles.previewCard, phase === "worstday" && styles.previewCardLocked]}>
          <View style={styles.cardHeader}>
            <Pressable
              disabled={phase === "worstday"}
              onPress={() => phase === "personalize" && setShowPicker((v) => !v)}
              style={styles.iconButton}
            >
              <LucideIcon
                name={draft.icon || "Sparkles"}
                size={22}
                color={draft.icon ? colors.primary : colors.textFaint}
                strokeWidth={1.8}
              />
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

          {showPicker && phase === "personalize" ? (
            <View style={styles.pickerContainer}>
              <LucideIconPicker
                selected={draft.icon || null}
                onSelect={(name) => {
                  update({ icon: name });
                  setShowPicker(false);
                }}
              />
            </View>
          ) : null}

          <Text style={styles.formulaPreview}>{formula}</Text>

          {draft.identityPhrase.trim().length > 0 ? (
            <View style={styles.goalBadge}>
              <LucideIcon name="Target" size={13} color={colors.primary} strokeWidth={2} />
              <Text style={styles.goalBadgeText}>Becoming {draft.identityPhrase.trim()}</Text>
            </View>
          ) : null}
        </View>

        {phase === "personalize" ? (
          <Text style={styles.micro}>You can rename or change the icon anytime.</Text>
        ) : null}

        {/* Optional fields — only in personalize phase */}
        {phase === "personalize" ? (
          <View style={styles.optionalFields}>
            <OnboardingInput
              label="Minimum viable action (optional)"
              placeholder="The bare minimum on a hard day"
              value={draft.minimumViableAction}
              onChangeText={(text) => update({ minimumViableAction: text })}
            />
            <ChoicePills
              label="Preferred time window"
              onChange={(val) => update({ preferredTimeWindow: val })}
              options={PREFERRED_TIME_WINDOW_OPTIONS}
              value={draft.preferredTimeWindow}
            />
          </View>
        ) : null}

        {/* Phase 2: worst-day gate */}
        <Animated.View
          style={[
            styles.gateContainer,
            {
              opacity: phase2Opacity,
              transform: [{ translateY: phase2Translate }],
            },
          ]}
          pointerEvents={phase === "worstday" ? "auto" : "none"}
        >
          <Text style={styles.gateHeadline}>One last check.</Text>
          <Text style={styles.gateQuestion}>
            Could you still do{" "}
            <Text style={styles.gateActionBold}>{draft.tinyAction.trim()}</Text>
            {" "}on your worst day?
          </Text>
          <Text style={styles.gateBody}>
            Imagine a low-energy day — would this still feel doable?
          </Text>
        </Animated.View>

        {saveError ? (
          <View style={styles.saveErrorWrap}>
            <ErrorState message={saveError} />
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.personalizeFooter, { paddingBottom: Math.max(insets.bottom + spacing.lg, spacing.xxxl) }]}>
        {footer}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  backRow: {
    marginBottom: spacing.lg,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headline: {
    fontFamily: fontFamilies.displayBold,
    fontSize: 26,
    lineHeight: 32,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subline: {
    fontFamily: fontFamilies.body,
    fontSize: 15,
    lineHeight: 23,
    color: colors.textMuted,
    marginBottom: spacing.xl,
  },
  readOnlyPill: {
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    marginBottom: spacing.lg,
    maxWidth: "90%",
  },
  readOnlyPillText: {
    fontFamily: fontFamilies.bodySemi,
    fontSize: 14,
    color: colors.primary,
  },
  sectionGap: {
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    fontFamily: fontFamilies.displaySemi,
    fontSize: 18,
    lineHeight: 24,
    color: colors.text,
    marginBottom: spacing.md,
  },
  formulaCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    boxShadow: shadows.inputField,
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  formulaText: {
    fontFamily: fontFamilies.bodySemi,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  // Personalize step
  personalizeRoot: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  personalizeScroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  personalizeFooter: {
    paddingHorizontal: spacing.xl,
  },
  saveErrorWrap: {
    marginTop: spacing.lg,
  },
  previewCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    padding: spacing.xl,
    boxShadow: shadows.cardFloat,
    gap: spacing.md,
    marginBottom: spacing.sm,
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
  formulaPreview: {
    fontFamily: fontFamilies.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
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
  goalBadgeText: {
    fontFamily: fontFamilies.bodySemi,
    fontSize: 13,
    color: colors.primary,
  },
  micro: {
    fontFamily: fontFamilies.body,
    fontSize: 13,
    color: colors.textFaint,
    marginTop: 4,
    marginBottom: spacing.xl,
  },
  optionalFields: {
    gap: spacing.xl,
    marginTop: spacing.lg,
  },
  gateContainer: {
    marginTop: spacing.xxl,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  gateHeadline: {
    fontFamily: fontFamilies.displayBold,
    fontSize: 26,
    lineHeight: 31,
    color: colors.text,
  },
  gateQuestion: {
    fontFamily: fontFamilies.displaySemi,
    fontSize: 20,
    lineHeight: 28,
    color: colors.text,
  },
  gateActionBold: {
    fontFamily: fontFamilies.displayBold,
    color: colors.primary,
  },
  gateBody: {
    fontFamily: fontFamilies.body,
    fontSize: 15,
    lineHeight: 23,
    color: colors.textMuted,
  },
  gateFooter: {
    gap: spacing.md,
  },
});
