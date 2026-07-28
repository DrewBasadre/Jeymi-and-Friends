import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, text } from '@/theme/tokens';
import { PeacockPhase, type PeacockPhaseNumber } from './PeacockPhase';

/**
 * The pixel peacock as a warm guide — used for onboarding, empty states, and
 * encouragement. Gentle idle bob that respects reduced motion.
 */
export function MascotPanel({
  title,
  body,
  phase,
  expression,
  size = 108,
  animate = true,
}: {
  title: string;
  body?: string;
  /** Which growth phase to show. Falls back to a phase derived from `expression`. */
  phase?: PeacockPhaseNumber;
  /** Legacy mood hint, mapped to a phase when `phase` is not given. */
  expression?: 'idle' | 'happy' | 'encouraging';
  size?: number;
  animate?: boolean;
}) {
  const resolvedPhase: PeacockPhaseNumber =
    phase ?? (expression === 'happy' ? 5 : expression === 'encouraging' ? 3 : 4);
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate) return;
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce || cancelled) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(bob, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(bob, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      );
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [animate, bob]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });

  return (
    <View style={styles.wrap}>
      <View style={styles.halo}>
        <Animated.View style={{ transform: [{ translateY }] }}>
          <PeacockPhase phase={resolvedPhase} size={size} />
        </Animated.View>
      </View>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  halo: {
    width: 148,
    height: 148,
    borderRadius: radius.round,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: { ...text.h2, color: colors.ink, textAlign: 'center' },
  body: {
    ...text.body,
    color: colors.inkMuted,
    textAlign: 'center',
    maxWidth: 300,
  },
});
