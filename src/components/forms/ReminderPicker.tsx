import { useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Bell, ChevronRight, Clock } from "lucide-react-native";

import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";

function format12h(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}

type Props = {
  value: string | null;
  onChange: (v: string | null) => void;
  disabled?: boolean;
};

export function ReminderPicker({ value, onChange, disabled = false }: Props) {
  const [showPicker, setShowPicker] = useState(false);
  const enabled = value !== null;

  const pickerDate = useMemo(() => {
    const d = new Date();
    if (value) {
      const [h, m] = value.split(":").map(Number);
      d.setHours(h, m, 0, 0);
    } else {
      d.setHours(7, 0, 0, 0);
    }
    return d;
  }, [value]);

  function handleToggle(on: boolean) {
    if (disabled) return;
    if (on) {
      onChange("07:00");
    } else {
      onChange(null);
      setShowPicker(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Add a reminder</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Bell size={16} color={colors.primary} strokeWidth={1.75} />
          <Text style={styles.rowText}>Notify me</Text>
          <Switch
            value={enabled}
            disabled={disabled}
            onValueChange={handleToggle}
            trackColor={{ false: colors.surface, true: colors.primary }}
            thumbColor={colors.surfaceCard}
          />
        </View>
        {enabled ? (
          <>
            <View style={styles.divider} />
            <Pressable style={styles.row} onPress={() => setShowPicker(true)}>
              <Clock size={16} color={colors.textMuted} strokeWidth={1.75} />
              <Text style={styles.rowText}>Time</Text>
              <Text style={styles.timeValue}>{format12h(value!)}</Text>
              <ChevronRight size={16} color={colors.textMuted} strokeWidth={1.75} />
            </Pressable>
          </>
        ) : null}
      </View>
      {showPicker ? (
        <DateTimePicker
          value={pickerDate}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(_, selected) => {
            if (Platform.OS === "android") setShowPicker(false);
            if (selected) {
              const h = selected.getHours().toString().padStart(2, "0");
              const m = selected.getMinutes().toString().padStart(2, "0");
              onChange(`${h}:${m}`);
            }
          }}
        />
      ) : null}
      {showPicker && Platform.OS === "ios" ? (
        <Pressable style={styles.done} onPress={() => setShowPicker(false)}>
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontFamily: fontFamilies.bodyMedium,
    color: colors.textMuted,
    paddingLeft: 4,
  },
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  rowText: {
    flex: 1,
    fontFamily: fontFamilies.body,
    fontSize: 15,
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.surface,
    marginHorizontal: 16,
  },
  timeValue: {
    fontFamily: fontFamilies.body,
    fontSize: 15,
    color: colors.textMuted,
  },
  done: {
    alignSelf: "flex-end",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  doneText: {
    fontFamily: fontFamilies.bodySemi,
    fontSize: 15,
    color: colors.primary,
  },
});
