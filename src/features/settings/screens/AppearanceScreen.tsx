import { useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { Check } from "lucide-react-native";

import { useThemeContext } from "@/theme/ThemeProvider";
import { useThemedStyles } from "@/theme/useThemedStyles";
import { THEMES } from "@/theme/registry";
import { trackEvent } from "@/services/analytics";

import type { Theme } from "@/theme/contract";

export default function AppearanceScreen() {
  const { theme: active } = useThemeContext();

  useEffect(() => {
    trackEvent("settings_appearance_opened");
  }, []);

  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      screen: { flex: 1, backgroundColor: t.colors.bg },
      content: { padding: t.spacing.xl, gap: t.spacing.lg },
      footer: {
        color: t.colors.textMuted,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyMd,
        paddingTop: t.spacing.lg,
        textAlign: "center",
      },
    }),
  );

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
    >
      {(Object.values(THEMES) as Theme[]).map((t) => (
        <ThemeCard key={t.id} theme={t} isActive={t.id === active.id} />
      ))}
      <Text style={styles.footer}>
        Non-default themes need internet to download fonts the first time
        they're used. After that, they work offline.
      </Text>
    </ScrollView>
  );
}

function ThemeCard({ theme, isActive }: { theme: Theme; isActive: boolean }) {
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      card: {
        backgroundColor: t.colors.surfaceCard,
        borderColor: isActive ? t.colors.primary : "transparent",
        borderRadius: t.radius.md,
        borderWidth: 2,
        gap: t.spacing.md,
        padding: t.spacing.lg,
      },
      preview: { borderRadius: t.radius.sm, overflow: "hidden" },
      row: { alignItems: "center", flexDirection: "row", gap: t.spacing.lg },
      swatches: { flexDirection: "row", gap: 4 },
      swatch: { borderRadius: 6, height: 12, width: 12 },
      label: {
        color: t.colors.text,
        flex: 1,
        fontFamily: t.fontFamilies.displaySemi,
        fontSize: t.typography.titleLg,
      },
    }),
  );

  return (
    <Pressable
      accessibilityHint={
        theme.fontAssets.kind === "remote"
          ? `Applies the ${theme.name} theme. May need to download fonts.`
          : `Applies the ${theme.name} theme.`
      }
      accessibilityRole="radio"
      accessibilityState={{ selected: isActive }}
      style={styles.card}
    >
      <View style={styles.preview}>
        <SvgXml height={80} width="100%" xml={theme.previewSvg} />
      </View>
      <View style={styles.row}>
        <View style={styles.swatches}>
          <View style={[styles.swatch, { backgroundColor: theme.colors.primary }]} />
          <View style={[styles.swatch, { backgroundColor: theme.colors.surfaceHigh }]} />
          <View style={[styles.swatch, { backgroundColor: theme.colors.graduatedBadge }]} />
        </View>
        <Text style={styles.label}>{theme.name}</Text>
        {isActive ? (
          <Check
            color={theme.colors.primary}
            size={20}
            strokeWidth={2.5}
            testID={`active-checkmark-${theme.id}`}
          />
        ) : null}
      </View>
    </Pressable>
  );
}
