import { StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

type ReadOnlyBannerProps = {
  isReconnecting: boolean;
  onReconnect: () => void;
};

export function ReadOnlyBanner({ isReconnecting, onReconnect }: ReadOnlyBannerProps) {
  return (
    <View style={styles.banner}>
      <Text selectable style={styles.heading}>
        Reconnect to keep logging.
      </Text>
      <Text selectable style={styles.body}>
        We haven&apos;t been able to verify your account in a while. Tap to
        reconnect.
      </Text>
      <PrimaryButton
        disabled={isReconnecting}
        label={isReconnecting ? "Reconnecting…" : "Reconnect"}
        onPress={onReconnect}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    gap: spacing.md,
    padding: spacing.xl,
  },
  body: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    lineHeight: 22,
  },
  heading: {
    color: colors.text,
    fontFamily: fontFamilies.bodyBold,
    fontSize: typography.bodyLg,
  },
});
