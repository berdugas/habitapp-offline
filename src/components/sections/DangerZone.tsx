import { StyleSheet, Text, View } from "react-native";

import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { Eyebrow } from "@/components/text/Eyebrow";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";

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

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerSubtle,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  body: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: 14,
    lineHeight: 20,
  },
});
