import { Pressable, StyleSheet, Text, View } from "react-native";
import { X } from "lucide-react-native";

import { useTheme } from "@/theme/useTheme";
import { useThemedStyles } from "@/theme/useThemedStyles";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { paywallCopy } from "@/features/paywall/copy";
import { useTrialBadge } from "@/features/paywall/useTrialBadge";
import { useTrialEndingBanner } from "@/features/paywall/useTrialEndingBanner";
import { usePaywall } from "@/features/paywall/PaywallController";

export function TrialEndingBanner() {
  const { visible, dismiss } = useTrialEndingBanner();
  const { daysLeft } = useTrialBadge();
  const { showCapBlockPaywall } = usePaywall();
  const theme = useTheme();
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      banner: { backgroundColor: t.colors.surface, borderRadius: t.radius.sm, gap: t.spacing.md, padding: t.spacing.xl },
      headerRow: { flexDirection: "row", justifyContent: "space-between" },
      heading: { color: t.colors.text, fontFamily: t.fontFamilies.bodyBold, fontSize: t.typography.bodyLg },
      body: { color: t.colors.textMuted, fontFamily: t.fontFamilies.body, fontSize: t.typography.bodyMd, lineHeight: 20 },
    }),
  );
  if (!visible) return null;
  return (
    <View style={styles.banner}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>{paywallCopy.trialEndingTitle}</Text>
        <Pressable accessibilityLabel="Dismiss" hitSlop={12} onPress={() => void dismiss()}>
          <X color={theme.colors.textFaint} size={18} strokeWidth={1.75} />
        </Pressable>
      </View>
      <Text style={styles.body}>{paywallCopy.trialEndingBody(Math.max(daysLeft, 1))}</Text>
      <PrimaryButton label={paywallCopy.unlockCta} onPress={() => showCapBlockPaywall("settings_upgrade")} />
    </View>
  );
}
