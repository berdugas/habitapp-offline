import { StyleSheet, Text } from "react-native";

import { useThemedStyles } from "@/theme/useThemedStyles";

type EyebrowProps = {
  label: string;
  tone?: "default" | "primary" | "danger";
};

export function Eyebrow({ label, tone = "default" }: EyebrowProps) {
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      label: {
        color: theme.colors.textMuted,
        fontFamily: theme.fontFamilies.bodyBold,
        fontSize: theme.typography.micro,
        letterSpacing: 1,
      },
      labelPrimary: {
        color: theme.colors.primary,
      },
      labelDanger: {
        color: theme.colors.danger,
      },
    }),
  );

  return (
    <Text
      style={[
        styles.label,
        tone === "primary" && styles.labelPrimary,
        tone === "danger" && styles.labelDanger,
      ]}
    >
      {label.toUpperCase()}
    </Text>
  );
}
