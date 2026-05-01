import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

type RowLVProps = {
  label: string;
  value: string;
};

export function RowLV({ label, value }: RowLVProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.textMuted,
    fontFamily: fontFamilies.bodyBold,
    fontSize: typography.micro,
    letterSpacing: 1,
  },
  row: {
    gap: spacing.xs,
  },
  value: {
    color: colors.text,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyLg,
  },
});
