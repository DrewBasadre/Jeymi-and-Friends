import { Bot } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@/theme/tokens';

export function MascotNote({ message }: { message: string }) {
  return (
    <View style={styles.note}>
      <View style={styles.icon}>
        <Bot size={24} color={colors.indigo} />
      </View>
      <View style={styles.text}>
        <Text style={styles.label}>WAIS buddy</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    alignItems: 'flex-start',
    backgroundColor: colors.indigoTint,
    borderColor: colors.indigo,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  icon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  text: { flex: 1, gap: spacing.xs, minWidth: 0 },
  label: { color: colors.indigo, fontSize: 13, fontWeight: '900' },
  message: { color: colors.ink, fontSize: 15, lineHeight: 22 },
});
