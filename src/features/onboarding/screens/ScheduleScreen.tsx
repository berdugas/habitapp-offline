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
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";

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
            <Bell color={colors.primary} size={18} strokeWidth={1.8} />
            <Text style={styles.rowLabel}>Notify me</Text>
          </View>
          <Switch
            value={draft.reminderEnabled}
            onValueChange={(val) => update({ reminderEnabled: val })}
            trackColor={{ true: colors.primary, false: colors.surfaceHigh }}
            thumbColor={colors.surfaceCard}
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
                <Clock color={colors.primary} size={18} strokeWidth={1.8} />
                <Text style={styles.rowLabel}>Time</Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={styles.timeText}>{formatTime(draft.reminderTime)}</Text>
                <ChevronRight color={colors.primary} size={16} strokeWidth={2} />
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

const styles = StyleSheet.create({
  headline: {
    fontFamily: fontFamilies.displayBold,
    fontSize: 24,
    lineHeight: 30,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: fontFamilies.body,
    fontSize: 14.5,
    lineHeight: 22,
    color: colors.textFaint,
    marginBottom: spacing.xxl,
  },
  sectionLabel: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  guidanceWrap: {
    marginTop: spacing.lg,
    marginBottom: spacing.xxl,
  },
  reminderCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  reminderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowLabel: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 15,
    color: colors.text,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  timeText: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 15,
    color: colors.primary,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  modalSheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: spacing.md,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceHigh,
    alignSelf: "center",
    marginBottom: spacing.sm,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  modalTitle: {
    fontFamily: fontFamilies.displaySemi,
    fontSize: 16,
    color: colors.text,
  },
  modalDone: {
    fontFamily: fontFamilies.bodySemi,
    fontSize: 16,
    color: colors.primary,
  },
  iosPicker: {
    marginHorizontal: spacing.xl,
  },
});
