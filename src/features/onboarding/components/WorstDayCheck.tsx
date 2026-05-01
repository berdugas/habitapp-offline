import { StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { colors } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { shadows } from "@/theme/shadows";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

const DEFAULT_QUESTION =
  "If today were your worst day — sick, exhausted, stressed — could you still do this?";

type WorstDayCheckProps = {
  onPass: () => void;
  onFail: () => void;
  passLabel?: string;
  failLabel?: string;
  question?: string;
};

export function WorstDayCheck({
  onPass,
  onFail,
  passLabel = "Yes, I could",
  failLabel = "Probably not",
  question = DEFAULT_QUESTION,
}: WorstDayCheckProps) {
  return (
    <View style={styles.card}>
      <Text selectable style={styles.question}>
        {question}
      </Text>
      <View style={styles.actions}>
        <PrimaryButton label={passLabel} onPress={onPass} />
        <SecondaryButton label={failLabel} onPress={onFail} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: 'transparent',
    borderRadius: radius.lg,
    borderWidth: 1,
    boxShadow: shadows.card,
    gap: spacing.xxl,
    padding: spacing.xxl,
  },
  question: {
    color: colors.text,
    fontSize: typography.headlineMd,
    fontWeight: "700",
    lineHeight: 30,
  },
});
