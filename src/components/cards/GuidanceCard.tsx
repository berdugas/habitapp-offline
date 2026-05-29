import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useThemedStyles } from '@/theme/useThemedStyles';

type GuidanceCardProps = {
  title: string;
  body: string;
  children?: React.ReactNode;
};

export function GuidanceCard({ title, body, children }: GuidanceCardProps) {
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      container: {
        backgroundColor: t.colors.surface,
        borderRadius: t.radius.md,
        padding: 20,
        gap: 6,
      },
      title: {
        fontSize: t.typography.labelMd,
        fontFamily: t.fontFamilies.bodyMedium,
        color: t.colors.primary,
      },
      body: {
        fontSize: t.typography.bodyMd,
        lineHeight: 20.8,
        fontFamily: t.fontFamilies.body,
        color: t.colors.textMuted,
      },
      examples: {
        gap: 8,
        marginTop: 4,
      },
    }),
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {children != null && <View style={styles.examples}>{children}</View>}
    </View>
  );
}
