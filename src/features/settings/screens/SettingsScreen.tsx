import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import Constants from "expo-constants";

import { TertiaryButton } from "@/components/buttons/TertiaryButton";
import { RowLV } from "@/components/cards/RowLV";
import { ZenCard } from "@/components/cards/ZenCard";
import { Eyebrow } from "@/components/text/Eyebrow";
import { useAuthSession } from "@/features/auth/hooks";
import { signOut } from "@/features/auth/api";
import { useTrialValidation } from "@/features/trial/hooks";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

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

  const statusLabel = formatEntitlementStatus(entitlementStatus);
  const appVersion = Constants.expoConfig?.version ?? "—";

  async function handleSignOut() {
    setIsSigningOut(true);
    await signOut();
    setIsSigningOut(false);
    router.replace("/");
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
          <Text style={styles.rowLabel}>Manage habits</Text>
          <ChevronRight color={colors.textFaint} size={18} strokeWidth={1.75} />
        </Pressable>
      </ZenCard>

      <ZenCard gap={spacing.md}>
        <Eyebrow label="Privacy & Data" />
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/(app)/settings/export")}
          style={styles.row}
        >
          <Text style={styles.rowLabel}>Export your data</Text>
          <ChevronRight color={colors.textFaint} size={18} strokeWidth={1.75} />
        </Pressable>
      </ZenCard>

      <ZenCard>
        <Eyebrow label="About" />
        <RowLV label="Version" value={appVersion} />
        <RowLV label="Privacy Policy" value="Coming soon" />
        <RowLV label="Terms of Service" value="Coming soon" />
      </ZenCard>

      <TertiaryButton
        label={isSigningOut ? "Signing out..." : "Sign Out"}
        onPress={handleSignOut}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
    padding: spacing.xl,
  },
  email: {
    color: colors.text,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyLg,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  rowLabel: {
    color: colors.text,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyLg,
  },
  screen: {
    backgroundColor: colors.bg,
    flex: 1,
  },
  statusLabel: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    fontStyle: "italic",
  },
});
