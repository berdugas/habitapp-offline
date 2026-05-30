import { useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Bell, ChevronRight, Clock } from "lucide-react-native";

import { useTheme } from "@/theme/useTheme";
import { useThemedStyles } from "@/theme/useThemedStyles";

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
  const theme = useTheme();
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      container: {
        gap: 8,
      },
      label: {
        fontSize: t.typography.labelMd,
        fontFamily: t.fontFamilies.bodyMedium,
        color: t.colors.textMuted,
        paddingLeft: 4,
      },
      card: {
        backgroundColor: t.colors.surfaceCard,
        borderRadius: t.radius.md,
        overflow: "hidden",
      },
      row: {
        flexDirection: "row",
        alignItems: "center",
        gap: t.spacing.sm,
        paddingVertical: 12,
        paddingHorizontal: 16,
      },
      rowText: {
        flex: 1,
        fontFamily: t.fontFamilies.body,
        fontSize: 15,
        color: t.colors.text,
      },
      divider: {
        height: 1,
        backgroundColor: t.colors.surface,
        marginHorizontal: 16,
      },
      timeValue: {
        fontFamily: t.fontFamilies.body,
        fontSize: 15,
        color: t.colors.textMuted,
      },
      done: {
        alignSelf: "flex-end",
        paddingHorizontal: t.spacing.lg,
        paddingVertical: t.spacing.sm,
      },
      doneText: {
        fontFamily: t.fontFamilies.bodySemi,
        fontSize: 15,
        color: t.colors.primary,
      },
    }),
  );

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
          <Bell size={16} color={theme.colors.primary} strokeWidth={1.75} />
          <Text style={styles.rowText}>Notify me</Text>
          <Switch
            value={enabled}
            disabled={disabled}
            onValueChange={handleToggle}
            trackColor={{ false: theme.colors.surface, true: theme.colors.primary }}
            thumbColor={theme.colors.surfaceCard}
          />
        </View>
        {enabled ? (
          <>
            <View style={styles.divider} />
            <Pressable style={styles.row} onPress={() => setShowPicker(true)}>
              <Clock size={16} color={theme.colors.textMuted} strokeWidth={1.75} />
              <Text style={styles.rowText}>Time</Text>
              <Text style={styles.timeValue}>{format12h(value!)}</Text>
              <ChevronRight size={16} color={theme.colors.textMuted} strokeWidth={1.75} />
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
