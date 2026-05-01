import { useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/buttons/SecondaryButton";
import { ErrorState } from "@/components/feedback/ErrorState";
import { TextField } from "@/components/forms/TextField";
import { signInWithPassword } from "@/features/auth/api";
import { logger } from "@/services/logger";
import { colors } from "@/theme/colors";
import { radius } from "@/theme/radius";
import { spacing } from "@/theme/spacing";
import {
  isBlank,
  isLikelyEmail,
} from "@/utils/validation";
import {
  getSignInErrorMessage,
  isInvalidLoginCredentialsError,
} from "@/utils/userFacingErrors";

export default function SignInScreen() {
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
      const { error: authError } = await signInWithPassword(
        email.trim(),
        password,
      );

      if (authError) {
        if (isInvalidLoginCredentialsError(authError)) {
          logger.warn("Sign-in rejected by Supabase", {
            reason: "invalid_credentials",
          });
        } else {
          logger.error("Failed to sign in", { authError });
        }
        setError(getSignInErrorMessage(authError));
        return;
      }

      router.replace("/");
    } catch (unexpectedError) {
      logger.error("Sign-in request threw unexpectedly", {
        email: email.trim(),
        unexpectedError,
      });
      setError(getSignInErrorMessage(unexpectedError));
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
      <View style={styles.copy}>
        <Text selectable style={styles.title}>
          Welcome back
        </Text>
        <Text selectable style={styles.body}>
          Sign in to keep working on your habit foundation.
        </Text>
      </View>

      <View style={styles.formCard}>
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
          placeholder="Your password"
          secureTextEntry
          value={password}
        />
        <PrimaryButton
          disabled={isSubmitting}
          label={isSubmitting ? "Signing in..." : "Sign In"}
          onPress={handleSubmit}
        />
        <SecondaryButton
          disabled={isSubmitting}
          label="Create an account"
          onPress={() => router.push("/(auth)/sign-up")}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
  },
  content: {
    gap: spacing.xl,
    padding: spacing.xl,
  },
  copy: {
    gap: spacing.sm,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderColor: 'transparent',
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.xl,
  },
  screen: {
    backgroundColor: colors.bg,
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
});
