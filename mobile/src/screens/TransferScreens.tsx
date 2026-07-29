import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  CheckCircle2,
  Download,
  Radio,
  Smartphone,
  TriangleAlert,
  WifiOff,
  type LucideIcon,
} from 'lucide-react-native';
import {
  Callout,
  Card,
  CardHeader,
  Divider,
  HeroCard,
  PrimaryButton,
  ProgressBar,
  Screen,
  ScreenHeader,
  StatusBadge,
} from '@/components/ui';
import { MascotPanel } from '@/components/mascot';
import { saveReceivedModulePackage } from '@/data/repository';
import { saveLearningPackage } from '@/data/learningRepository';
import type { RootStackParamList } from '@/navigation/types';
import {
  nearby,
  type NearbyConnectionUpdate,
  type NearbyReceivedFile,
  type NearbyVerificationRequest,
} from '@/services/nearby';
import { verifyReceivedStudyPackage } from '@/services/learningPackages';
import { useSessionStore } from '@/store/session';
import { capitalize, formatDate } from '@/utils/format';
import {
  colors,
  elevation,
  gradients,
  radius,
  spacing,
  text,
} from '@/theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'ReceiveTransfer'>;

/** The receive flow, expressed as the sequence a learner actually sees. */
type Phase =
  | 'unavailable'
  | 'idle'
  | 'waiting'
  | 'connecting'
  | 'receiving'
  | 'done'
  | 'failed';

