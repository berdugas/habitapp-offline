import { StyleSheet, Text } from "react-native";

import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { typography } from "@/theme/typography";

type EyebrowProps = {
  label: string;
  tone?: "default" | "primary" | "danger";
};

export function Eyebrow({ label, tone = "default" }: EyebrowProps) {
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

const styles = StyleSheet.create({
  label: {
    color: colors.textMuted,
    fontFamily: fontFamilies.bodyBold,
    fontSize: typography.micro,
    letterSpacing: 1,
  },
  labelPrimary: {
    color: colors.primary,
  },
  labelDanger: {
    color: colors.danger,
  },
});
