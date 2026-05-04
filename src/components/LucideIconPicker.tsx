import * as LucideIcons from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";

type LucideIconPickerProps = {
  selected: string | null;
  onSelect: (name: string) => void;
};

type IconCategory = {
  label: string;
  icons: string[];
};

const CATEGORIES: IconCategory[] = [
  {
    label: "Fitness & movement",
    icons: ["PersonStanding", "Dumbbell", "Activity", "HeartPulse", "Timer", "Bike", "Footprints", "Trophy", "PersonRunning", "Volleyball"],
  },
  {
    label: "Mind & wellness",
    icons: ["Brain", "Heart", "Smile", "Sparkles", "Moon", "Sun", "Bed", "CloudRain"],
  },
  {
    label: "Reading & learning",
    icons: ["BookOpen", "Book", "BookText", "GraduationCap", "SquarePen", "FileText", "Code"],
  },
  {
    label: "Food & drink",
    icons: ["Coffee", "CupSoda", "GlassWater", "Salad", "UtensilsCrossed", "Droplet", "Apple", "Egg"],
  },
  {
    label: "Creative",
    icons: ["Palette", "Music", "ImageIcon", "Camera", "PenTool", "Star", "Film"],
  },
  {
    label: "Home & routine",
    icons: ["Home", "Shirt", "Calendar", "ListChecks", "Repeat", "Toilet", "Bath", "Lamp"],
  },
  {
    label: "Social & connection",
    icons: ["Users", "MessageSquare", "Phone", "Mail", "NotebookPen", "UserPlus"],
  },
  {
    label: "Nature & outdoors",
    icons: ["Sprout", "Leaf", "TreePine", "Mountain", "Globe", "Shield"],
  },
];

export function LucideIcon({
  name,
  size = 18,
  color = colors.primary,
  strokeWidth = 1.8,
}: {
  name: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const Component = (LucideIcons as Record<string, unknown>)[name] as React.ComponentType<{
    size?: number;
    color?: string;
    strokeWidth?: number;
  }> | undefined;
  if (!Component) return null;
  return <Component size={size} color={color} strokeWidth={strokeWidth} />;
}

export function LucideIconPicker({ selected, onSelect }: LucideIconPickerProps) {
  return (
    <ScrollView
      style={styles.container}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
    >
      {CATEGORIES.map((category) => (
        <View key={category.label} style={styles.category}>
          <Text style={styles.categoryLabel}>{category.label}</Text>
          <View style={styles.grid}>
            {category.icons.map((iconName) => {
              const isSelected = selected === iconName;
              return (
                <Pressable
                  key={iconName}
                  onPress={() => onSelect(iconName)}
                  style={[styles.iconCell, isSelected && styles.iconCellSelected]}
                >
                  <LucideIcon name={iconName} size={18} color={colors.primary} strokeWidth={1.8} />
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 12,
    maxHeight: 300,
  },
  category: {
    marginBottom: 12,
  },
  categoryLabel: {
    fontSize: 11,
    fontFamily: fontFamilies.bodyMedium,
    color: colors.textFaint,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingLeft: 2,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  iconCell: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  iconCellSelected: {
    backgroundColor: colors.primarySoft,
  },
});
