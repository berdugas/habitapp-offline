import { Target } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/useTheme";
import { useThemedStyles } from "@/theme/useThemedStyles";

import type { Theme } from "@/theme/contract";

type GoalContextChipProps = {
  identityPhrase: string;
};

function buildStyles(theme: Theme) {
  return StyleSheet.create({
    chip: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: theme.spacing.xs,
      alignSelf: "flex-start" as const,
      backgroundColor: theme.colors.primarySoft,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      marginBottom: theme.spacing.lg,
    },
    text: {
      fontFamily: theme.fontFamilies.body,
      fontSize: theme.typography.labelMd,
      color: theme.colors.primary,
    },
    bold: {
      fontFamily: theme.fontFamilies.bodySemi,
      color: theme.colors.primary,
    },
  });
}

export function GoalContextChip({ identityPhrase }: GoalContextChipProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(buildStyles);

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
