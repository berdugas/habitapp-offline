import { Pressable, StyleSheet, Text } from "react-native";

import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { typography } from "@/theme/typography";

type TertiaryButtonProps = {
  label: string;
  onPress: () => void;
};

export function TertiaryButton({ label, onPress }: TertiaryButtonProps) {
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

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    padding: 8,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  label: {
    color: colors.primary,
    fontFamily: fontFamilies.bodySemi,
    fontSize: typography.bodyLg,
  },
});
