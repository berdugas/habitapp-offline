import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Eye, EyeOff } from "lucide-react-native";

import { AppLogo } from "@/components/branding/AppLogo";
import { PrimaryButton } from "@/components/buttons/PrimaryButton";
import { TextField } from "@/components/forms/TextField";
import { OnboardingLayout } from "@/components/layouts/OnboardingLayout";
import { signInWithPassword } from "@/features/auth/api";
import { logger } from "@/services/logger";
import { useTheme } from "@/theme/useTheme";
import { useThemedStyles } from "@/theme/useThemedStyles";
import { isBlank, isLikelyEmail } from "@/utils/validation";
import {
  getSignInErrorMessage,
  isInvalidLoginCredentialsError,
} from "@/utils/userFacingErrors";

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const theme = useTheme();
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      brandRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 9,
        marginBottom: 48,
      },
      brandName: {
        fontFamily: t.fontFamilies.displaySemi,
        fontSize: t.typography.labelMd,
        color: t.colors.primary,
        letterSpacing: 0.84,
        textTransform: "uppercase",
      },
      headline: {
        fontFamily: t.fontFamilies.displayBold,
        fontSize: 30,
        lineHeight: 35.4,
        color: t.colors.text,
        marginBottom: 12,
      },
      subhead: {
        fontFamily: t.fontFamilies.body,
        fontSize: 15,
        lineHeight: 23,
        color: t.colors.textMuted,
        marginBottom: 28,
      },
      formCard: {
        backgroundColor: t.colors.surface,
        borderRadius: t.radius.lg,
        paddingTop: 28,
        paddingHorizontal: t.spacing.xl,
        paddingBottom: 32,
        gap: t.spacing.lg,
      },
      error: {
        fontFamily: t.fontFamilies.body,
        fontSize: t.typography.bodyMd,
        color: t.colors.danger,
      },
      fieldWrapper: {
        gap: t.spacing.sm,
      },
      fieldLabel: {
        fontFamily: t.fontFamilies.bodyMedium,
        fontSize: t.typography.labelMd,
        color: t.colors.textMuted,
      },
      passwordRow: {
        backgroundColor: t.colors.surfaceHigh,
        borderRadius: t.radius.md,
        paddingHorizontal: 18,
        paddingVertical: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      },
      passwordInput: {
        flex: 1,
        fontFamily: t.fontFamilies.body,
        fontSize: 15,
        color: t.colors.text,
        padding: 0,
      },
      forgotRow: {
        alignItems: "flex-end",
        marginTop: -t.spacing.sm,
      },
      forgotText: {
        fontFamily: t.fontFamilies.bodyMedium,
        fontSize: t.typography.labelMd,
        color: t.colors.primary,
      },
      createLink: {
        alignItems: "center",
        paddingVertical: t.spacing.md,
      },
      createLinkText: {
        fontFamily: t.fontFamilies.bodySemi,
        fontSize: t.typography.bodyMd,
        color: t.colors.primary,
      },
    }),
  );

  async function handleSubmit() {
    if (submitLockRef.current) return;

    if (isBlank(email)) { setError("Email is required."); return; }
    if (!isLikelyEmail(email)) { setError("Enter a valid email address."); return; }
    if (isBlank(password)) { setError("Password is required."); return; }

    submitLockRef.current = true;
    setIsSubmitting(true);
    setError(null);

    try {
      const { error: authError } = await signInWithPassword(email.trim(), password);
      if (authError) {
        if (isInvalidLoginCredentialsError(authError)) {
          logger.warn("Sign-in rejected by Supabase", { reason: "invalid_credentials" });
        } else {
          logger.error("Failed to sign in", { authError });
        }
        setError(getSignInErrorMessage(authError));
        return;
      }
      router.replace("/");
    } catch (unexpectedError) {
      logger.error("Sign-in request threw unexpectedly", { email: email.trim(), unexpectedError });
      setError(getSignInErrorMessage(unexpectedError));
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
          onPress={() => router.push("/(auth)/sign-up")}
          style={styles.createLink}
        >
          <Text style={styles.createLinkText}>Create an account</Text>
        </Pressable>
      }
    >
      {/* Branded header */}
      <View style={styles.brandRow}>
        <AppLogo size={24} />
        <Text style={styles.brandName}>Habitapp</Text>
      </View>

      <Text style={styles.headline}>Welcome back.</Text>
      <Text style={styles.subhead}>Pick up where you left off.</Text>

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

        {/* Password with eye toggle */}
        <View style={styles.fieldWrapper}>
          <Text style={styles.fieldLabel}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              autoCapitalize="none"
              placeholder="Your password"
              placeholderTextColor={theme.colors.textFaint}
              secureTextEntry={!showPassword}
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
            />
            <Pressable
              hitSlop={8}
              onPress={() => setShowPassword((v) => !v)}
            >
              {showPassword
                ? <EyeOff color={theme.colors.textFaint} size={18} strokeWidth={1.5} />
                : <Eye color={theme.colors.textFaint} size={18} strokeWidth={1.5} />
              }
            </Pressable>
          </View>
        </View>

        <Pressable style={styles.forgotRow}>
          <Text style={styles.forgotText}>Forgot password?</Text>
        </Pressable>

        <PrimaryButton
          disabled={isSubmitting}
          label={isSubmitting ? "Signing in..." : "Sign in"}
          showArrow
          onPress={handleSubmit}
        />
      </View>
    </OnboardingLayout>
  );
}
