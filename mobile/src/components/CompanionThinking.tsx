import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Check, LoaderCircle } from 'lucide-react-native';
import { colors, motion, radius, spacing, text } from '@/theme/tokens';

const steps = [
  'Reading your learning context',
  'Checking child-safety rules',
  'Matching installed lessons',
  'Building your activity',
] as const;

export function CompanionThinking({
  prompt,
  complete,
}: {
  prompt: string;
  complete: boolean;
}) {
  const bubbleOpacity = useRef(new Animated.Value(0)).current;
  const bubbleRise = useRef(new Animated.Value(14)).current;
  const panelHeight = useRef(new Animated.Value(218)).current;
  const rowAnimations = useRef(
    steps.map(() => ({
      opacity: new Animated.Value(0),
      rise: new Animated.Value(10),
    })),
  ).current;
  const pulse = useRef(new Animated.Value(0.55)).current;
  const [completedSteps, setCompletedSteps] = useState(0);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(bubbleOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(bubbleRise, {
        toValue: 0,
        ...motion.easing.spring,
        useNativeDriver: true,
      }),
      Animated.stagger(
        300,
        rowAnimations.map((row) =>
          Animated.parallel([
            Animated.timing(row.opacity, {
              toValue: 1,
              duration: 180,
              useNativeDriver: true,
            }),
            Animated.spring(row.rise, {
              toValue: 0,
              ...motion.easing.spring,
              useNativeDriver: true,
            }),
          ]),
        ),
      ),
    ]).start();

    const timers = steps.map((_, index) =>
      setTimeout(() => setCompletedSteps(index + 1), 420 + index * 310),
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.55,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    pulseLoop.start();
    return () => {
      timers.forEach(clearTimeout);
      pulseLoop.stop();
    };
  }, [bubbleOpacity, bubbleRise, pulse, rowAnimations]);

  useEffect(() => {
    if (!complete) return;
    setCompletedSteps(steps.length);
    Animated.timing(panelHeight, {
      toValue: 58,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [complete, panelHeight]);

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[
          styles.userBubble,
          {
            opacity: bubbleOpacity,
            transform: [{ translateY: bubbleRise }],
          },
        ]}
      >
        <Text style={styles.userText}>{prompt}</Text>
      </Animated.View>
      <Animated.View style={[styles.panel, { height: panelHeight }]}>
        <View style={styles.panelHeader}>
          {complete ? (
            <Check size={18} color={colors.success} strokeWidth={3} />
          ) : (
            <Animated.View style={{ opacity: pulse }}>
              <LoaderCircle size={18} color={colors.primary} />
            </Animated.View>
          )}
          <Text style={styles.panelTitle}>
            {complete ? 'Answer ready' : 'Pavo is preparing'}
          </Text>
        </View>
        <View style={styles.steps}>
          {steps.map((step, index) => {
            const done = index < completedSteps;
            const animation = rowAnimations[index];
            if (!animation) return null;
            return (
              <Animated.View
                key={step}
                style={[
                  styles.stepRow,
                  {
                    opacity: animation.opacity,
                    transform: [{ translateY: animation.rise }],
                  },
                ]}
              >
                <View style={[styles.stepDot, done && styles.stepDone]}>
                  {done ? (
                    <Check size={11} color={colors.white} strokeWidth={3} />
                  ) : null}
                </View>
                <Text style={[styles.stepText, done && styles.stepTextDone]}>
                  {step}
                </Text>
              </Animated.View>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '88%',
    borderRadius: radius.lg,
    borderBottomRightRadius: radius.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  userText: { ...text.bodySm, color: colors.white },
  panel: {
    overflow: 'hidden',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surfaceSunken,
    padding: spacing.lg,
  },
  panelHeader: {
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  panelTitle: { ...text.bodyStrong, color: colors.ink },
  steps: { gap: spacing.md, marginTop: spacing.lg },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepDot: {
    width: 20,
    height: 20,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.outlineStrong,
    backgroundColor: colors.surface,
  },
  stepDone: {
    borderColor: colors.success,
    backgroundColor: colors.success,
  },
  stepText: { ...text.caption, color: colors.inkSubtle },
  stepTextDone: { color: colors.inkMuted },
});

