import {
  Children,
  type PropsWithChildren,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type TextStyle,
  useWindowDimensions,
  View,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Check, ChevronDown, ChevronRight, type LucideIcon } from 'lucide-react-native';
import {
  colors,
  elevation,
  gradients,
  layout,
  radius,
  spacing,
  statusPalette,
  text,
} from '@/theme/tokens';
import { MascotPanel } from './mascot';

/* ────────────────────────────────────────────────────────────────────────
   Layout
   ──────────────────────────────────────────────────────────────────────── */

export function Screen({
  children,
  scroll = true,
  style,
  edges = true,
  /** Adds clearance so the last element never sits under a tab bar. */
  bottomClearance = false,
  /**
   * Set false when the screen hosts its own scroller (a FlatList with its own
   * content padding) — otherwise the gutter is applied twice.
   */
  padded = true,
}: PropsWithChildren<{
  scroll?: boolean;
  style?: ViewStyle;
  edges?: boolean;
  bottomClearance?: boolean;
  padded?: boolean;
}>) {
  const insets = useSafeAreaInsets();
  const pad = {
    paddingTop: edges ? insets.top + spacing.md : spacing.xl,
    paddingBottom:
      (edges ? insets.bottom : 0) +
      (bottomClearance ? layout.tabBarClearance : spacing.huge),
    ...(padded ? null : { paddingHorizontal: 0 }),
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

/**
 * Number of columns to lay lists/grids out in, based on viewport width.
 * `phoneColumns` controls the count on phones (default 1); tablets and larger
 * fill the space with 2–3. Pass 2 for compact cards that read well side-by-side.
 */
export function useResponsiveColumns(phoneColumns = 1): number {
  const { width } = useWindowDimensions();
  if (width >= 920) return Math.max(3, phoneColumns);
  if (width >= 640) return Math.max(2, phoneColumns);
  if (width >= 360) return phoneColumns;
  return 1;
}

/** True on narrow phones, where two-up rows and big numerals need to shrink. */
export function useCompactViewport(): boolean {
  const { width } = useWindowDimensions();
  return width < 380;
}

export function Divider({ style }: { style?: ViewStyle }) {
  return <View style={[styles.divider, style]} />;
}

/**
 * Fixed-column grid for tiles. Deliberately chunks children into explicit rows
 * instead of relying on `flexWrap`: a wrapping row of `flex: 1` items gives
 * unpredictable heights and can overlap the next section.
 */
export function TileGrid({
  children,
  columns = 2,
  gap = spacing.md,
}: PropsWithChildren<{ columns?: number; gap?: number }>) {
  const items = Children.toArray(children).filter(Boolean);
  const rows: ReactNode[][] = [];
  for (let index = 0; index < items.length; index += columns) {
    rows.push(items.slice(index, index + columns));
  }
  return (
    <View style={{ gap }}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={{ flexDirection: 'row', gap }}>
          {row.map((child, cellIndex) => (
            <View key={cellIndex} style={styles.tileCell}>
              {child}
            </View>
          ))}
          {/* Pad a short final row so its tiles keep their column width. */}
          {Array.from({ length: columns - row.length }, (_, padIndex) => (
            <View key={`pad-${padIndex}`} style={styles.tileCell} />
          ))}
        </View>
      ))}
    </View>
  );
}

export function Row({
  children,
  gap = spacing.md,
  align = 'center',
  wrap = false,
  style,
}: PropsWithChildren<{
  gap?: number;
  align?: ViewStyle['alignItems'];
  wrap?: boolean;
  style?: ViewStyle;
}>) {
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: align, gap },
        wrap && { flexWrap: 'wrap' },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Gradient surface — drawn with react-native-svg (no extra dependency)
   ──────────────────────────────────────────────────────────────────────── */

