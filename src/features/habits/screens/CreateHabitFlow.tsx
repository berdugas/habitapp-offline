import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
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
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ActiveDaysPicker } from "@/components/forms/ActiveDaysPicker";
import { ReminderPicker } from "@/components/forms/ReminderPicker";
import { GoalContextChip } from "@/components/GoalContextChip";
import { LucideIcon, LucideIconPicker } from "@/components/LucideIconPicker";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { TertiaryButton } from "@/components/buttons/TertiaryButton";
import { OnboardingInput } from "@/components/forms/OnboardingInput";
import { OnboardingLayout } from "@/components/layouts/OnboardingLayout";
import { ErrorState } from "@/components/feedback/ErrorState";
import { useAuthSession } from "@/features/auth/hooks";
import { listEligibleHabitsForToday } from "@/features/habits/api";
import { CapWarningCard } from "@/features/habits/components/CapWarningCard";
import { assertCanCreateActiveHabit } from "@/features/habits/validators";
import { formatHabitFormula, stripLeadingAfter, stripLeadingIWill } from "@/features/habits/formatters";
import {
  isValidIdentityPhraseDraft,
  normaliseBecomingPhrase,
} from "@/utils/normalisePhrase";
import {
  getEligibleHabitsQueryKey,
  useCreateHabitMutation,
} from "@/features/habits/hooks";
import {
  persistReminderIntent,
  scheduleReminder,
} from "@/features/reminders/notifications";
import { logger } from "@/services/logger";
import { useTheme } from "@/theme/useTheme";
import { useThemedStyles } from "@/theme/useThemedStyles";
import { toDeviceDateString } from "@/utils/dates";
import { getCreateHabitErrorMessage } from "@/utils/userFacingErrors";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "goal" | "action" | "build" | "personalize";

export type CreateHabitDraft = {
  identityPhrase: string;
  dailyAction: string;
  tinyAction: string;
  tinyActionTouched: boolean;
  cue: string;
  habitName: string;
  icon: string;
  activeDays: number[];
  reminderTime: string | null;
};

const EMPTY_DRAFT: CreateHabitDraft = {
  identityPhrase: "",
  dailyAction: "",
  tinyAction: "",
  tinyActionTouched: false,
  cue: "",
  habitName: "",
  icon: "",
  activeDays: [1, 2, 3, 4, 5, 6, 7],
  reminderTime: null,
};

const STEP_ORDER: Step[] = ["goal", "action", "build", "personalize"];

// ─── Main component ───────────────────────────────────────────────────────────

