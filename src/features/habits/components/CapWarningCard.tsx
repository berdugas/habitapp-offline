import { StyleSheet, Text, View } from "react-native";
import { AlertTriangle } from "lucide-react-native";

import { useThemedStyles } from "@/theme/useThemedStyles";

type CapWarningCardProps = {
  count: number;
};

export function CapWarningCard({ count }: CapWarningCardProps) {
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      capWarning: {
        alignItems: "flex-start",
        backgroundColor: "#fef3c7",
        borderRadius: theme.radius.md,
        flexDirection: "row",
        gap: theme.spacing.sm,
        marginTop: theme.spacing.lg,
        padding: theme.spacing.md,
      },
      capWarningText: {
        color: "#92400e",
        flex: 1,
        fontFamily: theme.fontFamilies.body,
        fontSize: theme.typography.labelMd,
        lineHeight: 19,
      },
    }),
  );

  return (
    <View style={styles.capWarning}>
      <AlertTriangle color="#b45309" size={16} strokeWidth={1.75} />
      <Text style={styles.capWarningText}>
        You have {count} active habit{count !== 1 ? "s" : ""} for this goal. Research suggests
        focusing on 3 or fewer for sustainable change. You can still add this one.
      </Text>
    </View>
  );
}