export function GradientView({
  ramp = gradients.brand,
  style,
  diagonal = true,
  children,
}: PropsWithChildren<{
  ramp?: readonly [string, string] | readonly string[];
  style?: StyleProp<ViewStyle>;
  /** Diagonal ramps feel richer on large surfaces; flat ones on thin bars. */
  diagonal?: boolean;
  children?: ReactNode;
}>) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const gradientId = `pv-grad-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [from, to] = [ramp[0] ?? colors.primary, ramp[1] ?? colors.secondary];
  return (
    <View
      style={[styles.gradientHost, style]}
      onLayout={(e) =>
        setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
      }
    >
      {size.w > 0 && size.h > 0 ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width={size.w} height={size.h}>
            <Defs>
              <LinearGradient
                id={gradientId}
                x1="0"
                y1="0"
                x2={diagonal ? '1' : '1'}
                y2={diagonal ? '1' : '0'}
              >
                <Stop offset="0" stopColor={from} />
                <Stop offset="1" stopColor={to} />
              </LinearGradient>
            </Defs>
            <Rect width={size.w} height={size.h} fill={`url(#${gradientId})`} />
          </Svg>
        </View>
      ) : null}
      {children}
    </View>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Headers & section structure
   ──────────────────────────────────────────────────────────────────────── */

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

/**
 * Section divider with an optional trailing link — gives long screens a clear
 * editorial rhythm instead of an undifferentiated stack of cards.
 */
