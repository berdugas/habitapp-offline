import { StyleSheet, Text, View } from "react-native";

import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { Eyebrow } from "@/components/text/Eyebrow";
import { useThemedStyles } from "@/theme/useThemedStyles";

type DangerZoneProps = {
  title: string;
  body: string;
  buttonLabel: string;
  disabled?: boolean;
  isPending?: boolean;
  onPress: () => void;
};

export function DangerZone({
  title,
  body,
  buttonLabel,
  disabled,
  isPending,
  onPress,
}: DangerZoneProps) {
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      container: {
        backgroundColor: theme.colors.dangerSoft,
        borderColor: theme.colors.dangerSubtle,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        gap: theme.spacing.sm,
        padding: theme.spacing.lg,
      },
      body: {
        color: theme.colors.textMuted,
        fontFamily: theme.fontFamilies.body,
        fontSize: theme.typography.bodyMd,
        lineHeight: 18.6,
      },
    }),
  );

  return (
    <View style={styles.container}>
      <Eyebrow label={title} tone="danger" />
      <Text style={styles.body}>{body}</Text>
      <SecondaryButton
        disabled={disabled || isPending}
        isDanger
        label={isPending ? "Deleting…" : buttonLabel}
        onPress={onPress}
      />
    </View>
  );
}
