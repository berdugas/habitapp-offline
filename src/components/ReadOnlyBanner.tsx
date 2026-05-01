import { StyleSheet, Text, View } from "react-native";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { colors } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";

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
    borderColor: colors.accent,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.xl,
  },
  body: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  heading: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
  },
});
