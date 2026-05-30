import { Pressable, StyleSheet, Text, View } from "react-native";

import { useThemedStyles } from "@/theme/useThemedStyles";

export type SRHIQuestionProps = {
  disabled?: boolean;
  onSelect: (score: number) => void;
  questionNumber: number;
  questionText: string;
  selectedScore: number | null;
};

const SCALE = [1, 2, 3, 4, 5];
const CHIP_SIZE = 44;

export function SRHIQuestion({
  disabled = false,
  onSelect,
  questionNumber,
  questionText,
  selectedScore,
}: SRHIQuestionProps) {
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      chip: {
        alignItems: "center",
        backgroundColor: t.colors.surface,
        borderColor: "transparent",
        borderRadius: t.radius.pill,
        borderWidth: 1,
        height: CHIP_SIZE,
        justifyContent: "center",
        width: CHIP_SIZE,
      },
      chipSelected: {
        backgroundColor: t.colors.primarySoft,
        borderColor: t.colors.primary,
      },
      chipText: {
        color: t.colors.text,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyMd,
      },
      chipTextSelected: {
        color: t.colors.primary,
        fontFamily: t.fontFamilies.bodySemi,
      },
      chipsRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        width: "100%",
      },
      container: {
        gap: t.spacing.sm,
      },
      questionText: {
        color: t.colors.text,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyLg,
        lineHeight: 19.3,
      },
      scaleLabels: {
        flexDirection: "row",
        justifyContent: "space-between",
      },
      scaleLabelText: {
        color: t.colors.textFaint,
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.micro,
      },
    }),
  );

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
