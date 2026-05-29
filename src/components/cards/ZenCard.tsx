import { StyleSheet, View, ViewProps } from "react-native";

import { useTheme } from "@/theme/useTheme";
import { useThemedStyles } from "@/theme/useThemedStyles";

type ZenCardProps = {
  children: React.ReactNode;
  gap?: number;
  padding?: "xl" | "xxl";
  style?: ViewProps["style"];
};

export function ZenCard({
  children,
  gap,
  padding = "xl",
  style,
}: ZenCardProps) {
  const theme = useTheme();
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      card: {
        backgroundColor: t.colors.surfaceCard,
        borderRadius: t.radius.md,
        boxShadow: t.shadows.card,
      },
    }),
  );

  const resolvedGap = gap ?? theme.spacing.xl;
  const paddingValue = padding === "xxl" ? theme.spacing.xxl : theme.spacing.xl;

  return (
    <View style={[styles.card, { padding: paddingValue, gap: resolvedGap }, style]}>
      {children}
    </View>
  );
}
