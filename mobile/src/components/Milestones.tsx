import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  Award,
  CheckCheck,
  Crown,
  Flame,
  Repeat,
  Sparkles,
  Target,
  Trophy,
  type LucideIcon,
} from 'lucide-react-native';
import { colors, elevation, radius, spacing, text } from '@/theme/tokens';
import { milestones, type Milestone, type MilestoneIcon } from '@/utils/progression';

const ICONS: Record<MilestoneIcon, LucideIcon> = {
  'first-steps': Sparkles,
  streak: Flame,
  halfway: Target,
  complete: Trophy,
  sharp: Award,
  mastery: Crown,
  practice: Repeat,
  clear: CheckCheck,
};

/**
 * Horizontal strip of earned and still-locked milestones. Locked badges stay
 * visible but muted — they read as an invitation, not a scoreboard, and every
 * condition is checked against real progress.
 */
export function MilestoneStrip({
  completedModules,
  totalModules,
  averageScore,
  totalAttempts,
  dueFlashcards,
}: {
  completedModules: number;
  totalModules: number;
  averageScore: number;
  totalAttempts: number;
  dueFlashcards: number;
}) {
  const items = milestones({
    completedModules,
    totalModules,
    averageScore,
    totalAttempts,
    dueFlashcards,
  });
  // Earned first, so progress is the first thing the eye lands on.
  const ordered = [...items].sort((a, b) => Number(b.earned) - Number(a.earned));
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
    >
      {ordered.map((item) => (
        <MilestoneBadge key={item.id} milestone={item} />
      ))}
    </ScrollView>
  );
}

function MilestoneBadge({ milestone }: { milestone: Milestone }) {
  const Icon = ICONS[milestone.icon];
  return (
    <View
      style={[styles.badge, milestone.earned && styles.badgeEarned]}
      accessibilityRole="image"
      accessibilityLabel={`${milestone.label}. ${
        milestone.earned ? 'Earned' : 'Locked'
      }. ${milestone.hint}`}
    >
      <View style={[styles.medal, milestone.earned && styles.medalEarned]}>
        <Icon
          size={20}
          color={milestone.earned ? colors.white : colors.inkSubtle}
          strokeWidth={milestone.earned ? 2.4 : 2}
        />
      </View>
      <Text style={[styles.label, milestone.earned && styles.labelEarned]} numberOfLines={1}>
        {milestone.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { gap: spacing.sm, paddingVertical: 2, paddingRight: spacing.lg },
  badge: {
    width: 92,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  badgeEarned: { borderColor: colors.accentTint, backgroundColor: colors.surface, ...elevation.e0 },
  medal: {
    width: 44,
    height: 44,
    borderRadius: radius.round,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medalEarned: { backgroundColor: colors.accent, ...elevation.glow },
  label: { ...text.tiny, color: colors.inkSubtle, textAlign: 'center' },
  labelEarned: { color: colors.ink },
});
