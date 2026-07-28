import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors, elevation, radius, spacing, text } from '@/theme/tokens';
import { PeacockPhase, peacockPhase } from '@/components/mascot';
import { ProgressBar } from '@/components/ui';

/**
 * The learner's growth peacock: a gamified hero that shows how far the student
 * has come. The peacock matures through 5 phases as they complete lessons and
 * build mastery — a friendly, at-a-glance sense of progress.
 */
export function PeacockMeter({
  completedModules,
  totalModules,
  averageScore,
}: {
  completedModules: number;
  totalModules: number;
  averageScore: number;
}) {
  const { phase, name, blurb } = peacockPhase({ completedModules, totalModules, averageScore });
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce || cancelled) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(bob, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(bob, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      );
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [bob]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.stage}>
          <Animated.View style={{ transform: [{ translateY }] }}>
            <PeacockPhase phase={phase} size={104} accessibilityLabel={`Your peacock, ${name}, phase ${phase} of 5`} />
          </Animated.View>
        </View>
        <View style={styles.flex}>
          <Text style={styles.overline}>Your Peacock · Phase {phase} of 5</Text>
          <Text style={styles.tier}>{name}</Text>
          <Text style={styles.blurb}>{blurb}</Text>
          <View style={styles.pips}>
            {[1, 2, 3, 4, 5].map((p) => (
              <View key={p} style={[styles.pip, p <= phase && styles.pipOn]} />
            ))}
          </View>
        </View>
      </View>
      <View style={styles.meter}>
        <ProgressBar value={averageScore / 100} height={12} trackColor={colors.surface} />
        <View style={styles.meterRow}>
          <Text style={styles.caption}>Overall performance</Text>
          <Text style={styles.score}>{Math.round(averageScore)}%</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    ...elevation.e2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stage: {
    width: 116,
    height: 116,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, minWidth: 0 },
  overline: { ...text.overline, color: colors.gradientStart },
  tier: { ...text.h1, color: colors.white, fontSize: 26 },
  blurb: { ...text.body, color: 'rgba(255,255,255,0.9)', fontSize: 14, marginTop: 2 },
  pips: { flexDirection: 'row', gap: 6, marginTop: spacing.sm },
  pip: { width: 20, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)' },
  pipOn: { backgroundColor: colors.accent },
  meter: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  meterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  caption: { ...text.caption, color: 'rgba(255,255,255,0.9)' },
  score: { ...text.title, color: colors.white },
});
