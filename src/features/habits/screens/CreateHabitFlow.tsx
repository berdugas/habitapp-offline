import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { GoalContextChip } from "@/components/GoalContextChip";
import { OnboardingInput } from "@/components/forms/OnboardingInput";
import { OnboardingLayout } from "@/components/layouts/OnboardingLayout";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { formatHabitFormula } from "@/features/habits/formatters";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { radius } from "@/theme/radius";
import { shadows } from "@/theme/shadows";
import { spacing } from "@/theme/spacing";

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

  const [step, setStep] = useState<Step>(initialStep);
  const [draft, setDraft] = useState<CreateHabitDraft>({
    ...EMPTY_DRAFT,
    identityPhrase: inheritedPhrase ?? "",
  });
  const [focusTinyActionOnBuild, setFocusTinyActionOnBuild] = useState(false);

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
      <PersonalizeStepShell
        onBack={handleBack}
        onReturnToBuild={handleReturnToBuild}
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

// ─── Shared sub-components ──────────────────────────────────────────��─────────

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

      {/* Section 1: Shrink */}
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

      {/* Section 2: Cue */}
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

// ─── Personalize step shell (S12-04 replaces this) ────────────────────────────

function PersonalizeStepShell({
  onBack,
  onReturnToBuild: _onReturnToBuild,
}: {
  onBack: () => void;
  onReturnToBuild: () => void;
}) {
  return (
    <OnboardingLayout
      footer={
        <PrimaryButton
          disabled
          label="Looks good"
          onPress={() => {}}
        />
      }
    >
      <BackRow onBack={onBack} />
      <Text style={styles.headline}>Personalize your habit.</Text>
      <Text style={styles.subline}>(S12-04 wires this step.)</Text>
    </OnboardingLayout>
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
});
