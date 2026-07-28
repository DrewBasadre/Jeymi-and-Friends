import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { colors, motion } from '@/theme/tokens';

const PIECES = 14;
const CONFETTI_COLORS = [
  colors.gradientStart,
  colors.gradientEnd,
  colors.accent,
  colors.success,
  colors.secondary,
];

/**
 * A tasteful, skippable confetti burst. Non-blocking (absolute-fill,
 * pointerEvents none), auto-clears, and fully suppressed when the user
 * prefers reduced motion. Mount it conditionally on a completion moment.
 */
export function Celebrate({ trigger }: { trigger: number }) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduceMotion(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  if (reduceMotion || !trigger) return null;
  return <Burst key={trigger} />;
}

function Burst() {
  const pieces = useRef(
    Array.from({ length: PIECES }, (_, i) => ({
      key: i,
      x: (i / PIECES) * 100,
      delay: (i % 5) * 40,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      drift: (i % 2 === 0 ? 1 : -1) * (20 + (i % 4) * 12),
      progress: new Animated.Value(0),
    })),
  ).current;

  useEffect(() => {
    Animated.parallel(
      pieces.map((p) =>
        Animated.timing(p.progress, {
          toValue: 1,
          duration: motion.duration.celebrate,
          delay: p.delay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [pieces]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p) => (
        <Animated.View
          key={p.key}
          style={{
            position: 'absolute',
            top: '30%',
            left: `${p.x}%`,
            width: 9,
            height: 9,
            borderRadius: 2,
            backgroundColor: p.color,
            opacity: p.progress.interpolate({
              inputRange: [0, 0.1, 0.85, 1],
              outputRange: [0, 1, 1, 0],
            }),
            transform: [
              {
                translateY: p.progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 320],
                }),
              },
              {
                translateX: p.progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, p.drift],
                }),
              },
              {
                rotate: p.progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '320deg'],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}
