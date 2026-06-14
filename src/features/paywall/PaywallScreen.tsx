import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { TertiaryButton } from "@/components/buttons/TertiaryButton";
import { useThemedStyles } from "@/theme/useThemedStyles";
import { paywallCopy } from "@/features/paywall/copy";

type Props = {
  variant: "expiry" | "cap_block";
  isPurchasing: boolean;
  isRestoring: boolean;
  showRefundedBanner: boolean;
  onUnlock: () => void;
  onRestore: () => void;
  onContinueFree: () => void;
  onDismiss: () => void;
};

export function PaywallScreen({
  variant,
  isPurchasing,
  isRestoring,
  showRefundedBanner,
  onUnlock,
  onRestore,
  onContinueFree,
  onDismiss,
}: Props) {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      screen: { backgroundColor: t.colors.bg, flex: 1 },
      content: {
        flexGrow: 1,
        gap: t.spacing.xl,
        justifyContent: "center",
        padding: t.spacing.xl,
      },
      title: {
        color: t.colors.text,
        fontFamily: t.fontFamilies.displaySemi,
        fontSize: t.typography.headlineLg,
        textAlign: "center",
      },
      body: {
        color: t.colors.textMuted,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyLg,
        lineHeight: 24,
        textAlign: "center",
      },
      refunded: {
        backgroundColor: t.colors.surfaceMuted,
        borderRadius: t.radius.sm,
        color: t.colors.textMuted,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyMd,
        overflow: "hidden",
        padding: t.spacing.md,
        textAlign: "center",
      },
      actions: { gap: t.spacing.md },
    }),
  );

  const title =
    variant === "expiry" ? paywallCopy.expiryTitle : paywallCopy.capBlockTitle;
  const body =
    variant === "expiry" ? paywallCopy.expiryBody : paywallCopy.capBlockBody;

  const busy = isPurchasing || isRestoring;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content}>
        {showRefundedBanner ? (
          <Text style={styles.refunded}>{paywallCopy.refundedBanner}</Text>
        ) : null}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        <View style={styles.actions}>
          <PrimaryButton
            disabled={busy}
            label={isPurchasing ? "Opening…" : paywallCopy.unlockCta}
            onPress={onUnlock}
          />
          {variant === "expiry" ? (
            <SecondaryButton
              disabled={busy}
              label={paywallCopy.continueFreeCta}
              onPress={onContinueFree}
            />
          ) : (
            <SecondaryButton
              disabled={busy}
              label={paywallCopy.maybeLaterCta}
              onPress={onDismiss}
            />
          )}
          {/* TertiaryButton has no disabled prop — guard onPress directly */}
          <TertiaryButton
            label={isRestoring ? "Restoring…" : paywallCopy.restoreCta}
            onPress={busy ? () => undefined : onRestore}
          />
        </View>
      </ScrollView>
    </View>
  );
}
