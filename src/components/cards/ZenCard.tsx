import { StyleSheet, View, ViewProps } from "react-native";

import { colors } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { shadows } from "@/theme/shadows";
import { spacing } from "@/theme/spacing";

type ZenCardProps = {
  children: React.ReactNode;
  gap?: number;
  padding?: "xl" | "xxl";
  style?: ViewProps["style"];
};

export function ZenCard({
  children,
  gap = spacing.xl,
  padding = "xl",
  style,
}: ZenCardProps) {
  const paddingValue = padding === "xxl" ? spacing.xxl : spacing.xl;

  return (
    <View style={[styles.card, { padding: paddingValue, gap }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    boxShadow: shadows.card,
  },
});