export function ReceiveTransferScreen({ navigation }: Props) {
  const student = useSessionStore((state) => state.student);
  const [advertising, setAdvertising] = useState(false);
  const [connection, setConnection] = useState<NearbyConnectionUpdate | null>(
    null,
  );
  const [received, setReceived] = useState<NearbyReceivedFile | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [startError, setStartError] = useState('');
  const started = useRef(false);
  const available = nearby.isAvailable();

  useEffect(() => {
    const verificationSubscription = nearby.addVerificationListener(
      showVerification,
    );
    const connectionSubscription = nearby.addConnectionListener(setConnection);
    const receivedSubscription = nearby.addReceivedFileListener((file) => {
      setIngesting(true);
      const save =
        file.manifest.contentCategory === 'teacherModule'
          ? saveReceivedModulePackage({
              moduleId: file.moduleId,
              displayName: file.displayName,
              fileUri: file.fileUri,
              mimeType: file.mimeType,
              sizeBytes: file.sizeBytes,
              sha256: file.sha256,
              manifest: file.manifest,
            })
          : verifyReceivedStudyPackage({
              fileUri: file.fileUri,
              expectedSha256: file.sha256,
              expectedManifest: file.manifest,
            }).then((manifest) => {
              if (!student) throw new Error('Sign in before receiving material.');
              return saveLearningPackage({
                ownerId: `student:${student.id}`,
                manifest,
                received: true,
              });
            });
      void save
        .then(() => {
          setReceived(file);
          setAdvertising(false);
        })
        .catch((error: unknown) => {
          Alert.alert(
            'Module could not be saved',
            error instanceof Error ? error.message : 'Try receiving it again.',
          );
        })
        .finally(() => setIngesting(false));
    });
    return () => {
      verificationSubscription?.remove();
      connectionSubscription?.remove();
      receivedSubscription?.remove();
      void nearby.stop();
    };
  }, [student]);

  useEffect(() => {
    if (!available || started.current) return;
    started.current = true;
    void startReceiving();
  }, [available]);

  function showVerification(request: NearbyVerificationRequest) {
    Alert.alert(
      `Connect to ${request.peerName}?`,
      `Confirm this code appears on both devices: ${request.code}`,
      [
        {
          text: 'Reject',
          style: 'cancel',
          onPress: () => void nearby.answerVerification(request.peerId, false),
        },
        {
          text: 'Codes match',
          onPress: () => void nearby.answerVerification(request.peerId, true),
        },
      ],
      { cancelable: false },
    );
  }

  async function startReceiving() {
    try {
      setStartError('');
      await nearby.advertise(`Student ${student?.firstName ?? 'Pavo'}`);
      setAdvertising(true);
    } catch (error) {
      setStartError(
        error instanceof Error
          ? error.message
          : 'Use a physical development build.',
      );
    }
  }

  const phase = derivePhase({ available, advertising, connection, received });
  const stage = STAGE[phase];
  const stepIndex = STEP_INDEX[phase];

  return (
    <Screen>
      <ScreenHeader
        overline="Nearby transfer"
        title="Receive a module"
        subtitle="Keep this screen open while the lesson package arrives."
        onBack={navigation.goBack}
      />

      <HeroCard ramp={phase === 'failed' ? gradients.night : gradients.hero}>
        <View style={styles.heroTop}>
          <View style={styles.flex}>
            <Text style={styles.heroOverline}>{stage.overline.toUpperCase()}</Text>
            <Text style={styles.heroTitle}>{stage.title}</Text>
          </View>
          <View style={styles.heroPlate}>
            <stage.icon size={22} color={colors.onBrand} />
          </View>
        </View>
        <Text style={styles.heroBody}>{stage.body}</Text>
        <View style={styles.heroProgress}>
          <ProgressBar
            value={stage.progress}
            height={8}
            trackColor={colors.onBrandLine}
            ramp={phase === 'failed' ? [colors.error, colors.error] : gradients.gold}
            accessibilityLabel={`Transfer progress — ${stage.title}`}
          />
          <Text style={styles.heroMeta}>
            {stepIndex > 0
              ? `Step ${stepIndex} of 3 — ${stage.overline}`
              : stage.overline}
          </Text>
        </View>
      </HeroCard>

      {!available ? (
        <Callout
          icon={WifiOff}
          tone="warning"
          title="Development build required"
          body="Nearby transfer needs a custom development build on a physical device. The rest of this screen is a preview."
        />
      ) : null}

      {connection?.errorMessage ? (
        <Callout
          icon={TriangleAlert}
          tone="error"
          title="Connection problem"
          body={connection.errorMessage}
        />
      ) : phase === 'failed' ? (
        <Callout
          icon={TriangleAlert}
          tone="error"
          title="Transfer did not finish"
          body="The nearby device disconnected before the module arrived — ask your teacher to send it again."
        />
      ) : null}

      <Card>
        <CardHeader
          icon={Radio}
          title="How it arrives"
          color={colors.secondary}
          action={
            connection ? (
              <StatusBadge
                label={capitalize(connection.state)}
                status={
                  connection.state === 'connected' ? 'completed' : 'inProgress'
                }
              />
            ) : null
          }
        />
        <Divider />
        <StepRow
          index={1}
          label="Make this device visible"
          caption="Your teacher's device can then find you."
          state={stepState(1, stepIndex)}
        />
        <StepRow
          index={2}
          label="Confirm the matching code"
          caption="Both screens show the same short code."
          state={stepState(2, stepIndex)}
        />
        <StepRow
          index={3}
          label="Receive and verify"
          caption="The package is checked with SHA-256 before it is saved."
          state={stepState(3, stepIndex)}
        />
      </Card>
      <PrimaryButton
        label={
          ingesting
            ? 'Checking and adding module…'
            : advertising
              ? 'Waiting for teacher…'
              : startError
                ? 'Try again'
                : 'Starting nearby receive…'
        }
        icon={advertising ? Radio : Download}
        disabled={!available || advertising || ingesting}
        onPress={() => void startReceiving()}
      />

      {startError ? (
        <Callout
          icon={TriangleAlert}
          tone="warning"
          title="Nearby receive did not start"
          body={startError}
        />
      ) : null}

      {phase === 'idle' || phase === 'unavailable' ? (
        <MascotPanel
          title="Ready when you are"
          body="Pavo is listening for a nearby teacher — the module appears here the moment it arrives."
          expression="idle"
        />
      ) : null}

      {received ? (
        <Card accent={colors.success} style={styles.successCard}>
          <CardHeader
            icon={CheckCircle2}
            title={`Received: ${received.displayName.replace(/\.pavo-module$/i, '')}`}
            subtitle="Verified and saved to this device"
            color={colors.success}
          />
          <Divider />
          <DetailLine
            label="Type"
            value={packageCategoryLabel(received.manifest.contentCategory)}
          />
          {received.manifest.contentCategory === 'teacherModule' ? (
            <>
              <DetailLine
                label="Subject"
                value={formatSubject(received.manifest.subject)}
              />
              <DetailLine
                label="Grade level"
                value={`Grade ${received.manifest.gradeLevel}`}
              />
            </>
          ) : null}
          <DetailLine label="Version" value={`Version ${received.manifest.version}`} />
          <DetailLine label="Package size" value={formatBytes(received.sizeBytes)} />
          <DetailLine label="Received" value={formatDate(Date.now())} />
          <PrimaryButton
            label={
              received.manifest.contentCategory === 'teacherModule'
                ? 'Open modules'
                : 'Open Study'
            }
            onPress={() =>
              navigation.replace('StudentTabs', {
                screen:
                  received.manifest.contentCategory === 'teacherModule'
                    ? 'Modules'
                    : 'Study',
              })
            }
          />
        </Card>
      ) : null}
    </Screen>
  );
}

/* ── Local pieces ──────────────────────────────────────────────────────── */

