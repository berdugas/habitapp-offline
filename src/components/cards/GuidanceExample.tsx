import { StyleSheet, Text, View } from 'react-native';

import { useThemedStyles } from '@/theme/useThemedStyles';

type GuidanceExampleProps = {
  context?: string;
  good?: string;
  bad?: string;
  before?: string;
  after?: string;
  trigger?: string;
  action?: string;
};

export function GuidanceExample({
  context,
  good,
  bad,
  before,
  after,
  trigger,
  action,
}: GuidanceExampleProps) {
  const styles = useThemedStyles((t) =>
    StyleSheet.create({
      container: {
        backgroundColor: t.colors.surfaceHigh,
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 14,
        gap: 4,
      },
      context: {
        fontSize: 12,
        fontFamily: t.fontFamilies.body,
        color: t.colors.textFaint,
        marginBottom: 2,
      },
      row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
      },
      badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
      },
      triggerBadge: {
        backgroundColor: t.colors.primary,
        borderRadius: 999,
        paddingVertical: 4,
        paddingHorizontal: 10,
      },
      triggerText: {
        fontSize: 12,
        fontFamily: t.fontFamilies.bodySemi,
        color: t.colors.primaryText,
      },
      actionBadge: {
        backgroundColor: t.colors.primaryLight,
        borderRadius: 999,
        paddingVertical: 4,
        paddingHorizontal: 10,
      },
      actionText: {
        fontSize: 12,
        fontFamily: t.fontFamilies.bodySemi,
        color: t.colors.primary,
      },
      arrow: {
        fontSize: t.typography.labelMd,
        color: t.colors.textFaint,
        fontFamily: t.fontFamilies.body,
      },
      beforeText: {
        fontSize: t.typography.bodyMd,
        fontFamily: t.fontFamilies.body,
        color: t.colors.textFaint,
      },
      goodText: {
        fontSize: t.typography.bodyMd,
        fontFamily: t.fontFamilies.body,
        color: t.colors.text,
      },
      badText: {
        fontSize: t.typography.bodyMd,
        fontFamily: t.fontFamilies.body,
        color: t.colors.textFaint,
      },
    }),
  );

  return (
    <View style={styles.container}>
      {context != null && <Text style={styles.context}>{context}</Text>}

      {trigger != null && action != null && (
        <View style={styles.badgeRow}>
          <View style={styles.triggerBadge}>
            <Text style={styles.triggerText}>{trigger}</Text>
          </View>
          <Text style={styles.arrow}>→</Text>
          <View style={styles.actionBadge}>
            <Text style={styles.actionText}>{action}</Text>
          </View>
        </View>
      )}

      {before != null && after != null && (
        <View style={styles.row}>
          <Text style={styles.beforeText}>{before}</Text>
          <Text style={styles.goodText}>{after}</Text>
        </View>
      )}

      {good != null && <Text style={styles.goodText}>✓ {good}</Text>}
      {bad != null && <Text style={styles.badText}>✗ {bad}</Text>}
    </View>
  );
}
