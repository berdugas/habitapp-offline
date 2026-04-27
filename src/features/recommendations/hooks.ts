import { useMutation } from "@tanstack/react-query";

import { FEATURE_FLAGS } from "@/config/featureFlags";
import { generateHabitRewrite } from "@/features/recommendations/aiRewriteApi";

import type { GenerateHabitRewriteClientRequest } from "@/features/recommendations/aiRewriteApi";

const AI_REWRITE_DISABLED_ERROR =
  "AI rewrite is disabled for the current product phase.";

export function useGenerateHabitRewriteMutation() {
  return useMutation({
    mutationFn: (input: GenerateHabitRewriteClientRequest) => {
      if (!FEATURE_FLAGS.aiRewrite) {
        return Promise.reject(new Error(AI_REWRITE_DISABLED_ERROR));
      }

      return generateHabitRewrite(input);
    },
  });
}
