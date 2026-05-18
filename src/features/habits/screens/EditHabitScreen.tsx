import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft, PenLine } from "lucide-react-native";

import { LucideIcon, LucideIconPicker } from "@/components/LucideIconPicker";
import { ReminderPicker } from "@/components/forms/ReminderPicker";
import { ErrorState } from "@/components/feedback/ErrorState";
import { LoadingState } from "@/components/feedback/LoadingState";
import { ActiveDaysPicker } from "@/components/forms/ActiveDaysPicker";
import { ReadOnlyBanner } from "@/components/ReadOnlyBanner";
import {
  useOwnedHabitQuery,
  useUpdateHabitMutation,
} from "@/features/habits/hooks";
import { parseActiveDays, ALL_DAYS } from "@/features/habits/activeDays";
import {
  cancelReminder,
  rescheduleAll,
  scheduleReminder,
} from "@/features/reminders/notifications";
import { getReminderByHabitId } from "@/lib/db/repositories/reminders";
import { formatHabitFormula } from "@/features/habits/formatters";
import { stripLeadingAfter, stripLeadingIWill } from "@/features/habits/formatters";
import { useAuthSession } from "@/features/auth/hooks";
import {
  normalizeHabitSetupPayload,
  validateHabitSetupPayload,
} from "@/features/habits/validators";
import { getHabitSuggestionEditGuidance } from "@/features/recommendations/editGuidance";
import { useTrialValidation } from "@/features/trial/hooks";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { radius } from "@/theme/radius";
import { SCREEN_TOP_PADDING, spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import {
  getLoadHabitDetailErrorMessage,
  getUpdateHabitErrorMessage,
} from "@/utils/userFacingErrors";

export default function EditHabitScreen() {
  const { user } = useAuthSession();
  const { habitId, suggestionType, from } = useLocalSearchParams<{
    habitId?: string | string[];
    suggestionType?: string | string[];
    from?: string | string[];
  }>();
  const fromRecovery = (Array.isArray(from) ? from[0] : from) === "recovery";
  const insets = useSafeAreaInsets();
  const resolvedHabitId = Array.isArray(habitId) ? habitId[0] : habitId;

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
    } else if (resolvedHabitId) {
      router.replace(`/(app)/habits/${resolvedHabitId}`);
    } else {
      router.replace("/(app)/(tabs)/today");
    }
  }
  const ownedHabitQuery = useOwnedHabitQuery(habitId);
  const updateHabitMutation = useUpdateHabitMutation();
  const { accessMode, isValidating, refresh } = useTrialValidation();
  const isReadOnly = accessMode === "read_only";
  const hasHydratedFormRef = useRef(false);
  const submitLockRef = useRef(false);
  const tinyActionRef = useRef<TextInput>(null);
  const suggestionGuidance = getHabitSuggestionEditGuidance(suggestionType);

  const [title, setTitle] = useState("");
  const [identityPhrase, setIdentityPhrase] = useState("");
  const [cue, setCue] = useState("");
  const [tinyAction, setTinyAction] = useState("");
  const [minimumViableAction, setMinimumViableAction] = useState("");
  const [preferredTimeWindow, setPreferredTimeWindow] = useState("");
  const [icon, setIcon] = useState("");
  const [activeDays, setActiveDays] = useState<number[]>(ALL_DAYS);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [reminderTime, setReminderTime] = useState<string | null>(null);
  const [reminderReady, setReminderReady] = useState(false);
  const reminderLoadRef = useRef<"pending" | "loaded" | "failed">("pending");

  const formPayload = {
    title,
    identityPhrase,
    cue,
    tinyAction,
    minimumViableAction,
    preferredTimeWindow,
    icon,
    activeDays,
  };
  const normalizedPayload = normalizeHabitSetupPayload(formPayload);
  const validationErrors = useMemo(
    () => validateHabitSetupPayload(formPayload),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [title, identityPhrase, cue, tinyAction, minimumViableAction, preferredTimeWindow, icon, activeDays],
  );

  useEffect(() => {
    if (!ownedHabitQuery.data || hasHydratedFormRef.current) return;

    setTitle(ownedHabitQuery.data.title);
    setIdentityPhrase(ownedHabitQuery.data.identity_phrase ?? "");
    setCue(ownedHabitQuery.data.cue);
    setTinyAction(ownedHabitQuery.data.tiny_action);
    setMinimumViableAction(ownedHabitQuery.data.minimum_viable_action ?? "");
    setPreferredTimeWindow(ownedHabitQuery.data.preferred_time_window ?? "");
    setIcon(ownedHabitQuery.data.icon ?? "");
    setActiveDays(parseActiveDays(ownedHabitQuery.data.active_days));
    hasHydratedFormRef.current = true;

    if (fromRecovery) {
      setTimeout(() => { tinyActionRef.current?.focus(); }, 0);
    }

    // Load existing reminder — three-state sentinel prevents unknown state from cancelling it
    const id = Array.isArray(habitId) ? habitId[0] : habitId;
    if (id) {
      getReminderByHabitId(id).then((reminder) => {
        if (reminder && reminder.reminder_type !== "none" && reminder.reminder_time) {
          setReminderTime(reminder.reminder_time);
        }
        reminderLoadRef.current = "loaded";
        setReminderReady(true);
      }).catch(() => {
        // Load failed: we don't know if a reminder exists — mark as failed, not loaded
        reminderLoadRef.current = "failed";
        setReminderReady(true);
      });
    } else {
      reminderLoadRef.current = "loaded";
      setReminderReady(true);
    }
  }, [ownedHabitQuery.data, fromRecovery, habitId]);

  async function handleSave() {
    if (submitLockRef.current || updateHabitMutation.isPending || !ownedHabitQuery.data) return;
    setFormError(null);

    if (Object.keys(validationErrors).length > 0) {
      setFormError("Fix the highlighted fields before saving.");
      return;
    }

    submitLockRef.current = true;

    try {
      await updateHabitMutation.mutateAsync({
        habitId: ownedHabitQuery.data.id,
        payload: normalizedPayload,
      });

      if (user?.id) {
        const loadState = reminderLoadRef.current;
        if (reminderTime) {
          // User explicitly set a time — safe to schedule regardless of load state
          await scheduleReminder(
            ownedHabitQuery.data.id,
            user.id,
            "daily",
            reminderTime,
            activeDays,
          ).catch(() => {});
        } else if (loadState === "loaded") {
          // Load succeeded and reminderTime is null — user turned it off
          await cancelReminder(ownedHabitQuery.data.id).catch(() => {});
        }
        // loadState "pending" or "failed": skip cancelReminder — state is unknown
        await rescheduleAll(user.id).catch(() => {});
      }

      // Pop the Edit entry off the stack instead of replacing it with
      // another HabitDetail entry. Replace would create a duplicate
      // adjacent stack entry when the user came from HabitDetail → Edit
      // (the common case), forcing two back-chevron taps to leave the
      // habit. Fall back to replace only when there's no stack to pop
      // (deep-link or direct mount).
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace(`/(app)/habits/${ownedHabitQuery.data.id}`);
      }
    } catch {
      setFormError(getUpdateHabitErrorMessage());
    } finally {
      submitLockRef.current = false;
    }
  }

  const cleanCue = stripLeadingAfter(normalizedPayload.cue);
  const cleanAction = stripLeadingIWill(normalizedPayload.tinyAction);
  const preview = formatHabitFormula(normalizedPayload.cue, normalizedPayload.tinyAction);

  if (ownedHabitQuery.isLoading) {
    return <LoadingState message="Loading habit details..." />;
  }

  if (ownedHabitQuery.error || !ownedHabitQuery.data) {
    return (
      <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
        <ErrorState message={getLoadHabitDetailErrorMessage()} />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
    >
      {isReadOnly ? (
        <ReadOnlyBanner isReconnecting={isValidating} onReconnect={() => void refresh()} />
      ) : null}

      {/* Header */}
      <View style={{ paddingTop: insets.top + SCREEN_TOP_PADDING }}>
        <Pressable hitSlop={12} onPress={handleBack} style={styles.backButton}>
          <ChevronLeft size={22} color={colors.textMuted} strokeWidth={1.75} />
        </Pressable>
        <Text style={styles.headerTitle}>Edit habit</Text>
      </View>

      {/* Suggestion guidance */}
      {suggestionGuidance ? (
        <View style={styles.suggestionCard}>
          <Text style={styles.suggestionEyebrow}>SUGGESTED ADJUSTMENT</Text>
          <Text style={styles.suggestionTitle}>{suggestionGuidance.title}</Text>
          <Text style={styles.suggestionBody}>{suggestionGuidance.body}</Text>
          <Text style={styles.suggestionDraftLabel}>{suggestionGuidance.draftTitle}</Text>
          <Text style={styles.suggestionDraftBody}>{suggestionGuidance.draftBody}</Text>
          <Text style={styles.suggestionReasonLabel}>Why this suggestion</Text>
          <Text style={styles.suggestionReason}>{suggestionGuidance.reason}</Text>
        </View>
      ) : null}

      {/* Identity card */}
      {identityPhrase ? (
        <View style={styles.identityCard}>
          <Text style={styles.identityEyebrow}>IDENTITY</Text>
          <Text style={styles.identityPhrase}>{identityPhrase}</Text>
          <Text style={styles.identityHint}>Part of a goal · change in goal settings</Text>
        </View>
      ) : null}

      {/* Habit name + icon */}
      <View style={styles.section}>
        <Text style={styles.fieldLabel}>Habit name</Text>
        <View style={[styles.fieldRow, validationErrors.title ? styles.fieldError : null]}>
          <PenLine size={16} color={colors.primary} strokeWidth={1.5} />
          <TextInput
            style={styles.fieldInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Reading"
            placeholderTextColor={colors.textFaint}
            editable={!isReadOnly}
          />
          <Pressable onPress={() => setShowIconPicker((v) => !v)} style={styles.iconButton}>
            <LucideIcon
              name={icon || "Sparkles"}
              size={18}
              color={icon ? colors.primary : colors.textFaint}
              strokeWidth={1.8}
            />
          </Pressable>
        </View>
        {validationErrors.title ? (
          <Text style={styles.errorText}>{validationErrors.title}</Text>
        ) : null}
        {showIconPicker ? (
          <LucideIconPicker
            selected={icon || null}
            onSelect={(name) => { setIcon(name); setShowIconPicker(false); }}
          />
        ) : null}
      </View>

      {/* Cue */}
      <View style={styles.section}>
        <Text style={styles.fieldLabel}>
          Cue <Text style={styles.fieldHint}>— what triggers this habit?</Text>
        </Text>
        <View style={[styles.fieldRow, validationErrors.cue ? styles.fieldError : null]}>
          <PenLine size={16} color={colors.primary} strokeWidth={1.5} />
          <TextInput
            style={styles.fieldInput}
            value={cue}
            onChangeText={setCue}
            placeholder="After I brush my teeth"
            placeholderTextColor={colors.textFaint}
            editable={!isReadOnly}
          />
        </View>
        {validationErrors.cue ? (
          <Text style={styles.errorText}>{validationErrors.cue}</Text>
        ) : null}
      </View>

      {/* Tiny action */}
      <View style={styles.section}>
        <Text style={styles.fieldLabel}>
          Tiny action <Text style={styles.fieldHint}>— the smallest version</Text>
        </Text>
        <View style={[styles.fieldRow, validationErrors.tinyAction ? styles.fieldError : null]}>
          <PenLine size={16} color={colors.primary} strokeWidth={1.5} />
          <TextInput
            ref={tinyActionRef}
            style={styles.fieldInput}
            value={tinyAction}
            onChangeText={setTinyAction}
            placeholder="Read 1 page"
            placeholderTextColor={colors.textFaint}
            editable={!isReadOnly}
          />
        </View>
        {validationErrors.tinyAction ? (
          <Text style={styles.errorText}>{validationErrors.tinyAction}</Text>
        ) : null}
      </View>

      {/* Formula preview */}
      {preview !== "" ? (
        <View style={styles.formulaCard}>
          <Text style={styles.formulaEyebrow}>YOUR FORMULA</Text>
          <Text style={styles.formulaText}>
            After <Text style={styles.formulaHighlight}>{cleanCue}</Text>
            {", "}I will <Text style={styles.formulaHighlight}>{cleanAction}</Text>.
          </Text>
        </View>
      ) : null}

      {formError ? (
        <View style={styles.formErrorWrap}>
          <ErrorState message={formError} />
        </View>
      ) : null}

      <View style={styles.divider} />

      {/* Active days */}
      <View style={styles.section}>
        <ActiveDaysPicker value={activeDays} disabled={isReadOnly} onChange={setActiveDays} />
      </View>

      <View style={styles.divider} />

      {/* Reminder */}
      <ReminderPicker value={reminderTime} onChange={setReminderTime} disabled={!reminderReady} />

      {/* Save */}
      <Pressable
        style={({ pressed }) => [
          styles.saveButton,
          (updateHabitMutation.isPending || isReadOnly) && styles.saveButtonDisabled,
          pressed && styles.saveButtonPressed,
        ]}
        disabled={updateHabitMutation.isPending || isReadOnly}
        onPress={() => void handleSave()}
      >
        <Text style={styles.saveButtonText}>
          {updateHabitMutation.isPending ? "Saving…" : "Save changes"}
        </Text>
      </Pressable>

      {isReadOnly ? (
        <Text style={styles.readOnlyHelper}>Reconnect to edit habits.</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.bg,
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  headerTitle: {
    fontFamily: fontFamilies.displayBold,
    fontSize: 26,
    lineHeight: 32,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  // Suggestion card
  suggestionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  suggestionEyebrow: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 11,
    color: colors.textFaint,
    letterSpacing: 0.5,
  },
  suggestionTitle: {
    fontFamily: fontFamilies.displaySemi,
    fontSize: typography.headlineMd,
    color: colors.text,
  },
  suggestionBody: {
    fontFamily: fontFamilies.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  suggestionDraftLabel: {
    fontFamily: fontFamilies.bodySemi,
    fontSize: 13,
    lineHeight: 20,
    color: colors.text,
  },
  suggestionDraftBody: {
    fontFamily: fontFamilies.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  suggestionReasonLabel: {
    fontFamily: fontFamilies.bodySemi,
    fontSize: 13,
    lineHeight: 22,
    color: colors.text,
  },
  suggestionReason: {
    fontFamily: fontFamilies.body,
    fontSize: 14,
    lineHeight: 24,
    color: colors.textMuted,
  },
  // Identity card
  identityCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: 2,
  },
  identityEyebrow: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 11,
    color: colors.primary,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  identityPhrase: {
    fontFamily: fontFamilies.bodySemi,
    fontSize: 15,
    color: colors.text,
  },
  identityHint: {
    fontFamily: fontFamilies.body,
    fontSize: 12,
    color: colors.primary,
    opacity: 0.8,
    marginTop: 2,
  },
  // Fields
  section: {
    gap: spacing.sm,
  },
  fieldLabel: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 13,
    color: colors.textMuted,
  },
  fieldHint: {
    fontFamily: fontFamilies.body,
    fontSize: 13,
    color: colors.textFaint,
  },
  fieldRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  fieldError: {
    borderWidth: 1,
    borderColor: colors.danger,
  },
  fieldInput: {
    flex: 1,
    fontFamily: fontFamilies.body,
    fontSize: 15,
    color: colors.text,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.surfaceCard,
    borderWidth: 0.5,
    borderColor: colors.offDayBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    fontFamily: fontFamilies.body,
    fontSize: 12,
    color: colors.danger,
    marginTop: -spacing.xs,
  },
  // Formula card
  formulaCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.offDayBorder,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  formulaEyebrow: {
    fontFamily: fontFamilies.bodyMedium,
    fontSize: 11,
    color: colors.textFaint,
    letterSpacing: 0.5,
  },
  formulaText: {
    fontFamily: fontFamilies.body,
    fontSize: 15,
    color: colors.text,
    fontStyle: "italic",
    lineHeight: 22,
  },
  formulaHighlight: {
    fontFamily: fontFamilies.bodySemi,
    color: colors.primary,
    fontStyle: "italic",
  },
  formErrorWrap: {
    marginTop: -spacing.sm,
  },
  // Divider
  divider: {
    height: 1,
    backgroundColor: colors.offDayBorder,
    marginVertical: spacing.sm,
  },
  // Save button
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonPressed: {
    opacity: 0.85,
  },
  saveButtonText: {
    fontFamily: fontFamilies.bodySemi,
    fontSize: 15,
    color: colors.primaryText,
  },
  readOnlyHelper: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: 14,
    textAlign: "center",
  },
});
