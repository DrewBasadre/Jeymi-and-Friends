import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, text } from '@/theme/tokens';
import { Peacock, type PeacockExpression } from './Peacock';

/**
 * The peacock as a warm guide — used for onboarding, empty states, and
 * encouragement. Gentle idle bob that respects reduced-motion.
 */
export function MascotPanel({
  title,
  body,
  expression = 'idle',
  size = 108,
  animate = true,
}: {
  title: string;
  body?: string;
  expression?: PeacockExpression;
  size?: number;
  animate?: boolean;
}) {
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate) return;
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce || cancelled) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(bob, {
            toValue: 1,
            duration: 1600,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(bob, {
            toValue: 0,
            duration: 1600,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
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
          <Peacock size={size} expression={expression} />
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
