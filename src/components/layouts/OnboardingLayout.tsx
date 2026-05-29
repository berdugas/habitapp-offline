import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/useTheme';
import { useThemedStyles } from '@/theme/useThemedStyles';

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
  const theme = useTheme();
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      flex: { flex: 1 },
      root: { flex: 1, backgroundColor: t.colors.bg },
      scrollContent: { flexGrow: 1 },
      body: { flex: 1, paddingHorizontal: t.spacing.xl },
      footer: { paddingHorizontal: t.spacing.xl },
    }),
  );

  const scrollArea = (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.body, { paddingTop: insets.top + theme.spacing.lg }]}>
        {children}
      </View>
    </ScrollView>
  );

  const footerArea = (
    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + theme.spacing.lg, theme.spacing.xxxl) }]}>
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
