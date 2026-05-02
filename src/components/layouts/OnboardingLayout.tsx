import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

type OnboardingLayoutProps = {
  children: React.ReactNode;
  footer: React.ReactNode;
  keyboardAware?: boolean;
};

export function OnboardingLayout({
  children,
  footer,
  keyboardAware = false,
}: OnboardingLayoutProps) {
  const inner = (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.body}>{children}</View>
      </ScrollView>
      <View style={styles.footer}>{footer}</View>
    </View>
  );

  if (keyboardAware) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        {inner}
      </KeyboardAvoidingView>
    );
  }

  return inner;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { flexGrow: 1 },
  body: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  footer: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
});
