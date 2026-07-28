import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Camera, CheckCircle2, RefreshCw } from 'lucide-react-native';
import {
  Card,
  CardHeader,
  EmptyState,
  PrimaryButton,
  Screen,
  ScreenHeader,
} from '@/components/ui';
import { importAssignmentQr } from '@/data/repository';
import type {
  RootStackParamList,
  StudentTabParamList,
} from '@/navigation/types';
import { useSessionStore } from '@/store/session';
import { colors, radius, spacing, text } from '@/theme/tokens';

type Props = CompositeScreenProps<
  BottomTabScreenProps<StudentTabParamList, 'StudentScan'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function StudentScanScreen(_props: Props) {
  const student = useSessionStore((state) => state.student);
  const [permission, requestPermission] = useCameraPermissions();
  const [active, setActive] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handlePayload(payload: string) {
    if (!active || !student) return;
    setActive(false);
    setMessage('');
    setError('');
    try {
      const result = await importAssignmentQr(payload, student.id);
      setMessage(
        result.added === 0
          ? 'This assignment is already in your task list.'
          : `Added ${result.added} of ${result.total} task${
              result.total === 1 ? '' : 's'
            } to your dashboard.`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'This is not a valid Pavo assignment.',
      );
    }
  }

  if (!permission) {
    return (
      <Screen>
        <ScreenHeader title="Scan assignment" />
        <Text style={styles.body}>Checking camera permission...</Text>
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen>
        <ScreenHeader
          title="Scan assignment"
          subtitle="Assignment QR codes are saved only on this device."
        />
        <EmptyState
          title="Camera permission"
          body="Pavo needs the camera only while scanning your teacher's assignment QR."
          expression="encouraging"
          action={
            <PrimaryButton
              label="Allow camera"
              icon={Camera}
              onPress={() => void requestPermission()}
            />
          }
        />
      </Screen>
    );
  }

  return (
    <Screen scroll={false} style={styles.screen}>
      <View style={styles.header}>
        <ScreenHeader
          title="Scan assignment"
          subtitle="Point the camera at your teacher's QR."
        />
      </View>
      <View style={styles.cameraFrame}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={
            active ? ({ data }) => void handlePayload(data) : undefined
          }
        />
        <View style={styles.reticleOverlay} pointerEvents="none">
          <View style={styles.scanTarget} />
        </View>
      </View>
      <View style={styles.result}>
        {message ? (
          <Card accent={colors.success}>
            <CardHeader
              icon={CheckCircle2}
              title={message}
              color={colors.success}
            />
          </Card>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!active ? (
          <PrimaryButton
            label="Scan another"
            icon={RefreshCw}
            tone="secondary"
            onPress={() => {
              setMessage('');
              setError('');
              setActive(true);
            }}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, paddingTop: 0 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  cameraFrame: {
    flex: 1,
    minHeight: 320,
    marginHorizontal: spacing.lg,
    overflow: 'hidden',
    borderRadius: radius.lg,
    backgroundColor: colors.ink,
  },
  reticleOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanTarget: {
    width: '64%',
    aspectRatio: 1,
    borderWidth: 3,
    borderColor: colors.white,
    borderRadius: radius.lg,
  },
  result: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  body: {
    ...text.body,
    color: colors.inkMuted,
  },
  error: {
    ...text.label,
    color: colors.error,
    textAlign: 'center',
  },
});
