import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  Camera,
  CameraOff,
  CheckCircle2,
  Loader,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react-native';
import {
  Callout,
  EmptyState,
  PrimaryButton,
  Screen,
  ScreenHeader,
  Skeleton,
} from '@/components/ui';
import { importAssignmentQr } from '@/data/repository';
import type {
  RootStackParamList,
  StudentTabParamList,
} from '@/navigation/types';
import { useSessionStore } from '@/store/session';
import { colors, elevation, radius, spacing, text } from '@/theme/tokens';

type Props = CompositeScreenProps<
  BottomTabScreenProps<StudentTabParamList, 'StudentScan'>,
  NativeStackScreenProps<RootStackParamList>
>;

/** The four corner brackets that mark the readable area of the viewfinder. */
const CORNERS = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const;

export function StudentScanScreen(_props: Props) {
  const student = useSessionStore((state) => state.student);
  const [permission, requestPermission] = useCameraPermissions();
  const [active, setActive] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [frame, setFrame] = useState({ width: 0, height: 0 });

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
        <ScreenHeader
          overline="Assignments"
          title="Scan assignment"
          subtitle="Assignment codes are read on this device — nothing is uploaded."
        />
        <Callout
          icon={ShieldCheck}
          tone="info"
          title="Checking camera access"
          body="One moment — Pavo is confirming whether the camera is available."
        />
        <Skeleton width="100%" height={280} style={styles.permissionSkeleton} />
      </Screen>
    );
  }

  if (!permission.granted) {
    const blocked = !permission.canAskAgain;
    return (
      <Screen>
        <ScreenHeader
          overline="Assignments"
          title="Scan assignment"
          subtitle="Assignment codes are read on this device — nothing is uploaded."
        />
        <Callout
          icon={CameraOff}
          tone={blocked ? 'error' : 'warning'}
          title={blocked ? 'Camera access is blocked' : 'Camera access needed'}
          body={
            blocked
              ? 'Open your device settings and allow the camera for Pavo, then come back to this screen.'
              : 'Pavo opens the camera only while you are scanning — no photos are stored or sent.'
          }
        />
        <EmptyState
          title="Ready when the camera is"
          body="Allow the camera and Pavo will read your teacher's assignment QR in a second."
          expression="encouraging"
          action={
            <PrimaryButton
              label="Allow camera"
              icon={Camera}
              disabled={blocked}
              onPress={() => void requestPermission()}
            />
          }
        />
      </Screen>
    );
  }

  const status = describeStatus({ active, message, error });
  const windowSize = Math.max(
    180,
    Math.min(frame.width * 0.74, frame.height * 0.58),
  );

  return (
    <Screen scroll={false} style={styles.screen}>
      <View style={styles.headerBlock}>
        <ScreenHeader
          overline="Assignments"
          title="Scan assignment"
          subtitle="Point the camera at your teacher's QR code."
        />
      </View>

      <View
        style={styles.viewfinder}
        onLayout={(event) =>
          setFrame({
            width: event.nativeEvent.layout.width,
            height: event.nativeEvent.layout.height,
          })
        }
        accessible
        accessibilityRole="image"
        accessibilityLabel="Camera viewfinder for assignment QR codes"
        accessibilityHint="Hold your teacher's QR code inside the bracketed square"
        accessibilityValue={{ text: status.label }}
      >
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={
            active ? ({ data }) => void handlePayload(data) : undefined
          }
        />
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.scrimTop}>
            <Text style={styles.instruction} numberOfLines={2}>
              Hold the QR code inside the frame
            </Text>
          </View>
          <View style={styles.windowRow}>
            <View style={styles.scrimSide} />
            <View style={[styles.window, { width: windowSize, height: windowSize }]}>
              {frame.width > 0
                ? CORNERS.map((corner) => (
                    <View key={corner} style={[styles.corner, styles[corner]]} />
                  ))
                : null}
            </View>
            <View style={styles.scrimSide} />
          </View>
          <View style={styles.scrimBottom}>
            <View style={styles.statusPill}>
              <status.icon size={16} color={status.color} />
              <Text style={styles.statusText} numberOfLines={1}>
                {status.label}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.results}>
        {message ? (
          <Callout
            icon={CheckCircle2}
            tone="success"
            title="Assignment added"
            body={message}
          />
        ) : null}
        {error ? (
          <Callout
            icon={TriangleAlert}
            tone="error"
            title="That code could not be read"
            body={error}
          />
        ) : null}
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

function describeStatus({
  active,
  message,
  error,
}: {
  active: boolean;
  message: string;
  error: string;
}): { icon: LucideIcon; color: string; label: string } {
  if (active) {
    return {
      icon: ScanLine,
      color: colors.onBrand,
      label: 'Searching for a QR code…',
    };
  }
  if (message) {
    return {
      icon: CheckCircle2,
      color: colors.successTint,
      label: 'Assignment added',
    };
  }
  if (error) {
    return {
      icon: TriangleAlert,
      color: colors.errorTint,
      label: 'Scan failed — try again',
    };
  }
  return { icon: Loader, color: colors.onBrand, label: 'Reading the code…' };
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, gap: spacing.md },
  headerBlock: { paddingHorizontal: spacing.xl },

  viewfinder: {
    flex: 1,
    minHeight: 320,
    marginHorizontal: spacing.xl,
    overflow: 'hidden',
    borderRadius: radius.xl,
    backgroundColor: colors.canopyDeep,
    ...elevation.e2,
  },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },

  scrimTop: {
    flex: 1,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  scrimSide: { flex: 1, backgroundColor: colors.scrim },
  scrimBottom: {
    flex: 1.15,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  windowRow: { flexDirection: 'row' },
  window: { borderRadius: radius.lg },

  corner: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderColor: colors.accent,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: radius.lg,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: radius.lg,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: radius.lg,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: radius.lg,
  },

  instruction: {
    ...text.label,
    color: colors.onBrand,
    textAlign: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 34,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.onBrandLine,
    backgroundColor: colors.onBrandSurface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  statusText: { ...text.caption, color: colors.onBrand, fontWeight: '700' },

  results: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  permissionSkeleton: { borderRadius: radius.xl },
});
