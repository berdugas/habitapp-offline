import { StyleSheet, Switch, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

type ToggleRowProps = {
  description?: string;
  label: string;
  onValueChange: (value: boolean) => void;
  value: boolean;
};

export function ToggleRow({
  description,
  label,
  onValueChange,
  value,
}: ToggleRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text selectable style={styles.label}>
          {label}
        </Text>
        {description ? (
          <Text selectable style={styles.description}>
            {description}
          </Text>
        ) : null}
      </View>
      <Switch onValueChange={onValueChange} value={value} />
    </View>
  );
}

const styles = StyleSheet.create({
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
  description: {
    color: colors.textMuted,
    fontSize: typography.labelMd,
  },
  label: {
    color: colors.text,
    fontSize: typography.bodyLg,
    fontWeight: "600",
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
  },
});
