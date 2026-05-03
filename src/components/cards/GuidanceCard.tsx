import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/fontFamilies';
import { radius } from '@/theme/radius';

type GuidanceCardProps = {
  title: string;
  body: string;
  children?: React.ReactNode;
};

export function GuidanceCard({ title, body, children }: GuidanceCardProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {children != null && <View style={styles.examples}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 20,
    gap: 6,
  },
  title: {
    fontSize: 13,
    fontFamily: fontFamilies.bodyMedium,
    color: colors.primary,
  },
  body: {
    fontSize: 14,
    lineHeight: 22.4,
    fontFamily: fontFamilies.body,
    color: colors.textMuted,
  },
  examples: {
    gap: 8,
    marginTop: 4,
  },
});
