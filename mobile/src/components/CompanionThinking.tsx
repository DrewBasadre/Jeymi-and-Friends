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

/** Student-context process steps — the default shown to learners. */
const DEFAULT_STEPS = [
  'Reading your learning context',
  'Checking child-safety rules',
  'Matching installed lessons',
  'Building your activity',
] as const;

export function CompanionThinking({
  prompt,
  complete,
  steps = DEFAULT_STEPS,
}: {
  prompt: string;
  complete: boolean;
  /** Process steps to reveal. Pass a role-specific set (e.g. teacher). */
  steps?: readonly string[];
}) {
  const bubbleOpacity = useRef(new Animated.Value(0)).current;
  const bubbleRise = useRef(new Animated.Value(12)).current;
  const panelHeight = useRef(new Animated.Value(218)).current;
  const panelOpacity = useRef(new Animated.Value(1)).current;
  const panelExit = useRef(new Animated.Value(0)).current;
  const rowAnimations = useRef(
    steps.map(() => ({
      opacity: new Animated.Value(0),
      rise: new Animated.Value(10),
      completion: new Animated.Value(0),
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
        140,
        rowAnimations.map((row) =>
          Animated.parallel([
            Animated.timing(row.opacity, {
              toValue: 1,
              duration: 210,
              easing: Easing.out(Easing.cubic),
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
      setTimeout(() => {
        setCompletedSteps(index + 1);
        const animation = rowAnimations[index];
        if (!animation) return;
        Animated.timing(animation.completion, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start();
      }, 460 + index * 300),
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: 0.55,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
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
    rowAnimations.forEach((row) => row.completion.setValue(1));
    Animated.parallel([
      Animated.timing(panelHeight, {
        toValue: 0,
        duration: 250,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(panelOpacity, {
        toValue: 0,
        duration: 220,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(panelExit, {
        toValue: 8,
        duration: 250,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
  }, [
    complete,
    panelExit,
    panelHeight,
    panelOpacity,
    rowAnimations,
  ]);

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
      <Animated.View
        style={[
          styles.panelClip,
          {
            height: panelHeight,
            opacity: panelOpacity,
            transform: [{ translateY: panelExit }],
          },
        ]}
      >
        <View style={styles.panel}>
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
              const statusBackground = animation.completion.interpolate({
                inputRange: [0, 1],
                outputRange: [colors.surface, colors.success],
              });
              const statusBorder = animation.completion.interpolate({
                inputRange: [0, 1],
                outputRange: [colors.outlineStrong, colors.success],
              });
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
                  <Animated.View
                    style={[
                      styles.stepDot,
                      {
                        backgroundColor: statusBackground,
                        borderColor: statusBorder,
                      },
                    ]}
                  >
                    <Animated.View
                      style={[
                        styles.stepPulse,
                        {
                          opacity: Animated.multiply(
                            pulse,
                            animation.completion.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 0],
                            }),
                          ),
                        },
                      ]}
                    />
                    <Animated.View style={{ opacity: animation.completion }}>
                      <Check size={11} color={colors.white} strokeWidth={3} />
                    </Animated.View>
                  </Animated.View>
                  <Text style={[styles.stepText, done && styles.stepTextDone]}>
                    {step}
                  </Text>
                </Animated.View>
              );
            })}
          </View>
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
  panelClip: {
    overflow: 'hidden',
    borderRadius: radius.md,
  },
  panel: {
    minHeight: 218,
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
  stepPulse: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: radius.round,
    backgroundColor: colors.primary,
  },
  stepText: { ...text.caption, color: colors.inkSubtle },
  stepTextDone: { color: colors.inkMuted },
});
