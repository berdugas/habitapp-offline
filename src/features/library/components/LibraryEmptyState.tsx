import { StyleSheet, Text, View } from "react-native";
import { BookOpen } from "lucide-react-native";

import { useTheme } from "@/theme/useTheme";
import { useThemedStyles } from "@/theme/useThemedStyles";

export function LibraryEmptyState() {
  const theme = useTheme();
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      body: {
        color: t.colors.textMuted,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyLg,
        lineHeight: 21,
        textAlign: "center",
      },
      root: {
        alignItems: "center",
        gap: t.spacing.lg,
        paddingHorizontal: t.spacing.xl,
      },
      title: {
        color: t.colors.text,
        fontFamily: t.fontFamilies.displayBold,
        fontSize: t.typography.headlineLg,
      },
    }),
  );

  return (
    <View style={styles.root}>
      <BookOpen color={theme.colors.textFaint} size={48} strokeWidth={1.25} />
      <Text style={styles.title}>Library</Text>
      <Text style={styles.body}>
        Your library will grow as habits become part of who you are. The first
        one usually takes 60–90 days. Stay with it.
      </Text>
    </View>
  );
}
