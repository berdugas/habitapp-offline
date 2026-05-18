import type { RetroLogReason } from "@/features/habits/api";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "";
}

export function isInvalidLoginCredentialsError(error: unknown) {
  return getErrorMessage(error).toLowerCase().includes("invalid login credentials");
}

export function isExpectedSignUpAuthError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();

  return (
    message.includes("already registered") ||
    message.includes("invalid email") ||
    message.includes("email is invalid") ||
    message.includes("password")
  );
}

export function getSignInErrorMessage(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();

  if (message.includes("invalid login credentials")) {
    return "We couldn't sign you in. Check your email and password and try again.";
  }

  return "We couldn't sign you in right now. Try again.";
}

export function getSignUpErrorMessage(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();

  if (message.includes("already registered")) {
    return "That email already has an account. Sign in instead or use a different email.";
  }

  if (message.includes("invalid email") || message.includes("email is invalid")) {
    return "Enter a valid email address and try again.";
  }

  if (message.includes("password")) {
    return "Choose a stronger password and try again.";
  }

  return "We couldn't create your account right now. Try again.";
}

export function getCreateHabitErrorMessage() {
  return "We couldn't save your habit right now. Try again.";
}

export function getRefreshHabitsErrorMessage() {
  return "We saved your habit, but we couldn't refresh Today right now. Try again.";
}

export function getLoadHabitsErrorMessage() {
  return "We couldn't load your habits right now. Try again.";
}

export function getLoadHabitDetailErrorMessage() {
  return "We couldn't load this habit right now. Try again.";
}

export function getLoadWeeklyReviewErrorMessage() {
  return "We couldn't load this weekly review right now. Try again.";
}

export function getLoadInactiveHabitsErrorMessage() {
  return "We couldn't load inactive habits right now. Try again.";
}

export function getSaveWeeklyReviewErrorMessage() {
  return "We couldn't save your weekly review right now. Try again.";
}

export function getLoadGraduationErrorMessage() {
  return "We couldn't load this habit's graduation right now. Try again.";
}

export function getSaveGraduationErrorMessage() {
  return "We couldn't save your graduation response right now. Try again.";
}

export function getSaveTodayStatusErrorMessage() {
  return "We couldn't save today's status right now. Try again.";
}

export function getUpdateHabitErrorMessage() {
  return "We couldn't save your changes right now. Try again.";
}

export function getUpdateHabitActiveStateErrorMessage() {
  return "We couldn't update this habit right now. Try again.";
}

export function getDeleteHabitErrorMessage() {
  return "We couldn't delete this habit right now. Try again.";
}

export function getDeleteGoalErrorMessage() {
  return "We couldn't delete this goal right now. Try again.";
}

export function getArchiveGoalErrorMessage() {
  return "We couldn't archive this goal right now. Try again.";
}

export function getRestoreGoalErrorMessage() {
  return "We couldn't restore this goal right now. Try again.";
}

export function getGenerateHabitRewriteErrorMessage() {
  return "We couldn't generate a rewrite right now. You can still edit this habit manually.";
}

export function getRetroLogOutsideWindowErrorMessage() {
  return "This day was more than 48 hours ago. It's locked.";
}

export function getRetroLogBeforeStartDateErrorMessage() {
  return "This day is before your habit started.";
}

export function getRetroLogFutureDateErrorMessage() {
  return "That day hasn't happened yet.";
}

export function getRetroLogHabitArchivedErrorMessage() {
  return "This habit is archived. Reactivate it to log.";
}

export function getRetroLogErrorMessage(reason: RetroLogReason): string {
  switch (reason) {
    case "outside_window":
      return getRetroLogOutsideWindowErrorMessage();
    case "before_start_date":
      return getRetroLogBeforeStartDateErrorMessage();
    case "future_date":
      return getRetroLogFutureDateErrorMessage();
    case "habit_archived":
      return getRetroLogHabitArchivedErrorMessage();
  }
}
