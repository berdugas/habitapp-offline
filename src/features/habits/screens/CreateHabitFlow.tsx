import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

import { GoalContextChip } from "@/components/GoalContextChip";
import { OnboardingInput } from "@/components/forms/OnboardingInput";
import { OnboardingLayout } from "@/components/layouts/OnboardingLayout";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "goal" | "action" | "build" | "personalize";

type CreateHabitDraft = {
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

// ─── Component ────────────────────────���───────────────────────────────���───────

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

  function handleContinueGoal() {
    advanceTo("action");
  }

  // ─── Rendered steps ─────────────────────────────────────────────────────────

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
            onPress={handleContinueGoal}
          />
        }
      >
        <View style={styles.backRow}>
          <Pressable onPress={handleBack} style={styles.backButton} accessibilityLabel="Go back">
            <ArrowLeft color={colors.textMuted} size={20} strokeWidth={1.75} />
          </Pressable>
        </View>
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
    stepContent = <ActionStepShell draft={draft} update={update} onBack={handleBack} onContinue={() => advanceTo("build")} showChip={showChip} />;
  } else if (step === "build") {
    stepContent = <BuildStepShell draft={draft} update={update} onBack={handleBack} onContinue={() => advanceTo("personalize")} showChip={showChip} />;
  } else {
    stepContent = <PersonalizeStepShell onBack={handleBack} />;
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

// ─── Step shells (S12-03 / S12-04 will replace these) ─────────────────────────

type StepProps = {
  draft: CreateHabitDraft;
  update: (patch: Partial<CreateHabitDraft>) => void;
  onBack: () => void;
  onContinue: () => void;
  showChip: boolean;
};

function ActionStepShell({ draft, update, onBack, onContinue, showChip }: StepProps) {
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
      <View style={styles.backRow}>
        <Pressable onPress={onBack} style={styles.backButton} accessibilityLabel="Go back">
          <ArrowLeft color={colors.textMuted} size={20} strokeWidth={1.75} />
        </Pressable>
      </View>
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

function BuildStepShell({ draft, onBack, onContinue, showChip }: StepProps) {
  const canContinue =
    draft.tinyAction.trim().length >= 2 && draft.cue.trim().length >= 2;
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
      <View style={styles.backRow}>
        <Pressable onPress={onBack} style={styles.backButton} accessibilityLabel="Go back">
          <ArrowLeft color={colors.textMuted} size={20} strokeWidth={1.75} />
        </Pressable>
      </View>
      {showChip ? <GoalContextChip identityPhrase={draft.identityPhrase} /> : null}
      <Text style={styles.headline}>Build the habit.</Text>
      <Text style={styles.subline}>Make it tiny and attach a trigger. (S12-03 wires this step.)</Text>
    </OnboardingLayout>
  );
}

function PersonalizeStepShell({ onBack }: { onBack: () => void }) {
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
      <View style={styles.backRow}>
        <Pressable onPress={onBack} style={styles.backButton} accessibilityLabel="Go back">
          <ArrowLeft color={colors.textMuted} size={20} strokeWidth={1.75} />
        </Pressable>
      </View>
      <Text style={styles.headline}>Personalize your habit.</Text>
      <Text style={styles.subline}>(S12-04 wires this step.)</Text>
    </OnboardingLayout>
  );
}

// ─── Styles ─────────────────────────────────��─────────────────────────────���───

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
});