function StepRow({
  index,
  label,
  caption,
  state,
}: {
  index: number;
  label: string;
  caption: string;
  state: 'done' | 'active' | 'pending';
}) {
  const done = state === 'done';
  const active = state === 'active';
  return (
    <View
      style={styles.step}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Step ${index} of 3. ${label}. ${caption}`}
      accessibilityState={{ selected: active, disabled: state === 'pending' }}
    >
      <View
        style={[
          styles.stepPlate,
          done && styles.stepPlateDone,
          active && styles.stepPlateActive,
        ]}
      >
        {done ? (
          <CheckCircle2 size={18} color={colors.success} />
        ) : (
          <Text style={[styles.stepIndex, active && styles.stepIndexActive]}>
            {index}
          </Text>
        )}
      </View>
      <View style={styles.flex}>
        <Text
          style={[styles.stepLabel, state === 'pending' && styles.stepLabelPending]}
        >
          {label}
        </Text>
        <Text style={styles.stepCaption}>{caption}</Text>
      </View>
    </View>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function packageCategoryLabel(
  category: NearbyReceivedFile['manifest']['contentCategory'],
): string {
  if (category === 'teacherModule') return 'Teacher module';
  if (category === 'teacherQuiz') return 'Teacher quiz';
  if (category === 'teacherReviewer') return 'Teacher sent reviewer';
  return 'Study Jam';
}

/* ── Derivations (presentation only) ───────────────────────────────────── */

function derivePhase({
  available,
  advertising,
  connection,
  received,
}: {
  available: boolean;
  advertising: boolean;
  connection: NearbyConnectionUpdate | null;
  received: NearbyReceivedFile | null;
}): Phase {
  if (received) return 'done';
  if (
    connection?.state === 'failed' ||
    connection?.state === 'rejected' ||
    connection?.state === 'disconnected'
  ) {
    return 'failed';
  }
  if (connection?.state === 'connected') return 'receiving';
  if (connection?.state === 'connecting') return 'connecting';
  if (advertising) return 'waiting';
  if (!available) return 'unavailable';
  return 'idle';
}

const STAGE: Record<
  Phase,
  { overline: string; title: string; body: string; icon: LucideIcon; progress: number }
> = {
  unavailable: {
    overline: 'Preview',
    title: 'Transfer is unavailable here',
    body: 'This build cannot open a nearby channel — the steps below show what happens on a real device.',
    icon: WifiOff,
    progress: 0,
  },
  idle: {
    overline: 'Not started',
    title: 'Ready to receive',
    body: 'Make this device visible and a nearby teacher can send you a lesson package.',
    icon: Smartphone,
    progress: 0,
  },
  waiting: {
    overline: 'Waiting',
    title: 'Listening for a teacher',
    body: 'This device is visible nearby — keep the screen open until the module arrives.',
    icon: Radio,
    progress: 0.25,
  },
  connecting: {
    overline: 'Connecting',
    title: 'Confirming the connection',
    body: 'Check that the short code on this screen matches the one on your teacher’s device.',
    icon: Radio,
    progress: 0.5,
  },
  receiving: {
    overline: 'Receiving',
    title: 'The module is arriving',
    body: 'Stay on this screen — Pavo is copying and verifying the package right now.',
    icon: Download,
    progress: 0.75,
  },
  done: {
    overline: 'Complete',
    title: 'Module saved to this device',
    body: 'It is verified and stored offline — you can open it any time, with or without a signal.',
    icon: CheckCircle2,
    progress: 1,
  },
  failed: {
    overline: 'Interrupted',
    title: 'The transfer stopped',
    body: 'Nothing was saved. Move the devices closer together and ask your teacher to send it again.',
    icon: TriangleAlert,
    progress: 0.5,
  },
};

const STEP_INDEX: Record<Phase, number> = {
  unavailable: 0,
  idle: 0,
  waiting: 1,
  connecting: 2,
  receiving: 3,
  done: 3,
  failed: 0,
};

function stepState(step: number, current: number): 'done' | 'active' | 'pending' {
  if (current > step) return 'done';
  if (current === step) return 'active';
  return 'pending';
}

function formatSubject(subject: string): string {
  return capitalize(subject.replace(/_/g, ' ').toLocaleLowerCase());
}

function formatBytes(value: number): string {
  if (value < 1_024) return `${value} B`;
  if (value < 1_048_576) return `${(value / 1_024).toFixed(1)} KB`;
  return `${(value / 1_048_576).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },

  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  heroOverline: { ...text.overline, color: colors.onBrandSubtle },
  heroTitle: { ...text.h2, color: colors.onBrand, marginTop: 2 },
  heroBody: { ...text.bodySm, color: colors.onBrandMuted },
  heroPlate: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.onBrandSurface,
    borderWidth: 1,
    borderColor: colors.onBrandLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroProgress: { gap: spacing.sm },
  heroMeta: { ...text.caption, color: colors.onBrandSubtle, fontWeight: '700' },

  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
    paddingVertical: spacing.xs,
  },
  stepPlate: {
    width: 34,
    height: 34,
    borderRadius: radius.round,
    borderWidth: 1.5,
    borderColor: colors.outline,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepPlateDone: { backgroundColor: colors.successTint, borderColor: colors.successTint },
  stepPlateActive: { backgroundColor: colors.primaryTint, borderColor: colors.primary },
  stepIndex: { ...text.caption, color: colors.inkSubtle, fontWeight: '800' },
  stepIndexActive: { color: colors.primary },
  stepLabel: { ...text.bodyStrong, color: colors.ink },
  stepLabelPending: { color: colors.inkMuted },
  stepCaption: { ...text.caption, color: colors.inkMuted, fontWeight: '500', marginTop: 1 },

  detailLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  detailLabel: { ...text.caption, color: colors.inkMuted, fontWeight: '600' },
  detailValue: { ...text.bodyStrong, color: colors.ink, flexShrink: 1 },

  successCard: { ...elevation.e2 },
});
