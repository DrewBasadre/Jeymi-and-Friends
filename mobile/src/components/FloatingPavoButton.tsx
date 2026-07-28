import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getStudentDashboard } from '@/data/repository';
import type { StudentDashboard } from '@/domain/types';
import { useSessionStore } from '@/store/session';
import { peacockPhase } from '@/components/mascot/PeacockPhase';
import { PeacockPhase } from '@/components/mascot/PeacockPhase';
import { useConnectivity } from '@/services/connectivity';
import { isCompanionConfigured } from '@/services/companion';
import {
  colors,
  elevation,
  layout,
  radius,
  spacing,
  text,
} from '@/theme/tokens';

export function FloatingPavoButton({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();
  const student = useSessionStore((state) => state.student);
  const [dashboard, setDashboard] = useState<StudentDashboard | null>(null);
  const connectivity = useConnectivity();

  useEffect(() => {
    if (!student) return;
    let active = true;
    void getStudentDashboard(student.id).then((next) => {
      if (active) setDashboard(next);
    });
    return () => {
      active = false;
    };
  }, [student]);

  const growth = useMemo(
    () =>
      peacockPhase({
        completedModules: dashboard?.completedModules,
        totalModules: dashboard?.totalModules,
        averageScore: dashboard?.averageScore,
      }),
    [dashboard],
  );
  const available = connectivity === 'online' && isCompanionConfigured();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open Pavo learning companion. ${growth.name}. ${
        available ? 'Online' : 'Online review unavailable'
      }.`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { bottom: layout.tabBarHeight + insets.bottom + spacing.lg },
        pressed && styles.pressed,
      ]}
    >
      <PeacockPhase phase={growth.phase} size={58} />
      <View style={[styles.status, available ? styles.online : styles.offline]}>
        {available ? (
          <Text style={styles.aiLabel}>AI</Text>
        ) : (
          <WifiOff size={12} color={colors.white} strokeWidth={2.8} />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: spacing.lg,
    width: 68,
    height: 68,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.primary,
    ...elevation.e3,
  },
  pressed: { opacity: 0.86, transform: [{ scale: 0.95 }] },
  status: {
    position: 'absolute',
    right: -2,
    bottom: -1,
    minWidth: 25,
    height: 25,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  online: { backgroundColor: colors.success },
  offline: { backgroundColor: colors.inkSubtle },
  aiLabel: {
    ...text.tiny,
    color: colors.white,
    fontSize: 9,
  },
});

