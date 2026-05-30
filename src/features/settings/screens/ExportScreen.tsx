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
import { useTheme } from "@/theme/useTheme";
import { useThemedStyles } from "@/theme/useThemedStyles";

export default function ExportScreen() {
  const insets = useSafeAreaInsets();
  const exportMutation = useExportData();
  const theme = useTheme();
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      backButton: {
        alignItems: "center",
        height: 36,
        justifyContent: "center",
        width: 36,
      },
      body: {
        color: t.colors.textMuted,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyMd,
        lineHeight: 20.4,
      },
      content: {
        flexGrow: 1,
        gap: t.spacing.lg,
        padding: t.spacing.xl,
        paddingBottom: t.spacing.xxl,
      },
      errorText: {
        color: t.colors.danger,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyMd,
        marginBottom: t.spacing.md,
        textAlign: "center",
      },
      footer: {
        backgroundColor: t.colors.bg,
        paddingHorizontal: t.spacing.xl,
        paddingTop: t.spacing.md,
      },
      headerRow: {
        alignItems: "center",
        flexDirection: "row",
        gap: t.spacing.sm,
      },
      note: {
        color: t.colors.textFaint,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.micro,
        lineHeight: 18,
      },
      screen: {
        backgroundColor: t.colors.bg,
        flex: 1,
      },
      scroll: {
        flex: 1,
      },
      title: {
        color: t.colors.text,
        fontFamily: t.fontFamilies.displayBold,
        fontSize: t.typography.headlineLg,
      },
    }),
  );

  const buttonLabel = exportMutation.isPending
    ? "Building export..."
    : "Export Data";

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + theme.spacing.lg },
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
            <ChevronLeft color={theme.colors.textMuted} size={22} strokeWidth={1.75} />
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

      <View style={[styles.footer, { paddingBottom: insets.bottom + theme.spacing.xl }]}>
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
