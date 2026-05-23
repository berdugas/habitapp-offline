import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

/**
 * Replaces the old `GoalReflectionStep` on clean weeks (zero
 * struggling habits). The earlier step asked the user for an
 * optional free-text "experiment" to try. That framing implicitly
 * suggested change was due even when everything was working — which
 * fights the product's "Smaller than she thinks" principle and the
 * "Compound, do not graduate" model (a working habit isn't the
 * trigger to grow this one bigger; it's a step toward graduation).
 *
 * The new screen is purely declarative: headline + body, no input,
 * no inline buttons. The parent owns the Continue button via the
 * existing footer (same affordance used on Mirror and What's
 * Working). The catch-up effect on Week Complete entry writes the
 * empty `weekly_reviews` rows for every habit, so no write path is
 * needed here.
 */
export function CleanWeekAffirmationStep() {
  return (
    <View style={styles.container}>
      <Text style={styles.headline}>Solid week.</Text>
      <Text style={styles.body}>
        Every habit was on track. Take the win and keep showing up.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
    lineHeight: 20,
  },
  container: {
    gap: spacing.sm,
  },
  headline: {
    color: colors.text,
    fontFamily: fontFamilies.displayBold,
    fontSize: typography.headlineMd,
    letterSpacing: -0.2,
    lineHeight: 30,
  },
});
