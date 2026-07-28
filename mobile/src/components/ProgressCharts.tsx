import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/theme/tokens';

export function MiniBarChart({
  points,
  suffix = '',
  color = colors.indigo,
  emptyLabel = 'No activity',
}: {
  points: Array<{ label: string; value: number }>;
  suffix?: string;
  color?: string;
  emptyLabel?: string;
}) {
  const maxValue = Math.max(1, ...points.map((point) => point.value));
  return (
    <View style={styles.chart}>
      {points.map((point) => (
        <View key={point.label} style={styles.column}>
          <Text style={styles.value}>
            {point.value > 0 ? `${Math.round(point.value)}${suffix}` : ''}
          </Text>
          <View style={styles.track}>
            {point.value > 0 ? (
              <View
                style={[
                  styles.bar,
                  {
                    backgroundColor: color,
                    height: `${Math.max(8, (point.value / maxValue) * 100)}%`,
                  },
                ]}
              />
            ) : (
              <View style={styles.emptyBar} />
            )}
          </View>
          <Text numberOfLines={1} style={styles.label}>
            {point.label}
          </Text>
        </View>
      ))}
      {points.every((point) => point.value === 0) ? (
        <Text style={styles.empty}>{emptyLabel}</Text>
      ) : null}
    </View>
  );
}

export function ActivityWeek({
  days,
}: {
  days: Array<{ label: string; active: boolean }>;
}) {
  return (
    <View style={styles.activityRow}>
      {days.map((day) => (
        <View key={day.label} style={styles.activityDay}>
          <View
            accessibilityLabel={`${day.label}: ${day.active ? 'active' : 'no activity'}`}
            style={[styles.dot, day.active && styles.dotActive]}
          />
          <Text style={styles.label}>{day.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function ProgressBar({
  value,
  color = colors.indigo,
}: {
  value: number;
  color?: string;
}) {
  const bounded = Math.max(0, Math.min(100, value));
  return (
    <View
      accessibilityLabel={`${Math.round(bounded)} percent complete`}
      style={styles.progressTrack}
    >
      <View
        style={[
          styles.progressFill,
          { backgroundColor: color, width: `${bounded}%` },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  chart: {
    flexDirection: 'row',
    gap: spacing.sm,
    height: 170,
    position: 'relative',
  },
  column: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  value: {
    color: colors.inkMuted,
    fontSize: 10,
    fontWeight: '800',
    height: 15,
  },
  track: {
    alignItems: 'stretch',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    flex: 1,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    width: '100%',
  },
  bar: { borderRadius: radius.sm, minHeight: 8, width: '100%' },
  emptyBar: { backgroundColor: colors.outline, height: 2, width: '100%' },
  label: {
    color: colors.inkMuted,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  empty: {
    color: colors.inkMuted,
    fontSize: 13,
    fontWeight: '700',
    left: 0,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
    top: 72,
  },
  activityRow: { flexDirection: 'row', gap: spacing.sm },
  activityDay: { alignItems: 'center', flex: 1, gap: spacing.sm },
  dot: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.outline,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 32,
    width: '100%',
  },
  dotActive: {
    backgroundColor: colors.emerald,
    borderColor: colors.emerald,
  },
  progressTrack: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    height: 14,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: { height: '100%' },
});
