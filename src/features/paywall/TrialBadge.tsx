import { StyleSheet, Text, View } from "react-native";

import { useThemedStyles } from "@/theme/useThemedStyles";
import { paywallCopy } from "@/features/paywall/copy";
import { useTrialBadge } from "@/features/paywall/useTrialBadge";

export function TrialBadge() {
  const { visible, daysLeft } = useTrialBadge();
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      badge: { alignSelf: "flex-start", backgroundColor: t.colors.surfaceMuted, borderRadius: t.radius.pill, paddingHorizontal: t.spacing.sm, paddingVertical: 2 },
      text: { color: t.colors.textMuted, fontFamily: t.fontFamilies.bodySemi, fontSize: t.typography.micro, letterSpacing: 0.5 },
    }),
  );
  if (!visible) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{paywallCopy.trialBadge(daysLeft)}</Text>
    </View>
  );
}
