import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { ZenCard } from "@/components/cards/ZenCard";
import { Eyebrow } from "@/components/text/Eyebrow";
import { useExportData } from "@/features/settings/hooks";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { SCREEN_TOP_PADDING, spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

export default function ExportScreen() {
  const insets = useSafeAreaInsets();
  const exportMutation = useExportData();

  const buttonLabel = exportMutation.isPending
    ? "Building export..."
    : "Export Data";

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + SCREEN_TOP_PADDING },
        ]}
        style={styles.scroll}
      >
        <View style={styles.headerRow}>
          <Pressable
            accessibilityLabel="Go back"
            hitSlop={12}
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <ChevronLeft color={colors.textMuted} size={22} strokeWidth={1.75} />
          </Pressable>
          <Text style={styles.title}>Export Your Data</Text>
        </View>

        <ZenCard>
          <Eyebrow label="What's included" />
          <Text style={styles.body}>
            Your export includes everything stored on this device: habits,
            daily logs, weekly reviews, graduation responses, reminder
            settings, and preferences.
          </Text>
          <Text style={styles.note}>
            The file is JSON format — readable by any text editor or data
            tool.
          </Text>
        </ZenCard>

        <ZenCard>
          <Eyebrow label="Privacy" />
          <Text style={styles.body}>
            The export is created on your device. Nothing is uploaded to any
            server. You choose where to save it.
          </Text>
        </ZenCard>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.xl }]}>
        {exportMutation.isError ? (
          <Text style={styles.errorText}>
            Something went wrong. Please try again.
          </Text>
        ) : null}
        <PrimaryButton
          disabled={exportMutation.isPending}
          label={buttonLabel}
          onPress={() => exportMutation.mutate()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  body: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    lineHeight: 22,
  },
  content: {
    flexGrow: 1,
    gap: spacing.lg,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  errorText: {
    color: colors.danger,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  footer: {
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  note: {
    color: colors.textFaint,
    fontFamily: fontFamilies.body,
    fontSize: typography.micro,
    lineHeight: 18,
  },
  screen: {
    backgroundColor: colors.bg,
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontFamily: fontFamilies.displayBold,
    fontSize: typography.headlineLg,
  },
});
