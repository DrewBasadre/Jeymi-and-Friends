import type { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import { ArrowLeft, type LucideIcon } from 'lucide-react-native';
import { colors, radius, spacing } from '@/theme/tokens';

export function Screen({
  children,
  scroll = true,
  style,
}: PropsWithChildren<{ scroll?: boolean; style?: ViewStyle }>) {
  if (!scroll) return <View style={[styles.screen, style]}>{children}</View>;
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.screenContent, style]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  action,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  action?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        {onBack ? (
          <IconButton icon={ArrowLeft} label="Go back" onPress={onBack} />
        ) : null}
        <View style={styles.headerText}>
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
}: PropsWithChildren<{ style?: ViewStyle; accent?: string }>) {
  return <View style={[styles.card, accent ? { borderLeftColor: accent, borderLeftWidth: 4 } : null, style]}>{children}</View>;
}

export function PrimaryButton({
  label,
  onPress,
  icon: Icon,
  disabled,
  loading,
  tone = 'primary',
}: {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  disabled?: boolean;
  loading?: boolean;
  tone?: 'primary' | 'secondary' | 'danger';
}) {
  const secondary = tone === 'secondary';
  const danger = tone === 'danger';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.buttonSecondary,
        danger && styles.buttonDanger,
        pressed && !disabled && styles.buttonPressed,
        (disabled || loading) && styles.buttonDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? colors.indigo : colors.white} />
      ) : (
        <>
          {Icon ? <Icon size={19} color={secondary ? colors.indigo : colors.white} /> : null}
          <Text style={[styles.buttonText, secondary && styles.buttonSecondaryText]} numberOfLines={2}>
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
  color = colors.indigo,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={[styles.chip, selected ? { backgroundColor: color, borderColor: color } : null]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function Metric({
  label,
  value,
  tint = colors.indigoTint,
}: {
  label: string;
  value: string | number;
  tint?: string;
}) {
  return (
    <View style={[styles.metric, { backgroundColor: tint }]}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

export function LoadingScreen() {
  return (
    <View style={styles.loadingScreen}>
      <ActivityIndicator size="large" color={colors.indigo} />
      <Text style={styles.subtitle}>Preparing offline learning...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  screenContent: { padding: spacing.xl, paddingBottom: 48, gap: spacing.lg },
  header: { marginBottom: spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerText: { flex: 1, minWidth: 0 },
  title: { color: colors.ink, fontSize: 26, lineHeight: 32, fontWeight: '800' },
  subtitle: { color: colors.inkMuted, fontSize: 15, lineHeight: 22, marginTop: 2 },
  sectionTitle: { color: colors.ink, fontSize: 19, lineHeight: 25, fontWeight: '800', marginTop: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outline,
    padding: spacing.lg,
    gap: spacing.md,
  },
  button: {
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: colors.indigo,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  buttonSecondary: { backgroundColor: colors.surface, borderColor: colors.indigo, borderWidth: 1 },
  buttonDanger: { backgroundColor: colors.danger },
  buttonPressed: { opacity: 0.76 },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: colors.white, fontSize: 16, lineHeight: 21, fontWeight: '800', textAlign: 'center' },
  buttonSecondaryText: { color: colors.indigo },
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
  iconButtonActive: { backgroundColor: colors.indigo, borderColor: colors.indigo },
  chip: {
    minHeight: 38,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.outline,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  chipText: { color: colors.inkMuted, fontSize: 14, fontWeight: '700' },
  chipTextSelected: { color: colors.white },
  metric: { flex: 1, minWidth: 130, padding: spacing.lg, borderRadius: radius.md, gap: spacing.xs },
  metricValue: { color: colors.ink, fontSize: 26, fontWeight: '900' },
  metricLabel: { color: colors.inkMuted, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  empty: { paddingVertical: spacing.xxxl, alignItems: 'center', gap: spacing.sm },
  emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  emptyBody: { color: colors.inkMuted, textAlign: 'center', fontSize: 15, lineHeight: 22 },
  loadingScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
});

