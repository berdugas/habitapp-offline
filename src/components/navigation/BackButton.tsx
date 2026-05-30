import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/theme/useTheme';
import { useThemedStyles } from '@/theme/useThemedStyles';

type BackButtonProps = {
  onPress?: () => void;
};

export function BackButton({ onPress }: BackButtonProps) {
  const router = useRouter();
  const theme = useTheme();
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      circle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: t.colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
      },
      pressed: {
        opacity: 0.7,
      },
    }),
  );

  return (
    <Pressable
      accessibilityLabel="Go back"
      accessibilityRole="button"
      onPress={onPress ?? (() => router.back())}
      style={({ pressed }) => [styles.circle, pressed && styles.pressed]}
    >
      <ChevronLeft color={theme.colors.text} size={18} strokeWidth={1.8} />
    </Pressable>
  );
}
