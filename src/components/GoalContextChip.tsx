import { Target } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";

type GoalContextChipProps = {
  identityPhrase: string;
};

export function GoalContextChip({ identityPhrase }: GoalContextChipProps) {
  return (
    <View style={styles.chip}>
      <Target color={colors.primary} size={14} strokeWidth={2} />
      <Text style={styles.text}>
        Building toward:{" "}
        <Text style={styles.bold}>{identityPhrase}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.lg,
  },
  text: {
    fontFamily: fontFamilies.body,
    fontSize: 13,
    color: colors.primary,
  },
  bold: {
    fontFamily: fontFamilies.bodySemi,
    color: colors.primary,
  },
});
