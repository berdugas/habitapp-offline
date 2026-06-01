import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/useTheme";
import { useThemedStyles } from "@/theme/useThemedStyles";

export function ThemePickerOverlay() {
  const theme = useTheme();
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      overlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "center",
        backgroundColor: "rgba(0,0,0,0.4)",
        gap: t.spacing.md,
        justifyContent: "center",
      },
      label: {
        color: "#FFFFFF",
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyLg,
      },
    }),
  );

  return (
    <View style={styles.overlay}>
      <ActivityIndicator color={theme.colors.primary} size="large" />
      <Text style={styles.label}>Downloading fonts…</Text>
    </View>
  );
}
