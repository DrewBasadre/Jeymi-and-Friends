import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Camera, CheckCircle2, RefreshCw } from 'lucide-react-native';
import {
  Card,
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
import { colors, radius, spacing } from '@/theme/tokens';

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
          : 'This is not a valid WAIS assignment.',
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
        <Card>
          <Camera size={32} color={colors.indigo} />
          <Text style={styles.cardTitle}>Camera permission</Text>
          <Text style={styles.body}>
            WAIS needs the camera only while scanning your teacher's assignment
            QR.
          </Text>
          <PrimaryButton
            label="Allow camera"
            onPress={() => void requestPermission()}
          />
        </Card>
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
        <View style={styles.scanTarget} />
      </View>
      <View style={styles.result}>
        {message ? (
          <Card accent={colors.emerald}>
            <CheckCircle2 size={24} color={colors.emerald} />
            <Text style={styles.cardTitle}>{message}</Text>
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
    borderRadius: radius.md,
    backgroundColor: colors.ink,
  },
  scanTarget: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderWidth: 3,
    borderColor: colors.white,
    borderRadius: radius.md,
    alignSelf: 'center',
    top: '20%',
  },
  result: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '800',
  },
  body: {
    color: colors.inkMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  error: {
    color: colors.coral,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
});
