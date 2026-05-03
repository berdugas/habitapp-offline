import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { TextField } from "@/components/forms/TextField";
import { OnboardingLayout } from "@/components/layouts/OnboardingLayout";
import { BackButton } from "@/components/navigation/BackButton";
import { signUpWithPassword } from "@/features/auth/api";
import { logger } from "@/services/logger";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";
import { isBlank, isLikelyEmail } from "@/utils/validation";
import {
  getSignUpErrorMessage,
  isExpectedSignUpAuthError,
} from "@/utils/userFacingErrors";

export default function SignUpScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  async function handleSubmit() {
    if (submitLockRef.current) {
      return;
    }

    if (isBlank(email)) {
      setError("Email is required.");
      return;
    }

    if (!isLikelyEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }

    if (isBlank(password)) {
      setError("Password is required.");
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    setError(null);

    try {
      const { data, error: authError } = await signUpWithPassword(
        email.trim(),
        password,
      );

      if (authError) {
        if (isExpectedSignUpAuthError(authError)) {
          logger.warn("Sign-up rejected by Supabase", {
            reason: "validation_or_existing_account",
          });
        } else {
          logger.error("Failed to sign up", { authError });
        }
        setError(getSignUpErrorMessage(authError));
        return;
      }

      if (data.session) {
        router.replace("/");
        return;
      }

      logger.error("Sign-up completed without a session", {
        attemptedEmail: email.trim(),
      });
      setError(
        "Sign-up did not return a session. For MVP testing, Supabase email confirmation must be OFF. Verify the hosted Supabase auth setting and try again.",
      );
    } catch (unexpectedError) {
      logger.error("Sign-up request threw unexpectedly", {
        email: email.trim(),
        unexpectedError,
      });
      setError(getSignUpErrorMessage(unexpectedError));
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <OnboardingLayout
      keyboardAware
      footer={
        <Pressable
          onPress={() => router.push("/(auth)/sign-in")}
          style={styles.signInLink}
        >
          <Text style={styles.signInText}>I already have an account</Text>
        </Pressable>
      }
    >
      <View style={styles.backRow}>
        <BackButton onPress={() => router.back()} />
      </View>

      <Text style={styles.headline}>
        The person you want to be starts here.
      </Text>
      <Text style={styles.subhead}>One habit at a time.</Text>

      <View style={styles.formCard}>
        {error != null && (
          <Text style={styles.error}>{error}</Text>
        )}
        <TextField
          autoCapitalize="none"
          label="Email"
          placeholder="you@example.com"
          value={email}
          variant="onboarding"
          onChangeText={setEmail}
        />
        <TextField
          autoCapitalize="none"
          label="Password"
          placeholder="Choose a password"
          secureTextEntry
          value={password}
          variant="onboarding"
          onChangeText={setPassword}
        />
        <PrimaryButton
          disabled={isSubmitting}
          label={isSubmitting ? "Creating account..." : "Sign up"}
          showArrow
          onPress={handleSubmit}
        />
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  backRow: {
    marginBottom: 44,
  },
  headline: {
    fontFamily: fontFamilies.displayBold,
    fontSize: 30,
    lineHeight: 35.4,
    color: colors.text,
    marginBottom: 8,
  },
  subhead: {
    fontFamily: fontFamilies.body,
    fontSize: 15,
    lineHeight: 23.25,
    color: colors.textMuted,
    marginBottom: 24,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingTop: 28,
    paddingHorizontal: spacing.xl,
    paddingBottom: 32,
    gap: spacing.lg,
  },
  error: {
    fontFamily: fontFamilies.body,
    fontSize: 14,
    color: colors.danger,
  },
  signInLink: {
    alignItems: "center",
    paddingVertical: spacing.md,
  },
  signInText: {
    fontFamily: fontFamilies.bodySemi,
    fontSize: 14,
    color: colors.primary,
  },
});
