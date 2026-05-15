import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";

export type SRHIQuestionProps = {
  disabled?: boolean;
  onSelect: (score: number) => void;
  questionNumber: number;
  questionText: string;
  selectedScore: number | null;
};

const SCALE = [1, 2, 3, 4, 5];

export function SRHIQuestion({
  disabled = false,
  onSelect,
  questionNumber,
  questionText,
  selectedScore,
}: SRHIQuestionProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.questionText}>{questionText}</Text>
      <View
        accessibilityLabel={`Question ${questionNumber} scale`}
        accessibilityRole="radiogroup"
        style={styles.chipsRow}
      >
        {SCALE.map((score) => {
          const isSelected = selectedScore === score;
          return (
            <Pressable
              accessibilityLabel={`Question ${questionNumber} score ${score}`}
              accessibilityRole="radio"
              accessibilityState={{ disabled, selected: isSelected }}
              disabled={disabled}
              key={score}
              onPress={() => onSelect(score)}
              style={[styles.chip, isSelected && styles.chipSelected]}
            >
              <Text
                style={[
                  styles.chipText,
                  isSelected && styles.chipTextSelected,
                ]}
              >
                {score}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.scaleLabels}>
        <Text style={styles.scaleLabelText}>Strongly disagree</Text>
        <Text style={styles.scaleLabelText}>Strongly agree</Text>
      </View>
    </View>
  );
}

const CHIP_SIZE = 44;

const styles = StyleSheet.create({
  chip: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: "transparent",
    borderRadius: radius.pill,
    borderWidth: 1,
    height: CHIP_SIZE,
    justifyContent: "center",
    width: CHIP_SIZE,
  },
  chipSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.text,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyMd,
  },
  chipTextSelected: {
    color: colors.primary,
    fontFamily: fontFamilies.bodySemi,
  },
  chipsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  container: {
    gap: spacing.sm,
  },
  questionText: {
    color: colors.text,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyLg,
    lineHeight: 22,
  },
  scaleLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  scaleLabelText: {
    color: colors.textFaint,
    fontFamily: fontFamilies.body,
    fontSize: typography.micro,
  },
});