export default function CreateHabitFlow() {
  const theme = useTheme();
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      root: {
        flex: 1,
        backgroundColor: theme.colors.bg,
      },
    }),
  );

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

  // Debounce identity phrase for cap check (Path B only — Path A phrase is pre-set)
  const [debouncedPhrase, setDebouncedPhrase] = useState(draft.identityPhrase);
  useEffect(() => {
    if (goalMode === "existing") return;
    const t = setTimeout(() => setDebouncedPhrase(draft.identityPhrase), 300);
    return () => clearTimeout(t);
  }, [draft.identityPhrase, goalMode]);

  const capPhraseForQuery = goalMode === "existing" ? draft.identityPhrase : debouncedPhrase;
  const capCheckQuery = useQuery({
    queryKey: ["cap-check", user?.id ?? "", capPhraseForQuery.trim()],
    queryFn: () => assertCanCreateActiveHabit(user!.id, capPhraseForQuery.trim()),
    enabled: !!user?.id && capPhraseForQuery.trim().length >= 2,
  });
  const capWarning =
    capCheckQuery.data?.ok === false ? capCheckQuery.data : null;

  const entryOpacity = useRef(new Animated.Value(1)).current;
  const entryTranslate = useRef(new Animated.Value(0)).current;

  function update(patch: Partial<CreateHabitDraft>) {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      // Mirror only when this patch is a dailyAction-only change and the user
      // hasn't touched the tiny field. The `!("tinyAction" in patch)` guard
      // prevents a combined patch from clobbering a tiny value the same patch
      // is trying to set.
      if (
        "dailyAction" in patch &&
        !("tinyAction" in patch) &&
        !next.tinyActionTouched
      ) {
        next.tinyAction = next.dailyAction;
      }
      return next;
    });
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

  async function handleSave(mode: "active" | "backlog" = "active") {
    if (submitLockRef.current || createHabitMutation.isPending || !user?.id) return;
    setSaveError(null);
    submitLockRef.current = true;
    let hasSaved = false;

    try {
      const created = await createHabitMutation.mutateAsync({
        identityPhrase: normaliseBecomingPhrase(draft.identityPhrase),
        title: draft.habitName.trim(),
        cue: stripLeadingAfter(draft.cue),
        tinyAction: stripLeadingIWill(draft.tinyAction),
        minimumViableAction: "",
        preferredTimeWindow: "",
        icon: draft.icon.trim() || "Sparkles",
        activeDays: draft.activeDays,
        habitState: "active",
        status: mode,
      });
      hasSaved = true;

      if (draft.reminderTime) {
        if (mode === "backlog") {
          // Persist intent only — do NOT schedule OS notifications for a
          // habit the user has explicitly deferred.
          await persistReminderIntent(created.id, draft.reminderTime).catch(() => {});
        } else {
          await scheduleReminder(
            created.id,
            user.id,
            "daily",
            draft.reminderTime,
            draft.activeDays,
          ).catch(() => {});
        }
      }

      const todayDate = toDeviceDateString();
      const queryKey = getEligibleHabitsQueryKey(user.id, todayDate);
      await queryClient.invalidateQueries({ queryKey });
      await queryClient.fetchQuery({
        queryFn: () => listEligibleHabitsForToday(user.id, todayDate),
        queryKey,
      });
      if (mode === "backlog") {
        router.replace("/(app)/habits/backlog");
      } else {
        router.replace("/(app)/(tabs)/today");
      }
    } catch (error) {
      if (hasSaved) {
        logger.warn("Eligible habits refresh failed after successful create", { error });
        router.replace(
          mode === "backlog" ? "/(app)/habits/backlog" : "/(app)/(tabs)/today",
        );
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
    const canContinue = isValidIdentityPhraseDraft(draft.identityPhrase);
    stepContent = (
      <OnboardingLayout
        keyboardAware
        footer={
          <PrimaryButton
            disabled={!canContinue}
            label="Continue"
            showArrow
            onPress={() => {
              const fixed = normaliseBecomingPhrase(draft.identityPhrase);
              if (fixed !== draft.identityPhrase) update({ identityPhrase: fixed });
              advanceTo("action");
            }}
          />
        }
      >
        <BackRow onBack={handleBack} />
        <GoalStepContent draft={draft} update={update} capWarning={capWarning} />
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
        capWarning={capWarning}
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
        onSave={(mode) => void handleSave(mode)}
        isSaving={createHabitMutation.isPending}
        saveError={saveError}
        showChip={showChip}
        capWarning={capWarning}
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
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      backRow: {
        marginBottom: theme.spacing.lg,
      },
      backButton: {
        width: 36,
        height: 36,
        alignItems: "center",
        justifyContent: "center",
      },
    }),
  );
  const theme = useTheme();

  return (
    <View style={styles.backRow}>
      <Pressable onPress={onBack} style={styles.backButton} accessibilityLabel="Go back">
        <ChevronLeft color={theme.colors.textMuted} size={22} strokeWidth={1.75} />
      </Pressable>
    </View>
  );
}

// ─── Goal step content (rendered inside OnboardingLayout) ─────────────────────

