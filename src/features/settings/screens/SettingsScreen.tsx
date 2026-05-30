import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ChevronRight, ExternalLink } from "lucide-react-native";
import Constants from "expo-constants";

const PRIVACY_POLICY_URL = "https://berdugas.github.io/habitapp-legal/";

import { TertiaryButton } from "@/components/buttons/TertiaryButton";
import { RowLV } from "@/components/cards/RowLV";
import { ZenCard } from "@/components/cards/ZenCard";
import { Eyebrow } from "@/components/text/Eyebrow";
import { useAuthSession } from "@/features/auth/hooks";
import { signOut } from "@/features/auth/api";
import { useTrialValidation } from "@/features/trial/hooks";
import { trackEvent } from "@/services/analytics";
import { useTheme } from "@/theme/useTheme";
import { useThemedStyles } from "@/theme/useThemedStyles";

import type { TrialEntitlementStatus } from "@/features/trial/types";

function formatEntitlementStatus(status: TrialEntitlementStatus | null): string | null {
  if (!status) return null;
  switch (status) {
    case "trial": return "Trial";
    case "active": return "Active";
    case "expired": return "Trial ended";
    case "paid": return "Paid";
    case "cancelled": return "Cancelled";
  }
}

export default function SettingsScreen() {
  const { user } = useAuthSession();
  const { entitlementStatus } = useTrialValidation();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const theme = useTheme();
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      content: {
        gap: t.spacing.xl,
        padding: t.spacing.xl,
      },
      email: {
        color: t.colors.text,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyLg,
      },
      row: {
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: t.spacing.sm,
      },
      rowLabel: {
        color: t.colors.text,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyLg,
      },
      screen: {
        backgroundColor: t.colors.bg,
        flex: 1,
      },
      statusLabel: {
        color: t.colors.textMuted,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyMd,
        fontStyle: "italic",
      },
      dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
      },
      themeName: {
        color: t.colors.textMuted,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyMd,
      },
      appearanceValue: {
        flexDirection: "row",
        alignItems: "center",
        gap: t.spacing.sm,
      },
    }),
  );

  const statusLabel = formatEntitlementStatus(entitlementStatus);
  const appVersion = Constants.expoConfig?.version ?? "—";

  async function handleSignOut() {
    setIsSigningOut(true);
    trackEvent("settings_sign_out");
    await signOut();
    setIsSigningOut(false);
    router.replace("/");
  }

  function handleExportPressed() {
    trackEvent("settings_export_initiated");
    router.push("/(app)/settings/export");
  }

  function handlePrivacyPolicyPressed() {
    trackEvent("settings_privacy_policy_opened");
    void Linking.openURL(PRIVACY_POLICY_URL);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
    >
      <ZenCard>
        <Eyebrow label="Account" />
        <Text selectable style={styles.email}>
          {user?.email ?? "Signed in"}
        </Text>
        {statusLabel ? (
          <Text selectable style={styles.statusLabel}>
            {statusLabel}
          </Text>
        ) : null}
      </ZenCard>

      <ZenCard gap={0}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/(app)/habits/backlog")}
          style={styles.row}
        >
          <Text style={styles.rowLabel}>Archive</Text>
          <ChevronRight color={theme.colors.textFaint} size={18} strokeWidth={1.75} />
        </Pressable>
      </ZenCard>

      <ZenCard gap={0}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/(app)/settings/appearance")}
          style={styles.row}
        >
          <Text style={styles.rowLabel}>Appearance</Text>
          <View style={styles.appearanceValue}>
            <View style={[styles.dot, { backgroundColor: theme.colors.primary }]} />
            <Text style={styles.themeName}>{theme.name}</Text>
            <ChevronRight color={theme.colors.textFaint} size={18} strokeWidth={1.75} />
          </View>
        </Pressable>
      </ZenCard>

      <ZenCard gap={theme.spacing.md}>
        <Eyebrow label="Privacy & Data" />
        <Pressable
          accessibilityRole="button"
          onPress={handleExportPressed}
          style={styles.row}
        >
          <Text style={styles.rowLabel}>Export your data</Text>
          <ChevronRight color={theme.colors.textFaint} size={18} strokeWidth={1.75} />
        </Pressable>
      </ZenCard>

      <ZenCard>
        <Eyebrow label="About" />
        <RowLV label="Version" value={appVersion} />
        <Pressable
          accessibilityRole="button"
          onPress={handlePrivacyPolicyPressed}
          style={styles.row}
        >
          <Text style={styles.rowLabel}>Privacy Policy</Text>
          <ExternalLink color={theme.colors.textFaint} size={18} strokeWidth={1.75} />
        </Pressable>
        <RowLV label="Terms of Service" value="Coming soon" />
      </ZenCard>

      <TertiaryButton
        label={isSigningOut ? "Signing out..." : "Sign Out"}
        onPress={handleSignOut}
      />
    </ScrollView>
  );
}
