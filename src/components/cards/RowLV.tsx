import { StyleSheet, Text, View } from "react-native";

import { useThemedStyles } from "@/theme/useThemedStyles";

type RowLVProps = {
  label: string;
  value: string;
};

export function RowLV({ label, value }: RowLVProps) {
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      label: {
        color: theme.colors.textMuted,
        fontFamily: theme.fontFamilies.bodyBold,
        fontSize: theme.typography.micro,
        letterSpacing: 1,
      },
      row: {
        gap: theme.spacing.xs,
      },
      value: {
        color: theme.colors.text,
        fontFamily: theme.fontFamilies.body,
        fontSize: theme.typography.bodyLg,
      },
    }),
  );

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}
