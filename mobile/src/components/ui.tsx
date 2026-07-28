import { type PropsWithChildren, type ReactNode, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, type LucideIcon } from 'lucide-react-native';
import { colors, elevation, radius, spacing, statusPalette, text } from '@/theme/tokens';
import { MascotPanel } from './mascot';

export function Screen({
  children,
  scroll = true,
  style,
  edges = true,
}: PropsWithChildren<{ scroll?: boolean; style?: ViewStyle; edges?: boolean }>) {
  const insets = useSafeAreaInsets();
  const pad = {
    paddingTop: edges ? insets.top + spacing.md : spacing.xl,
    paddingBottom: (edges ? insets.bottom : 0) + spacing.huge,
  };
  if (!scroll)
    return (
      <View style={[styles.screen, styles.screenContent, pad, { paddingBottom: undefined }, style]}>
        {children}
      </View>
    );
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.screenContent, pad, style]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  overline,
  onBack,
  action,
}: {
  title: string;
  subtitle?: string;
  overline?: string;
  onBack?: () => void;
  action?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        {onBack ? <IconButton icon={ArrowLeft} label="Go back" onPress={onBack} /> : null}
        <View style={styles.headerText}>
          {overline ? <Text style={styles.overline}>{overline.toUpperCase()}</Text> : null}
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {action}
      </View>
    </View>
  );
}

export function SectionTitle({ children, style }: PropsWithChildren<{ style?: TextStyle }>) {
  return <Text style={[styles.sectionTitle, style]}>{children}</Text>;
}

export function Card({
  children,
  style,
  accent,
  tone,
  raised = true,
}: PropsWithChildren<{
  style?: ViewStyle;
  accent?: string;
  tone?: string;
  raised?: boolean;
}>) {
  return (
    <View
      style={[
        styles.card,
        raised ? elevation.e1 : null,
        tone ? { backgroundColor: tone, borderColor: 'transparent' } : null,
        accent ? { borderLeftColor: accent, borderLeftWidth: 5 } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function CardHeader({
  icon: Icon,
  title,
  subtitle,
  color = colors.primary,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  color?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.cardHeader}>
      {Icon ? (
        <View style={[styles.cardHeaderIcon, { backgroundColor: withTint(color) }]}>
          <Icon size={20} color={color} />
        </View>
      ) : null}
      <View style={styles.flex}>
        <Text style={styles.cardTitle}>{title}</Text>
        {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

type ButtonTone = 'primary' | 'secondary' | 'danger' | 'ghost' | 'accent';

export function PrimaryButton({
  label,
  onPress,
  icon: Icon,
  disabled,
  loading,
  tone = 'primary',
  size = 'md',
  haptic = true,
}: {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  disabled?: boolean;
  loading?: boolean;
  tone?: ButtonTone;
  size?: 'sm' | 'md';
  haptic?: boolean;
}) {
  const filled = tone === 'primary' || tone === 'danger';
  const accent = tone === 'accent';
  const fg = filled || accent ? colors.white : tone === 'ghost' ? colors.primary : colors.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={() => {
        if (haptic) void Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        size === 'sm' && styles.buttonSm,
        tone === 'secondary' && styles.buttonSecondary,
        tone === 'ghost' && styles.buttonGhost,
        tone === 'danger' && styles.buttonDanger,
        tone === 'accent' && styles.buttonAccent,
        pressed && !disabled && styles.buttonPressed,
        (disabled || loading) && styles.buttonDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {Icon ? <Icon size={size === 'sm' ? 17 : 19} color={fg} /> : null}
          <Text
            style={[
              styles.buttonText,
              size === 'sm' && styles.buttonTextSm,
              !filled && !accent && styles.buttonTextOutline,
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon: Icon,
  label,
  onPress,
  active,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        active && styles.iconButtonActive,
        pressed && styles.buttonPressed,
      ]}
    >
      <Icon size={21} color={active ? colors.white : colors.ink} />
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  color = colors.primary,
  icon: Icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  icon?: LucideIcon;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { selected: !!selected } : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.chip,
        !onPress && styles.chipStatic,
        selected ? { backgroundColor: color, borderColor: color } : null,
      ]}
    >
      {Icon ? <Icon size={14} color={selected ? colors.white : colors.inkMuted} /> : null}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function StatusBadge({
  label,
  status = 'notStarted',
}: {
  label: string;
  status?: keyof typeof statusPalette;
}) {
  const p = statusPalette[status];
  return (
    <View style={[styles.badge, { backgroundColor: p.bg }]}>
      <View style={[styles.badgeDot, { backgroundColor: p.fg }]} />
      <Text style={[styles.badgeText, { color: p.fg }]}>{label}</Text>
    </View>
  );
}

export function Metric({
  label,
  value,
  tint = colors.primaryTint,
  color = colors.ink,
}: {
  label: string;
  value: string | number;
  tint?: string;
  color?: string;
}) {
  return (
    <View style={[styles.metric, { backgroundColor: tint }]}>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

/** Peacock teal→ocean-blue progress bar (value 0..1). */
export function ProgressBar({
  value,
  height = 10,
  trackColor = colors.surfaceSunken,
}: {
  value: number;
  height?: number;
  trackColor?: string;
}) {
  const [w, setW] = useState(0);
  const anim = useRef(new Animated.Value(clamp01(value))).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: clamp01(value),
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [anim, value]);
  const fillW = anim.interpolate({ inputRange: [0, 1], outputRange: [0, w] });
  return (
    <View
      style={[styles.progressTrack, { height, borderRadius: height, backgroundColor: trackColor }]}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamp01(value) * 100) }}
    >
      <Animated.View style={{ width: fillW, height }}>
        {w > 0 ? (
          <Svg width={w} height={height}>
            <Defs>
              <LinearGradient id="pv-progress" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={colors.gradientStart} />
                <Stop offset="1" stopColor={colors.gradientEnd} />
              </LinearGradient>
            </Defs>
            <Rect width={w} height={height} rx={height / 2} fill="url(#pv-progress)" />
          </Svg>
        ) : null}
      </Animated.View>
    </View>
  );
}

/** Shimmering placeholder block used while data loads. */
export function Skeleton({
  width = '100%',
  height = 16,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  style?: ViewStyle;
}) {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce || cancelled) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
        ]),
      );
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [pulse]);
  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius.sm, backgroundColor: colors.surfaceSunken, opacity: pulse },
        style,
      ]}
    />
  );
}

