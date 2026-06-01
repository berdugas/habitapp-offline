import { Pressable, StyleSheet, Text, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { Check } from "lucide-react-native";

import { useThemedStyles } from "@/theme/useThemedStyles";

import type { Theme } from "@/theme/contract";

type ThemeCardProps = {
  theme: Theme;
  isActive: boolean;
  isFontReady: boolean;
  /**
   * If provided AND the theme is not already cached on disk (i.e. !isFontReady),
   * render a small caption with the download size under the swatches. Settings
   * omits this; Onboarding passes the computed total bytes.
   */
  downloadSizeBytes?: number | null;
  onPress: () => void;
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) {
    const kb = Math.round(bytes / 1024 / 100) * 100;
    return `${kb} KB`;
  }
  const mb = Math.round((bytes / (1024 * 1024)) * 10) / 10;
  return `${mb} MB`;
}

export function ThemeCard({
  theme,
  isActive,
  isFontReady,
  downloadSizeBytes,
  onPress,
}: ThemeCardProps) {
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
        fontFamily: isFontReady ? theme.fontFamilies.displaySemi : t.fontFamilies.displaySemi,
        fontSize: t.typography.titleLg,
      },
      downloadCaption: {
        color: t.colors.textFaint,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.micro,
        marginTop: 4,
      },
    }),
  );

  const showDownloadCaption =
    downloadSizeBytes != null && downloadSizeBytes > 0 && !isFontReady;

  return (
    <Pressable
      accessibilityHint={
        theme.fontAssets.kind === "remote"
          ? `Applies the ${theme.name} theme. May need to download fonts.`
          : `Applies the ${theme.name} theme.`
      }
      accessibilityRole="radio"
      accessibilityState={{ selected: isActive }}
      onPress={onPress}
      style={styles.card}
      testID={`theme-card-${theme.id}`}
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
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>{theme.name}</Text>
          {showDownloadCaption ? (
            <Text style={styles.downloadCaption}>
              {formatBytes(downloadSizeBytes!)} · first time
            </Text>
          ) : null}
        </View>
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
