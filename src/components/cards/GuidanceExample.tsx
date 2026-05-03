import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { fontFamilies } from '@/theme/fontFamilies';

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

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 4,
  },
  context: {
    fontSize: 12,
    fontFamily: fontFamilies.body,
    color: colors.textFaint,
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
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  triggerText: {
    fontSize: 12,
    fontFamily: fontFamilies.bodySemi,
    color: colors.primaryText,
  },
  actionBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  actionText: {
    fontSize: 12,
    fontFamily: fontFamilies.bodySemi,
    color: colors.primary,
  },
  arrow: {
    fontSize: 13,
    color: colors.textFaint,
    fontFamily: fontFamilies.body,
  },
  beforeText: {
    fontSize: 14,
    fontFamily: fontFamilies.body,
    color: colors.textFaint,
  },
  goodText: {
    fontSize: 14,
    fontFamily: fontFamilies.body,
    color: colors.text,
  },
  badText: {
    fontSize: 14,
    fontFamily: fontFamilies.body,
    color: colors.textFaint,
  },
});