export function SectionHeader({
  title,
  caption,
  actionLabel,
  onAction,
}: {
  title: string;
  caption?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.flex}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {caption ? <Text style={styles.sectionCaption}>{caption}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          hitSlop={8}
          style={({ pressed }) => [styles.sectionAction, pressed && styles.pressedSoft]}
        >
          <Text style={styles.sectionActionText}>{actionLabel}</Text>
          <ChevronRight size={16} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Surfaces
   ──────────────────────────────────────────────────────────────────────── */

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

/**
 * Card that responds to touch with a subtle scale — the single micro-interaction
 * that makes a list of cards feel like a product rather than a page.
 */
export function PressableScale({
  onPress,
  children,
  style,
  accessibilityLabel,
  accessibilityHint,
  haptic = true,
  disabled,
}: PropsWithChildren<{
  onPress: () => void;
  style?: ViewStyle;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  haptic?: boolean;
  disabled?: boolean;
}>) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (value: number) =>
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      disabled={disabled}
      onPressIn={() => to(0.975)}
      onPressOut={() => to(1)}
      onPress={() => {
        if (haptic) void Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={style}
    >
      <Animated.View style={{ transform: [{ scale }], flex: style ? 1 : undefined }}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

/**
 * Full-bleed gradient hero. Used once per screen at most — it is the anchor
 * that makes the rest of the layout read as calm.
 */
export function HeroCard({
  children,
  ramp = gradients.hero,
  style,
}: PropsWithChildren<{ ramp?: readonly string[]; style?: StyleProp<ViewStyle> }>) {
  return (
    <GradientView ramp={ramp} style={[styles.hero, style]}>
      <View style={styles.heroSheen} pointerEvents="none" />
      {children}
    </GradientView>
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
      {Icon ? <IconPlate icon={Icon} color={color} /> : null}
      <View style={styles.flex}>
        <Text style={styles.cardTitle}>{title}</Text>
        {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
      </View>
      {action}
    </View>
  );
}

/** Tinted square that holds a subject or section icon. */
export function IconPlate({
  icon: Icon,
  color = colors.primary,
  size = 40,
  tint,
}: {
  icon: LucideIcon;
  color?: string;
  size?: number;
  tint?: string;
}) {
  return (
    <View
      style={[
        styles.iconPlate,
        {
          width: size,
          height: size,
          borderRadius: size >= 44 ? radius.lg : radius.md,
          backgroundColor: tint ?? withTint(color),
        },
      ]}
    >
      <Icon size={Math.round(size * 0.5)} color={color} />
    </View>
  );
}

/** Inline notice inside a screen — info, success, caution, error. */
export function Callout({
  icon: Icon,
  title,
  body,
  tone = 'info',
  action,
}: {
  icon?: LucideIcon;
  title: string;
  body?: string;
  tone?: 'info' | 'success' | 'warning' | 'error';
  action?: ReactNode;
}) {
  const palette = {
    info: { bg: colors.secondaryTint, fg: colors.secondary },
    success: { bg: colors.successTint, fg: colors.success },
    warning: { bg: colors.warningTint, fg: colors.warning },
    error: { bg: colors.errorTint, fg: colors.error },
  }[tone];
  return (
    <View style={[styles.callout, { backgroundColor: palette.bg }]}>
      {Icon ? <Icon size={20} color={palette.fg} /> : null}
      <View style={styles.flex}>
        <Text style={[styles.calloutTitle, { color: palette.fg }]}>{title}</Text>
        {body ? <Text style={styles.calloutBody}>{body}</Text> : null}
      </View>
      {action}
    </View>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Controls
   ──────────────────────────────────────────────────────────────────────── */

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
  const fg = filled || accent ? colors.white : colors.primary;

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
        filled && !disabled && !loading ? elevation.e1 : null,
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
      accessibilityState={{ selected: !!active }}
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
  size = 'md',
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
  icon?: LucideIcon;
  size?: 'sm' | 'md';
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { selected: !!selected } : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.chip,
        size === 'sm' && styles.chipSm,
        !onPress && styles.chipStatic,
        selected ? { backgroundColor: color, borderColor: color } : null,
        pressed && onPress ? styles.pressedSoft : null,
      ]}
    >
      {Icon ? (
        <Icon size={size === 'sm' ? 13 : 14} color={selected ? colors.white : colors.inkMuted} />
      ) : null}
      <Text
        style={[
          styles.chipText,
          size === 'sm' && styles.chipTextSm,
          selected && styles.chipTextSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Two-or-more option switch. Replaces the ad-hoc segmented rows in screens. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => {
              void Haptics.selectionAsync().catch(() => {});
              onChange(option.value);
            }}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Single-select dropdown. A bordered field that opens a modal list of options —
 * the space-saving replacement for a long row of selection chips. Selecting an
 * option calls `onChange` with the same value the chips used, so it is a drop-in
 * behavioural swap.
 */
export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  placeholder = 'Select',
  accessibilityLabel,
}: {
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  placeholder?: string;
  accessibilityLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? selected?.label ?? placeholder}
        accessibilityState={{ expanded: open }}
        onPress={() => {
          void Haptics.selectionAsync().catch(() => {});
          setOpen(true);
        }}
        style={({ pressed }) => [styles.dropdownField, pressed && styles.pressedSoft]}
      >
        <Text style={[styles.dropdownValue, !selected && styles.dropdownPlaceholder]} numberOfLines={1}>
          {selected?.label ?? placeholder}
        </Text>
        <ChevronDown size={18} color={colors.inkMuted} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.dropdownBackdrop} onPress={() => setOpen(false)}>
          <View style={styles.dropdownSheet}>
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              {options.map((option, index) => {
                const active = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      void Haptics.selectionAsync().catch(() => {});
                      onChange(option.value);
                      setOpen(false);
                    }}
                    style={({ pressed }) => [
                      styles.dropdownOption,
                      index > 0 && styles.dropdownOptionDivider,
                      pressed && styles.dropdownOptionPressed,
                    ]}
                  >
                    <Text
                      style={[styles.dropdownOptionText, active && styles.dropdownOptionTextActive]}
                      numberOfLines={2}
                    >
                      {option.label}
                    </Text>
                    {active ? <Check size={18} color={colors.primary} strokeWidth={2.6} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

/** Tappable row: icon plate → title/subtitle → chevron. */
export function ListRow({
  icon: Icon,
  title,
  subtitle,
  color = colors.primary,
  onPress,
  trailing,
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  color?: string;
  onPress?: () => void;
  trailing?: ReactNode;
}) {
  const content = (
    <View style={styles.listRow}>
      {Icon ? <IconPlate icon={Icon} color={color} size={38} /> : null}
      <View style={styles.flex}>
        <Text style={styles.listRowTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.listRowSubtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ?? (onPress ? <ChevronRight size={18} color={colors.inkSubtle} /> : null)}
    </View>
  );
  if (!onPress) return content;
  return (
    <PressableScale onPress={onPress} accessibilityLabel={title}>
      {content}
    </PressableScale>
  );
}

/**
 * Square quick-action tile. A grid of these gives the home screen an obvious
 * "what can I do right now" answer without another wall of buttons.
 */
export function ActionTile({
  icon: Icon,
  label,
  caption,
  color = colors.primary,
  onPress,
  badge,
}: {
  icon: LucideIcon;
  label: string;
  caption?: string;
  color?: string;
  onPress: () => void;
  badge?: string | number;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={caption ? `${label}. ${caption}` : label}
      style={styles.actionTileHost}
    >
      <View style={styles.actionTile}>
        <View style={styles.actionTileTop}>
          <IconPlate icon={Icon} color={color} size={38} />
          {badge !== undefined && badge !== null && `${badge}` !== '0' ? (
            <View style={styles.actionBadge}>
              <Text style={styles.actionBadgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.actionLabel} numberOfLines={1}>
          {label}
        </Text>
        {caption ? (
          <Text style={styles.actionCaption} numberOfLines={1}>
            {caption}
          </Text>
        ) : null}
      </View>
    </PressableScale>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Status, data display
   ──────────────────────────────────────────────────────────────────────── */

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

/**
 * Metric with an icon plate and optional footnote — the richer sibling of
 * `Metric`, for the four-up stat grids on home and class dashboards.
 */
export function StatTile({
  icon: Icon,
  label,
  value,
  footnote,
  color = colors.primary,
  tint,
}: {
  icon?: LucideIcon;
  label: string;
  value: string | number;
  footnote?: string;
  color?: string;
  tint?: string;
}) {
  return (
    <View style={styles.statTile}>
      <View style={styles.statTileTop}>
        {Icon ? <IconPlate icon={Icon} color={color} size={32} tint={tint} /> : null}
        <Text style={styles.statLabel} numberOfLines={2}>
          {label}
        </Text>
      </View>
      <Text style={[styles.statValue, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
      {footnote ? (
        <Text style={styles.statFootnote} numberOfLines={1}>
          {footnote}
        </Text>
      ) : null}
    </View>
  );
}

/** Peacock teal→ocean-blue progress bar (value 0..1). */
export function ProgressBar({
  value,
  height = 10,
  trackColor = colors.surfaceSunken,
  ramp = gradients.brand,
  accessibilityLabel,
}: {
  value: number;
  height?: number;
  trackColor?: string;
  ramp?: readonly string[];
  accessibilityLabel?: string;
}) {
  const [w, setW] = useState(0);
  const anim = useRef(new Animated.Value(clamp01(value))).current;
  const gradientId = `pv-progress-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
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
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamp01(value) * 100) }}
    >
      {/* overflow:hidden matters — without it the full-width SVG child paints
          past the animated width and the bar always looks 100% full. */}
      <Animated.View style={{ width: fillW, height, overflow: 'hidden' }}>
        {w > 0 ? (
          <Svg width={w} height={height}>
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={ramp[0] ?? colors.gradientStart} />
                <Stop offset="1" stopColor={ramp[1] ?? colors.gradientEnd} />
              </LinearGradient>
            </Defs>
            <Rect width={w} height={height} rx={height / 2} fill={`url(#${gradientId})`} />
          </Svg>
        ) : null}
      </Animated.View>
    </View>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Circular progress ring with a value in the middle. Used for the learner's
 * level and for mastery read-outs — a compact, celebratory shape that a bar
 * cannot give you.
 */
export function RingProgress({
  value,
  size = 92,
  thickness = 9,
  color = colors.accent,
  trackColor = colors.onBrandLine,
  children,
  accessibilityLabel,
}: PropsWithChildren<{
  value: number;
  size?: number;
  thickness?: number;
  color?: string;
  trackColor?: string;
  accessibilityLabel?: string;
}>) {
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  const anim = useRef(new Animated.Value(0)).current;
  const target = clamp01(value);

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        anim.setValue(target);
        return;
      }
      Animated.timing(anim, {
        toValue: target,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    });
    return () => {
      cancelled = true;
    };
  }, [anim, target]);

  const offset = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(target * 100) }}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={trackColor}
          strokeWidth={thickness}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          // Start the sweep at 12 o'clock rather than 3 o'clock.
          originX={size / 2}
          originY={size / 2}
          rotation={-90}
        />
      </Svg>
      {children}
    </View>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Loading & empty
   ──────────────────────────────────────────────────────────────────────── */

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
    [colors.accentText]: colors.accentTint,
    [colors.success]: colors.successTint,
    [colors.warning]: colors.warningTint,
    [colors.error]: colors.errorTint,
    [colors.coral]: colors.coralTint,
    [colors.math]: colors.accentTint,
  };
  return map[color] ?? colors.primaryTint;
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  screenContent: {
    paddingHorizontal: layout.gutter,
    gap: spacing.lg,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  flex: { flex: 1, minWidth: 0 },
  divider: { height: 1, backgroundColor: colors.hairline },
  tileCell: { flex: 1, minWidth: 0 },

  header: { marginBottom: spacing.xs },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerText: { flex: 1, minWidth: 0 },
  overline: { ...text.overline, color: colors.primary, marginBottom: 2 },
  title: { ...text.h1, color: colors.ink },
  subtitle: { ...text.body, color: colors.inkMuted, marginTop: 2 },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  sectionTitle: { ...text.h2, color: colors.ink },
  sectionCaption: { ...text.caption, color: colors.inkMuted, fontWeight: '500', marginTop: 2 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingBottom: 2 },
  sectionActionText: { ...text.label, color: colors.primary, fontWeight: '800' },
  pressedSoft: { opacity: 0.6 },

  gradientHost: { overflow: 'hidden' },
  hero: {
    borderRadius: radius.xxl,
    padding: spacing.xl,
    gap: spacing.lg,
    ...elevation.e2,
  },
  heroSheen: {
    position: 'absolute',
    top: -70,
    right: -50,
    width: 190,
    height: 190,
    borderRadius: radius.round,
    backgroundColor: colors.sheen,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outline,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardTitle: { ...text.title, color: colors.ink },
  cardSubtitle: { ...text.caption, color: colors.inkMuted, fontWeight: '500', marginTop: 1 },
  iconPlate: { alignItems: 'center', justifyContent: 'center' },

  callout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  calloutTitle: { ...text.label, fontWeight: '800' },
  calloutBody: { ...text.caption, color: colors.inkMuted, fontWeight: '500', marginTop: 2 },

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
  buttonSm: {
    minHeight: 42,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
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
  chipSm: { minHeight: 30, paddingHorizontal: spacing.sm + 2, paddingVertical: 4 },
  chipStatic: { backgroundColor: colors.surfaceMuted, borderColor: 'transparent' },
  chipText: { ...text.label, color: colors.inkMuted },
  chipTextSm: { ...text.tiny, letterSpacing: 0.2 },
  chipTextSelected: { color: colors.white },

  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm + 1,
  },
  segmentActive: { backgroundColor: colors.surface, ...elevation.e0 },
  segmentText: { ...text.label, color: colors.inkMuted, fontWeight: '700' },
  segmentTextActive: { color: colors.primary, fontWeight: '800' },

  dropdownField: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.outline,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  dropdownValue: { ...text.bodyStrong, color: colors.ink, flex: 1, minWidth: 0 },
  dropdownPlaceholder: { color: colors.inkSubtle, fontWeight: '400' },
  dropdownBackdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  dropdownSheet: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outline,
    maxHeight: 360,
    overflow: 'hidden',
    ...elevation.e3,
  },
  dropdownOption: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  dropdownOptionDivider: { borderTopWidth: 1, borderTopColor: colors.hairline },
  dropdownOptionPressed: { backgroundColor: colors.surfaceMuted },
  dropdownOptionText: { ...text.body, color: colors.ink, flex: 1, minWidth: 0 },
  dropdownOptionTextActive: { color: colors.primary, fontWeight: '700' },

  listRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
  listRowTitle: { ...text.bodyStrong, color: colors.ink },
  listRowSubtitle: { ...text.caption, color: colors.inkMuted, fontWeight: '500', marginTop: 1 },

  actionTileHost: { flex: 1, minWidth: 0 },
  actionTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outline,
    padding: spacing.md,
    gap: spacing.xs,
    minHeight: 108,
    ...elevation.e0,
  },
  actionTileTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  actionBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: radius.round,
    paddingHorizontal: 6,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBadgeText: { ...text.tiny, color: colors.white, fontWeight: '800' },
  actionLabel: { ...text.bodyStrong, color: colors.ink, marginTop: spacing.xs },
  actionCaption: { ...text.caption, color: colors.inkMuted, fontWeight: '500' },

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

  statTile: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outline,
    padding: spacing.md,
    gap: spacing.xs,
    ...elevation.e0,
  },
  // Reserve two label lines so values stay on a common baseline across a row.
  statTileTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, minHeight: 36 },
  statLabel: { ...text.caption, color: colors.inkMuted, flex: 1, fontWeight: '600', paddingTop: 2 },
  statValue: { ...text.metric, marginTop: spacing.xs },
  statFootnote: { ...text.tiny, color: colors.inkSubtle, fontWeight: '600' },

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