function GoalStepContent({
  draft,
  update,
  capWarning,
}: {
  draft: CreateHabitDraft;
  update: (patch: Partial<CreateHabitDraft>) => void;
  capWarning: { count: number } | null;
}) {
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      headline: {
        fontFamily: theme.fontFamilies.displayBold,
        fontSize: 26,
        lineHeight: 32,
        color: theme.colors.text,
        marginBottom: theme.spacing.sm,
      },
      subline: {
        fontFamily: theme.fontFamilies.body,
        fontSize: 15,
        lineHeight: 23,
        color: theme.colors.textMuted,
        marginBottom: theme.spacing.xl,
      },
    }),
  );

  return (
    <>
      <Text style={styles.headline}>What kind of person do you want to become?</Text>
      <Text style={styles.subline}>This is the transformation your new habits will support.</Text>
      <OnboardingInput
        label="Become…"
        placeholder="a calmer person, healthier, someone who reads daily"
        value={draft.identityPhrase}
        onChangeText={(text) => update({ identityPhrase: text })}
        onBlur={() => {
          const fixed = normaliseBecomingPhrase(draft.identityPhrase);
          if (fixed !== draft.identityPhrase) update({ identityPhrase: fixed });
        }}
      />
      {capWarning ? <CapWarningCard count={capWarning.count} /> : null}
    </>
  );
}

// ─── Action step ──────────────────────────────────────────────────────────────

type ActionStepProps = {
  draft: CreateHabitDraft;
  update: (patch: Partial<CreateHabitDraft>) => void;
  onBack: () => void;
  onContinue: () => void;
  showChip: boolean;
  capWarning: { count: number } | null;
};

function ActionStep({ draft, update, onBack, onContinue, showChip, capWarning }: ActionStepProps) {
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      headline: {
        fontFamily: theme.fontFamilies.displayBold,
        fontSize: 26,
        lineHeight: 32,
        color: theme.colors.text,
        marginBottom: theme.spacing.sm,
      },
      subline: {
        fontFamily: theme.fontFamilies.body,
        fontSize: 15,
        lineHeight: 23,
        color: theme.colors.textMuted,
        marginBottom: theme.spacing.xl,
      },
    }),
  );

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
        label="Your action"
        placeholder="Goes for a walk, reads before bed..."
        value={draft.dailyAction}
        onChangeText={(text) => update({ dailyAction: text })}
      />
      {capWarning ? <CapWarningCard count={capWarning.count} /> : null}
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
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      headline: {
        fontFamily: theme.fontFamilies.displayBold,
        fontSize: 26,
        lineHeight: 32,
        color: theme.colors.text,
        marginBottom: theme.spacing.sm,
      },
      subline: {
        fontFamily: theme.fontFamilies.body,
        fontSize: 15,
        lineHeight: 23,
        color: theme.colors.textMuted,
        marginBottom: theme.spacing.xl,
      },
      readOnlyPill: {
        alignSelf: "flex-start",
        backgroundColor: theme.colors.primarySoft,
        borderRadius: theme.radius.pill,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.xs + 2,
        marginBottom: theme.spacing.lg,
        maxWidth: "90%",
      },
      readOnlyPillText: {
        fontFamily: theme.fontFamilies.bodySemi,
        fontSize: theme.typography.bodyMd,
        color: theme.colors.primary,
      },
      sectionGap: {
        marginBottom: theme.spacing.xl,
      },
      sectionLabel: {
        fontFamily: theme.fontFamilies.displaySemi,
        fontSize: theme.typography.titleMd,
        lineHeight: 21.3,
        color: theme.colors.text,
        marginBottom: theme.spacing.md,
      },
      formulaCard: {
        backgroundColor: theme.colors.primarySoft,
        borderRadius: theme.radius.md,
        marginTop: theme.spacing.md,
        padding: theme.spacing.xl,
      },
      formulaEyebrow: {
        fontFamily: theme.fontFamilies.bodyMedium,
        fontSize: theme.typography.micro,
        color: theme.colors.primary,
        textTransform: "uppercase",
        letterSpacing: 0.6,
        marginBottom: theme.spacing.sm,
      },
      activeDaysSection: {
        marginTop: theme.spacing.xl,
        marginBottom: theme.spacing.xl,
      },
      formulaText: {
        fontFamily: theme.fontFamilies.displaySemi,
        fontSize: 17,
        lineHeight: 25,
        color: theme.colors.primary,
      },
    }),
  );

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
          onChangeText={(text) => update({ tinyAction: text, tinyActionTouched: true })}
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
          <Text style={styles.formulaEyebrow}>Your habit</Text>
          <Text style={styles.formulaText}>{formulaPreview}</Text>
        </View>
      ) : null}

      <View style={styles.activeDaysSection}>
        <ActiveDaysPicker
          value={draft.activeDays}
          onChange={(days) => update({ activeDays: days })}
        />
      </View>
    </OnboardingLayout>
  );
}

