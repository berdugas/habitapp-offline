import { ScrollView, StyleSheet, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { EmptyState } from "@/components/feedback/EmptyState";
import { useThemedStyles } from "@/theme/useThemedStyles";

export default function HabitContextScreen() {
  const { habitId } = useLocalSearchParams<{ habitId: string }>();
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      content: {
        gap: t.spacing.xl,
        padding: t.spacing.xl,
      },
      screen: {
        backgroundColor: t.colors.bg,
        flex: 1,
      },
      title: {
        color: t.colors.text,
        fontSize: t.typography.headlineLg,
        fontWeight: "800",
      },
    }),
  );

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
    >
      <Text selectable style={styles.title}>
        Habit Context
      </Text>
      <EmptyState
        body={`Optional context comes after the first slice. Habit ID: ${habitId ?? "unknown"}.`}
        title="Route scaffolded"
      />
    </ScrollView>
  );
}
