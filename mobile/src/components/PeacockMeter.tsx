import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors, elevation, radius, spacing, text } from '@/theme/tokens';
import { PixelPeacock, peacockTier } from '@/components/mascot';
import { ProgressBar } from '@/components/ui';

/**
 * The learner's performance peacock: a gamified hero that reflects overall
 * score. The peacock unfurls its feathers and brightens as the score climbs,
 * and droops when it's low — a friendly, at-a-glance sense of "how am I doing".
 */
export function PeacockMeter({
  score,
  caption = 'Overall performance',
}: {
  score: number;
  caption?: string;
}) {
  const { stage, tier, blurb } = peacockTier(score);
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
            <PixelPeacock size={104} stage={stage} accessibilityLabel={`Your peacock is ${tier}`} />
          </Animated.View>
        </View>
        <View style={styles.flex}>
          <Text style={styles.overline}>YOUR PEACOCK</Text>
          <Text style={styles.tier}>{tier}</Text>
          <Text style={styles.blurb}>{blurb}</Text>
        </View>
      </View>
      <View style={styles.meter}>
        <ProgressBar value={score / 100} height={12} trackColor={colors.surface} />
        <View style={styles.meterRow}>
          <Text style={styles.caption}>{caption}</Text>
          <Text style={styles.score}>{Math.round(score)}%</Text>
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