// ─── Personalize step (two-phase: personalize + worst-day gate) ───────────────

type PersonalizeStepProps = {
  draft: CreateHabitDraft;
  update: (patch: Partial<CreateHabitDraft>) => void;
  onBack: () => void;
  onReturnToBuild: () => void;
  onSave: (mode: "active" | "backlog") => void;
  isSaving: boolean;
  saveError: string | null;
  showChip: boolean;
  capWarning: { count: number } | null;
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
  capWarning,
}: PersonalizeStepProps) {
  const theme = useTheme();
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      personalizeRoot: {
        flex: 1,
        backgroundColor: theme.colors.bg,
      },
      personalizeScroll: {
        flexGrow: 1,
        paddingHorizontal: theme.spacing.xl,
        paddingBottom: theme.spacing.xl,
      },
      personalizeFooter: {
        paddingHorizontal: theme.spacing.xl,
      },
      saveErrorWrap: {
        marginTop: theme.spacing.lg,
      },
      previewCard: {
        backgroundColor: theme.colors.surfaceCard,
        borderRadius: theme.radius.lg,
        padding: theme.spacing.xl,
        boxShadow: theme.shadows.cardFloat,
        gap: theme.spacing.md,
        marginBottom: theme.spacing.sm,
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
        backgroundColor: theme.colors.primarySoft,
        alignItems: "center",
        justifyContent: "center",
      },
      nameContainer: {
        flex: 1,
      },
      nameHint: {
        fontFamily: theme.fontFamilies.body,
        fontSize: theme.typography.micro,
        color: theme.colors.textFaint,
        marginBottom: 2,
      },
      nameInput: {
        fontFamily: theme.fontFamilies.displaySemi,
        fontSize: theme.typography.titleSm,
        color: theme.colors.text,
        padding: 0,
      },
      nameLocked: {
        fontFamily: theme.fontFamilies.displaySemi,
        fontSize: theme.typography.titleSm,
        color: theme.colors.text,
      },
      pickerContainer: {
        marginTop: 4,
      },
      formulaPreview: {
        fontFamily: theme.fontFamilies.body,
        fontSize: theme.typography.bodyMd,
        lineHeight: 19.5,
        color: theme.colors.textMuted,
      },
      goalBadge: {
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 6,
        backgroundColor: theme.colors.primarySoft,
        borderRadius: theme.radius.pill,
        paddingHorizontal: 12,
        paddingVertical: 6,
      },
      goalBadgeText: {
        fontFamily: theme.fontFamilies.bodySemi,
        fontSize: theme.typography.labelMd,
        color: theme.colors.primary,
      },
      micro: {
        fontFamily: theme.fontFamilies.body,
        fontSize: theme.typography.labelMd,
        color: theme.colors.textFaint,
        marginTop: 4,
        marginBottom: theme.spacing.xl,
      },
      optionalFields: {
        gap: theme.spacing.xl,
        marginTop: theme.spacing.lg,
      },
      gateContainer: {
        marginTop: theme.spacing.xxl,
        gap: theme.spacing.md,
        paddingBottom: theme.spacing.xl,
      },
      gateHeadline: {
        fontFamily: theme.fontFamilies.displayBold,
        fontSize: 26,
        lineHeight: 31,
        color: theme.colors.text,
      },
      gateQuestion: {
        fontFamily: theme.fontFamilies.displaySemi,
        fontSize: theme.typography.titleLg,
        lineHeight: 25.2,
        color: theme.colors.text,
      },
      gateActionBold: {
        fontFamily: theme.fontFamilies.displayBold,
        color: theme.colors.primary,
      },
      gateBody: {
        fontFamily: theme.fontFamilies.body,
        fontSize: 15,
        lineHeight: 23,
        color: theme.colors.textMuted,
      },
      gateFooter: {
        gap: theme.spacing.md,
      },
      headline: {
        fontFamily: theme.fontFamilies.displayBold,
        fontSize: 26,
        lineHeight: 32,
        color: theme.colors.text,
        marginBottom: theme.spacing.sm,
      },
      subline: {
        fontFamily: theme.fontFamilies.body,
        fontSize: 15,
        lineHeight: 23,
        color: theme.colors.textMuted,
        marginBottom: theme.spacing.xl,
      },
    }),
  );

  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<PersonalizePhase>("personalize");
  const [showPicker, setShowPicker] = useState(false);
  const [iconTapped, setIconTapped] = useState(false);

  const phase2Opacity = useRef(new Animated.Value(0)).current;
  const phase2Translate = useRef(new Animated.Value(16)).current;
  const iconScale = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView>(null);

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
      Animated.timing(iconScale, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    }
    setShowPicker((v) => !v);
  };

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
    ) : capWarning ? (
      <View style={styles.gateFooter}>
        <PrimaryButton
          disabled={isSaving}
          label={isSaving ? "Saving..." : "Add to Today"}
          showArrow
          onPress={() => onSave("active")}
        />
        <SecondaryButton
          disabled={isSaving}
          label="Save for later"
          onPress={() => onSave("backlog")}
        />
        <TertiaryButton
          label="Let me make it smaller"
          onPress={onReturnToBuild}
        />
      </View>
    ) : (
      <View style={styles.gateFooter}>
        <PrimaryButton
          disabled={isSaving}
          label={isSaving ? "Saving..." : "Yes, I could"}
          showArrow
          onPress={() => onSave("active")}
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
          { paddingTop: insets.top + theme.spacing.lg },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {phase === "personalize" ? <BackRow onBack={onBack} /> : null}

        {phase === "personalize" ? (
          <>
            <Text style={styles.headline}>Personalize your habit.</Text>
            <Text style={styles.subline}>Give it a name and an icon to make it yours.</Text>
          </>
        ) : null}

        {/* Preview card */}
        <View style={[styles.previewCard, phase === "worstday" && styles.previewCardLocked]}>
          <View style={styles.cardHeader}>
            <Animated.View style={{ transform: [{ scale: iconScale }] }}>
              <Pressable
                disabled={phase === "worstday"}
                onPress={handleIconPress}
                style={styles.iconButton}
              >
                <LucideIcon
                  name={draft.icon || "Sparkles"}
                  size={22}
                  color={draft.icon ? theme.colors.primary : theme.colors.textFaint}
                  strokeWidth={1.8}
                />
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
              <LucideIcon name="Target" size={13} color={theme.colors.primary} strokeWidth={2} />
              <Text style={styles.goalBadgeText}>Becoming {draft.identityPhrase.trim()}</Text>
            </View>
          ) : null}
        </View>

        {phase === "personalize" ? (
          <Text style={styles.micro}>You can rename or change the icon anytime.</Text>
        ) : null}

        {phase === "personalize" ? (
          <ReminderPicker
            value={draft.reminderTime}
            onChange={(t) => update({ reminderTime: t })}
          />
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
          {capWarning ? <CapWarningCard count={capWarning.count} /> : null}
        </Animated.View>

        {saveError ? (
          <View style={styles.saveErrorWrap}>
            <ErrorState message={saveError} />
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.personalizeFooter, { paddingBottom: Math.max(insets.bottom + theme.spacing.lg, theme.spacing.xxxl) }]}>
        {footer}
      </View>
    </View>
  );
}
