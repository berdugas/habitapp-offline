import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const insets = useSafeAreaInsets();

  const scrollArea = (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.body, { paddingTop: insets.top + spacing.lg }]}>
        {children}
      </View>
    </ScrollView>
  );

  const footerArea = (
    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + spacing.lg, spacing.xxxl) }]}>
      {footer}
    </View>
  );

  if (keyboardAware) {
    return (
      <View style={styles.root}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
        >
          {scrollArea}
        </KeyboardAvoidingView>
        {footerArea}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {scrollArea}
      {footerArea}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { flexGrow: 1 },
  body: { flex: 1, paddingHorizontal: spacing.xl },
  footer: { paddingHorizontal: spacing.xl },
});
