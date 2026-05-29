import { Pressable, StyleSheet, Text } from "react-native";

import { useThemedStyles } from "@/theme/useThemedStyles";

type TertiaryButtonProps = {
  label: string;
  onPress: () => void;
};

export function TertiaryButton({ label, onPress }: TertiaryButtonProps) {
  const styles = useThemedStyles((theme) =>
    StyleSheet.create({
      button: {
        alignItems: "center",
        padding: 8,
      },
      buttonPressed: {
        opacity: 0.7,
      },
      label: {
        color: theme.colors.primary,
        fontFamily: theme.fontFamilies.bodySemi,
        fontSize: theme.typography.bodyLg,
      },
    }),
  );

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}
