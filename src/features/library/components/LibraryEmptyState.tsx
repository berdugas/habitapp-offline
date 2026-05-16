import { StyleSheet, Text, View } from "react-native";
import { BookOpen } from "lucide-react-native";

import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

export function LibraryEmptyState() {
  return (
    <View style={styles.root}>
      <BookOpen color={colors.textFaint} size={48} strokeWidth={1.25} />
      <Text style={styles.title}>Library</Text>
      <Text style={styles.body}>
        Your library will grow as habits become part of who you are. The first
        one usually takes 60–90 days. Stay with it.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyLg,
    lineHeight: 24,
    textAlign: "center",
  },
  root: {
    alignItems: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  title: {
    color: colors.text,
    fontFamily: fontFamilies.displayBold,
    fontSize: typography.headlineLg,
  },
});
