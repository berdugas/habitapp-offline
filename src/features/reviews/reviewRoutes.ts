import { normalizeParam } from "@/utils/params";

export type ReturnTo = "today" | "habitDetail" | "goalDetail";

export function normalizeReturnTo(
  value: string | string[] | undefined,
): ReturnTo {
  const v = normalizeParam(value);
  if (v === "today") return "today";
  if (v === "habitDetail") return "habitDetail";
  return "goalDetail";
}

export function goalReviewRoute(identityPhrase: string, returnTo: ReturnTo) {
  return {
    pathname: "/(app)/reviews/goal/[identityPhrase]" as const,
    params: {
      identityPhrase: encodeURIComponent(identityPhrase),
      returnTo,
    },
  };
}

export function weeklyReviewIntroRoute(
  identityPhrase: string,
  returnTo: ReturnTo,
) {
  return {
    pathname: "/(app)/reviews/intro" as const,
    params: {
      identityPhrase: encodeURIComponent(identityPhrase),
      returnTo,
    },
  };
}
