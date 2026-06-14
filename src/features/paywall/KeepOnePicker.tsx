import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { useThemedStyles } from "@/theme/useThemedStyles";
import { paywallCopy } from "@/features/paywall/copy";

type PickerHabit = { id: string; title: string; identity_phrase: string | null; status: string };

type Props = {
  habits: PickerHabit[];
  isSubmitting: boolean;
  onConfirm: (keptHabitId: string | null) => void;
  onCancel: () => void;
};

const KEEP_NONE = Symbol("keep-none");

export function KeepOnePicker({ habits, isSubmitting, onConfirm, onCancel }: Props) {
  const [selection, setSelection] = useState<string | typeof KEEP_NONE | null>(null);
  const [step, setStep] = useState<"pick" | "confirm">("pick");
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      screen: { flex: 1, gap: t.spacing.lg, padding: t.spacing.xl },
      title: { color: t.colors.text, fontFamily: t.fontFamilies.displaySemi, fontSize: t.typography.headlineMd },
      body: { color: t.colors.textMuted, fontFamily: t.fontFamilies.body, fontSize: t.typography.bodyLg, lineHeight: 24 },
      option: { backgroundColor: t.colors.surface, borderRadius: t.radius.md, borderWidth: 1, borderColor: t.colors.offDayBorder, padding: t.spacing.lg },
      optionSelected: { borderColor: t.colors.primary },
      optionLabel: { color: t.colors.text, fontFamily: t.fontFamilies.bodySemi, fontSize: t.typography.bodyLg },
      list: { gap: t.spacing.sm },
    }),
  );

  function isSelected(value: string | typeof KEEP_NONE) {
    return selection === value;
  }

  if (step === "confirm") {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>{paywallCopy.pickerConfirmTitle}</Text>
        <Text style={styles.body}>{paywallCopy.pickerConfirmBody}</Text>
        <PrimaryButton
          disabled={isSubmitting}
          label={isSubmitting ? "Archiving…" : paywallCopy.pickerConfirmYes}
          onPress={() => onConfirm(selection === KEEP_NONE ? null : (selection as string))}
        />
        <SecondaryButton
          disabled={isSubmitting}
          label={paywallCopy.pickerConfirmBack}
          onPress={() => setStep("pick")}
        />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.title}>{paywallCopy.pickerTitle}</Text>
      <View style={styles.list}>
        {habits.map((h) => (
          <Pressable
            key={h.id}
            accessibilityRole="button"
            onPress={() => setSelection(h.id)}
            style={[styles.option, isSelected(h.id) && styles.optionSelected]}
          >
            <Text style={styles.optionLabel}>{h.title}</Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={() => setSelection(KEEP_NONE)}
          style={[styles.option, isSelected(KEEP_NONE) && styles.optionSelected]}
        >
          <Text style={styles.optionLabel}>{paywallCopy.pickerKeepNone}</Text>
        </Pressable>
      </View>
      <PrimaryButton disabled={selection === null} label="Continue" onPress={() => setStep("confirm")} />
      <SecondaryButton label={paywallCopy.pickerConfirmBack} onPress={onCancel} />
    </ScrollView>
  );
}