export function SkeletonCard() {
  return (
    <Card>
      <Skeleton width="55%" height={18} />
      <Skeleton width="100%" height={12} />
      <Skeleton width="80%" height={12} />
    </Card>
  );
}

export function EmptyState({
  title,
  body,
  action,
  expression = 'idle',
}: {
  title: string;
  body: string;
  action?: ReactNode;
  expression?: 'idle' | 'happy' | 'encouraging';
}) {
  return (
    <View style={styles.empty}>
      <MascotPanel title={title} body={body} expression={expression} size={100} />
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

export function LoadingScreen({ message = 'Getting your learning ready…' }: { message?: string }) {
  return (
    <View style={styles.loadingScreen}>
      <MascotPanel title="Pavo" body={message} expression="idle" size={120} />
      <ActivityIndicator size="small" color={colors.primary} />
    </View>
  );
}

function withTint(color: string) {
  const map: Record<string, string> = {
    [colors.primary]: colors.primaryTint,
    [colors.secondary]: colors.secondaryTint,
    [colors.accent]: colors.accentTint,
    [colors.success]: colors.successTint,
    [colors.warning]: colors.warningTint,
    [colors.error]: colors.errorTint,
    [colors.math]: colors.accentTint,
  };
  return map[color] ?? colors.primaryTint;
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  screenContent: { paddingHorizontal: spacing.xl, gap: spacing.lg },
  header: { marginBottom: spacing.xs },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerText: { flex: 1, minWidth: 0 },
  flex: { flex: 1, minWidth: 0 },
  overline: { ...text.overline, color: colors.primary, marginBottom: 2 },
  title: { ...text.h1, color: colors.ink },
  subtitle: { ...text.body, color: colors.inkMuted, marginTop: 2 },
  sectionTitle: { ...text.h2, color: colors.ink, marginTop: spacing.xs },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outline,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { ...text.title, color: colors.ink },
  cardSubtitle: { ...text.caption, color: colors.inkMuted, marginTop: 1 },
  button: {
    minHeight: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  buttonSm: { minHeight: 42, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md },
  buttonSecondary: { backgroundColor: colors.surface, borderColor: colors.primary, borderWidth: 1.5 },
  buttonGhost: { backgroundColor: colors.primaryTint },
  buttonDanger: { backgroundColor: colors.error },
  buttonAccent: { backgroundColor: colors.accent },
  buttonPressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { ...text.bodyStrong, color: colors.white, fontWeight: '800', textAlign: 'center' },
  buttonTextSm: { fontSize: 14, lineHeight: 18 },
  buttonTextOutline: { color: colors.primary },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chip: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipStatic: { backgroundColor: colors.surfaceMuted, borderColor: 'transparent' },
  chipText: { ...text.label, color: colors.inkMuted },
  chipTextSelected: { color: colors.white },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    borderRadius: radius.round,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  badgeDot: { width: 7, height: 7, borderRadius: radius.round },
  badgeText: { ...text.caption, fontWeight: '800' },
  metric: {
    flex: 1,
    minWidth: 138,
    padding: spacing.lg,
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  metricValue: { ...text.metric, color: colors.ink },
  metricLabel: { ...text.caption, color: colors.inkMuted },
  progressTrack: { width: '100%', overflow: 'hidden' },
  empty: { paddingVertical: spacing.lg, alignItems: 'center', gap: spacing.md },
  emptyAction: { alignSelf: 'stretch', paddingHorizontal: spacing.xl },
  loadingScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
});
