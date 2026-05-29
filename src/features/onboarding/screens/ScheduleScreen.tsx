import DateTimePicker from "@react-native-community/datetimepicker";
import { Bell, ChevronRight, Clock } from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { GuidanceCard } from "@/components/cards/GuidanceCard";
import { ActiveDaysPicker } from "@/components/forms/ActiveDaysPicker";
import { OnboardingLayout } from "@/components/layouts/OnboardingLayout";
import { OnboardingHeader } from "@/components/navigation/OnboardingHeader";
import { useOnboarding } from "@/features/onboarding/OnboardingProvider";
import { useTheme } from "@/theme/useTheme";
import { useThemedStyles } from "@/theme/useThemedStyles";

function hhmmToDate(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function dateToHhmm(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatTime(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const ampm = h < 12 ? "AM" : "PM";
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function ScheduleScreen() {
  const { draft, update } = useOnboarding();
  const [showTimePicker, setShowTimePicker] = useState(false);
  const theme = useTheme();
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      headline: {
        fontFamily: t.fontFamilies.displayBold,
        fontSize: 24,
        lineHeight: 30,
        color: t.colors.text,
        marginBottom: t.spacing.sm,
      },
      subtitle: {
        fontFamily: t.fontFamilies.body,
        fontSize: 14.5,
        lineHeight: 22,
        color: t.colors.textFaint,
        marginBottom: t.spacing.xxl,
      },
      sectionLabel: {
        fontFamily: t.fontFamilies.bodyMedium,
        fontSize: t.typography.labelMd,
        color: t.colors.textMuted,
        marginBottom: t.spacing.sm,
      },
      guidanceWrap: {
        marginTop: t.spacing.lg,
        marginBottom: t.spacing.xxl,
      },
      reminderCard: {
        backgroundColor: t.colors.surfaceCard,
        borderRadius: t.radius.md,
        overflow: "hidden",
      },
      reminderRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 14,
        paddingHorizontal: t.spacing.lg,
      },
      rowDivider: {
        height: 1,
        backgroundColor: t.colors.surface,
        marginHorizontal: t.spacing.lg,
      },
      rowLeft: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      },
      rowLabel: {
        fontFamily: t.fontFamilies.bodyMedium,
        fontSize: 15,
        color: t.colors.text,
      },
      rowRight: {
        flexDirection: "row",
        alignItems: "center",
        gap: t.spacing.xs,
      },
      timeText: {
        fontFamily: t.fontFamilies.bodyMedium,
        fontSize: 15,
        color: t.colors.primary,
      },
      modalOverlay: {
        flex: 1,
        justifyContent: "flex-end",
        backgroundColor: "rgba(0,0,0,0.35)",
      },
      modalSheet: {
        backgroundColor: t.colors.bg,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: t.spacing.md,
        paddingBottom: 40,
      },
      modalHandle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: t.colors.surfaceHigh,
        alignSelf: "center",
        marginBottom: t.spacing.sm,
      },
      modalHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: t.spacing.xl,
        paddingVertical: t.spacing.md,
      },
      modalTitle: {
        fontFamily: t.fontFamilies.displaySemi,
        fontSize: t.typography.bodyLg,
        color: t.colors.text,
      },
      modalDone: {
        fontFamily: t.fontFamilies.bodySemi,
        fontSize: t.typography.bodyLg,
        color: t.colors.primary,
      },
      iosPicker: {
        marginHorizontal: t.spacing.xl,
      },
    }),
  );

  const pickerDate = useMemo(() => hhmmToDate(draft.reminderTime), [draft.reminderTime]);

  const handleContinue = () => {
    update({ step: "personalize" });
    router.push("/(onboarding)/personalize");
  };

  return (
    <OnboardingLayout
      footer={<PrimaryButton label="Continue" showArrow onPress={handleContinue} />}
    >
      <OnboardingHeader
        currentStep={5}
        onBack={() => {
          update({ step: "cue" });
          if (router.canGoBack()) router.back();
          else router.replace("/(onboarding)/cue");
        }}
      />

      <Text style={styles.headline}>Set your rhythm.</Text>
      <Text style={styles.subtitle}>
        Choose your days and set a reminder so you don't have to rely on memory.
      </Text>

      {/* ActiveDaysPicker renders its own "Active days" label internally */}
      <ActiveDaysPicker
        value={draft.activeDays}
        onChange={(days) => update({ activeDays: days })}
      />

      <View style={styles.guidanceWrap}>
        <GuidanceCard
          title="Choose days that work best."
          body="It's better to commit to 4 days you'll actually keep than 7 you won't. Off-days won't break your streak — they're part of the rhythm."
        />
      </View>

      <Text style={styles.sectionLabel}>Add a reminder</Text>

      <View style={styles.reminderCard}>
        <View style={styles.reminderRow}>
          <View style={styles.rowLeft}>
            <Bell color={theme.colors.primary} size={18} strokeWidth={1.8} />
            <Text style={styles.rowLabel}>Notify me</Text>
          </View>
          <Switch
            value={draft.reminderEnabled}
            onValueChange={(val) => update({ reminderEnabled: val })}
            trackColor={{ true: theme.colors.primary, false: theme.colors.surfaceHigh }}
            thumbColor={theme.colors.surfaceCard}
          />
        </View>

        {draft.reminderEnabled && (
          <>
            <View style={styles.rowDivider} />
            <Pressable
              style={styles.reminderRow}
              onPress={() => setShowTimePicker(true)}
            >
              <View style={styles.rowLeft}>
                <Clock color={theme.colors.primary} size={18} strokeWidth={1.8} />
                <Text style={styles.rowLabel}>Time</Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={styles.timeText}>{formatTime(draft.reminderTime)}</Text>
                <ChevronRight color={theme.colors.primary} size={16} strokeWidth={2} />
              </View>
            </Pressable>
          </>
        )}
      </View>

      {/* Android: DateTimePicker renders as a system dialog when visible */}
      {Platform.OS === "android" && showTimePicker && (
        <DateTimePicker
          mode="time"
          value={pickerDate}
          display="default"
          onChange={(event, date) => {
            setShowTimePicker(false);
            if (event.type === "set" && date) {
              update({ reminderTime: dateToHhmm(date) });
            }
          }}
        />
      )}

      {/* iOS: spinner in a bottom-sheet modal */}
      {Platform.OS === "ios" && (
        <Modal
          visible={showTimePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowTimePicker(false)}
        >
          <View style={styles.modalOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowTimePicker(false)} />
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Reminder time</Text>
                <Pressable onPress={() => setShowTimePicker(false)}>
                  <Text style={styles.modalDone}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                mode="time"
                value={pickerDate}
                display="spinner"
                minuteInterval={5}
                onChange={(_, date) => {
                  if (date) update({ reminderTime: dateToHhmm(date) });
                }}
                style={styles.iosPicker}
              />
            </View>
          </View>
        </Modal>
      )}
    </OnboardingLayout>
  );
}
