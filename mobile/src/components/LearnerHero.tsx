import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors, gradients, radius, spacing, text } from '@/theme/tokens';
import { PeacockPhase, peacockPhase } from '@/components/mascot';
import { HeroCard, ProgressBar, RingProgress } from '@/components/ui';
import { learnerLevel, progressHeadline } from '@/utils/progression';

/**
 * The learner's hero: growth peacock, scholarly rank, and level progress.
 *
 * Two progressions sit side by side on purpose — the peacock (a warm, visual
 * sense of "how far have I come") and the level ring (a precise, earned
 * number). Both are derived from real study data; see `utils/progression`.
 */
export function LearnerHero({
  completedModules,
  totalModules,
  averageScore,
  totalAttempts = 0,
  dueFlashcards = 0,
}: {
  completedModules: number;
  totalModules: number;
  averageScore: number;
  totalAttempts?: number;
  dueFlashcards?: number;
}) {
  const input = { completedModules, totalModules, averageScore, totalAttempts, dueFlashcards };
  const { phase, name } = peacockPhase(input);
  const level = learnerLevel(input);
  const headline = progressHeadline(input);
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce || cancelled) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(bob, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(bob, {
            toValue: 0,
            duration: 1500,
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
  }, [bob]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });

  return (
    <HeroCard>
      <View style={styles.row}>
        <RingProgress
          value={level.progress}
          size={112}
          thickness={8}
          color={colors.accent}
          accessibilityLabel={`Level ${level.level} progress`}
        >
          <Animated.View style={{ transform: [{ translateY }] }}>
            <PeacockPhase
              phase={phase}
              size={72}
              accessibilityLabel={`Your peacock, ${name}, phase ${phase} of 5`}
            />
          </Animated.View>
          <View style={styles.levelPin}>
            <Text style={styles.levelPinText}>LV {level.level}</Text>
          </View>
        </RingProgress>

        <View style={styles.flex}>
          <Text style={styles.overline}>{level.title.toUpperCase()} · PHASE {phase} OF 5</Text>
          <Text style={styles.tier} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {name}
          </Text>
          <Text style={styles.blurb} numberOfLines={2}>
            {headline}
          </Text>
          <View style={styles.pips}>
            {[1, 2, 3, 4, 5].map((p) => (
              <View key={p} style={[styles.pip, p <= phase && styles.pipOn]} />
            ))}
          </View>
        </View>
      </View>

      <View style={styles.panel}>
        <View style={styles.panelRow}>
          <Text style={styles.panelLabel}>Level {level.level} progress</Text>
          <Text style={styles.panelValue}>
            {level.pointsIntoLevel}/{level.pointsForLevel} pts
          </Text>
        </View>
        <ProgressBar
          value={level.progress}
          height={10}
          ramp={gradients.gold}
          trackColor={colors.onBrandLine}
          accessibilityLabel={`${level.pointsToNext} points to level ${level.level + 1}`}
        />
        <View style={styles.panelRow}>
          <Text style={styles.panelFoot}>
            {level.pointsToNext} pts to Level {level.level + 1}
          </Text>
          <Text style={styles.panelFoot}>
            {completedModules}/{totalModules} modules · {Math.round(averageScore)}% avg
          </Text>
        </View>
      </View>
    </HeroCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  flex: { flex: 1, minWidth: 0 },
  levelPin: {
    position: 'absolute',
    bottom: -4,
    backgroundColor: colors.accent,
    borderRadius: radius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  levelPinText: { ...text.tiny, color: colors.white, fontWeight: '800', letterSpacing: 0.4 },
  overline: { ...text.overline, color: colors.accent, fontSize: 11 },
  tier: { ...text.h1, color: colors.onBrand, marginTop: 2 },
  blurb: { ...text.caption, color: colors.onBrandMuted, fontWeight: '500', marginTop: 4 },
  pips: { flexDirection: 'row', gap: 5, marginTop: spacing.sm },
  pip: { width: 18, height: 5, borderRadius: 3, backgroundColor: colors.onBrandLine },
  pipOn: { backgroundColor: colors.accent },
  panel: {
    backgroundColor: colors.onBrandSurface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  panelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  panelLabel: { ...text.label, color: colors.onBrand, fontWeight: '800' },
  panelValue: { ...text.label, color: colors.accent, fontWeight: '800' },
  panelFoot: { ...text.tiny, color: colors.onBrandMuted, fontWeight: '600' },
});
