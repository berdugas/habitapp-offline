import { StyleSheet, Text, View } from "react-native";
import { AlertTriangle } from "lucide-react-native";

import { fontFamilies } from "@/theme/fontFamilies";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";

type CapWarningCardProps = {
  count: number;
};

export function CapWarningCard({ count }: CapWarningCardProps) {
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

const styles = StyleSheet.create({
  capWarning: {
    alignItems: "flex-start",
    backgroundColor: "#fef3c7",
    borderRadius: radius.md,
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  capWarningText: {
    color: "#92400e",
    flex: 1,
    fontFamily: fontFamilies.body,
    fontSize: 13,
    lineHeight: 19,
  },
});
