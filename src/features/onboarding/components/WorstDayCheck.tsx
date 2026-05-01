import { StyleSheet } from "react-native";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { ZenCard } from "@/components/cards/ZenCard";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import { Text, View } from "react-native";

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
    <ZenCard gap={spacing.xxl} padding="xxl">
      <Text selectable style={styles.question}>
        {question}
      </Text>
      <View style={styles.actions}>
        <PrimaryButton label={passLabel} onPress={onPass} />
        <SecondaryButton label={failLabel} onPress={onFail} />
      </View>
    </ZenCard>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.md,
  },
  question: {
    color: colors.text,
    fontFamily: fontFamilies.displaySemi,
    fontSize: typography.headlineMd,
    lineHeight: 30,
  },
});
