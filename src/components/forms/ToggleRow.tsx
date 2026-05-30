import { StyleSheet, Switch, Text, View } from "react-native";

import { useThemedStyles } from "@/theme/useThemedStyles";

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
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      copy: {
        flex: 1,
        gap: theme.spacing.xs,
      },
      description: {
        color: theme.colors.textMuted,
        fontSize: theme.typography.labelMd,
      },
      label: {
        color: theme.colors.text,
        fontSize: theme.typography.bodyLg,
        fontWeight: "600",
      },
      row: {
        alignItems: "center",
        flexDirection: "row",
        gap: theme.spacing.md,
        justifyContent: "space-between",
      },
    }),
  );

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
