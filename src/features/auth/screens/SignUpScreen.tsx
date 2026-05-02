import { useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { ZenCard } from "@/components/cards/ZenCard";
import { ErrorState } from "@/components/feedback/ErrorState";
import { TextField } from "@/components/forms/TextField";
import { signUpWithPassword } from "@/features/auth/api";
import { logger } from "@/services/logger";
import { colors } from "@/theme/colors";
import { fontFamilies } from "@/theme/fontFamilies";
import { spacing } from "@/theme/spacing";
import { typography } from "@/theme/typography";
import {
  isBlank,
  isLikelyEmail,
} from "@/utils/validation";
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
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
    >
      <View style={styles.header}>
        <Text selectable style={styles.headline}>
          Become someone different.
        </Text>
        <Text selectable style={styles.subhead}>
          Start with one habit. Build from there.
        </Text>
      </View>

      <ZenCard padding="xxl">
        {error ? <ErrorState message={error} /> : null}
        <TextField
          autoCapitalize="none"
          label="Email"
          onChangeText={setEmail}
          placeholder="you@example.com"
          value={email}
        />
        <TextField
          autoCapitalize="none"
          label="Password"
          onChangeText={setPassword}
          placeholder="Choose a password"
          secureTextEntry
          value={password}
        />
        <PrimaryButton
          disabled={isSubmitting}
          label={isSubmitting ? "Creating account..." : "Sign Up"}
          onPress={handleSubmit}
        />
        <SecondaryButton
          disabled={isSubmitting}
          label="I already have an account"
          onPress={() => router.push("/(auth)/sign-in")}
        />
      </ZenCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.xl,
    padding: spacing.xl,
  },
  header: {
    gap: spacing.sm,
  },
  headline: {
    color: colors.text,
    fontFamily: fontFamilies.displayBold,
    fontSize: typography.displayLg,
  },
  screen: {
    backgroundColor: colors.bg,
    flex: 1,
  },
  subhead: {
    color: colors.textMuted,
    fontFamily: fontFamilies.body,
    fontSize: typography.bodyLg,
    lineHeight: 24,
  },
});
