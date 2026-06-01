import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Settings as SettingsIcon } from "lucide-react-native";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { OnboardingLayout } from "@/components/layouts/OnboardingLayout";
import { OnboardingHeader } from "@/components/navigation/OnboardingHeader";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import { ThemeCard } from "@/features/settings/components/ThemeCard";
import { ThemeLoadErrorBanner } from "@/features/settings/components/ThemeLoadErrorBanner";
import { ThemePickerOverlay } from "@/features/settings/components/ThemePickerOverlay";
import { useThemePicker } from "@/features/settings/hooks/useThemePicker";
import { THEMES } from "@/theme/registry";
import { useTheme } from "@/theme/useTheme";
import { useThemedStyles } from "@/theme/useThemedStyles";

import type { Theme } from "@/theme/contract";

function totalDownloadBytes(theme: Theme): number | null {
  if (theme.fontAssets.kind !== "remote") return null;
  return Object.values(theme.fontAssets.assets).reduce((sum, a) => sum + a.bytes, 0);
}

export default function MakeItYoursScreen() {
  const { update } = useOnboarding();
  const theme = useTheme();
  const { active, cachedThemeIds, isApplying, loadError, onCardPress, retry } =
    useThemePicker();

  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      headline: {
        fontFamily: t.fontFamilies.displayBold,
        fontSize: 28,
        lineHeight: 33,
        color: t.colors.text,
        marginBottom: 8,
      },
      body: {
        fontFamily: t.fontFamilies.body,
        fontSize: 15,
        lineHeight: 23,
        color: t.colors.textMuted,
        marginBottom: 20,
      },
      cards: {
        gap: t.spacing.md,
      },
      micro: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginTop: t.spacing.md,
      },
      microText: {
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.labelMd,
        color: t.colors.textFaint,
        flex: 1,
      },
    }),
  );

  const handleContinue = () => {
    update({ step: "confirmation" });
    router.push("/(onboarding)/confirmation");
  };

  // Overlay must be a SIBLING of OnboardingLayout, not a child. absoluteFillObject
  // is relative to the nearest View ancestor; placed inside the layout's ScrollView
  // body it would only cover the body and leave the Continue button in the footer
  // visible and tappable mid-download. Wrapping both in an outer flex:1 View lets
  // the overlay cover the entire screen including the footer.
  return (
    <View style={{ flex: 1 }}>
      <OnboardingLayout
        footer={
          <PrimaryButton label="Continue" showArrow onPress={handleContinue} />
        }
      >
        <OnboardingHeader currentStep={7} showBack={false} />

        <Text style={styles.headline}>Make it yours.</Text>
        <Text style={styles.body}>Pick a look for your app.</Text>

        {loadError ? (
          <ThemeLoadErrorBanner themeName={loadError.themeName} onRetry={retry} />
        ) : null}

        <View style={styles.cards}>
          {(Object.values(THEMES) as Theme[]).map((t) => (
            <ThemeCard
              key={t.id}
              theme={t}
              isActive={t.id === active.id}
              isFontReady={t.fontAssets.kind === "bundled" || t.id === active.id || cachedThemeIds.has(t.id)}
              downloadSizeBytes={totalDownloadBytes(t)}
              onPress={() => {
                void onCardPress(t);
              }}
            />
          ))}
        </View>

        <View style={styles.micro}>
          <SettingsIcon color={theme.colors.textFaint} size={14} strokeWidth={1.8} />
          <Text style={styles.microText}>
            You can change the theme anytime in Settings → Appearance.
          </Text>
        </View>
      </OnboardingLayout>

      {isApplying ? <ThemePickerOverlay /> : null}
    </View>
  );
}
