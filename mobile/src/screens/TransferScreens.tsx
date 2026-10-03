import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CameraView } from 'expo-camera';
import {
  Bluetooth,
  CheckCircle2,
  Download,
  FileText,
  QrCode,
  Radio,
  RefreshCw,
  ScanLine,
  Send,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
  WifiOff,
  X,
  XCircle,
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import {
  Callout,
  Card,
  CardHeader,
  Chip,
  Divider,
  ListRow,
  PrimaryButton,
  ProgressBar,
  Screen,
  ScreenHeader,
  SectionHeader,
  StatusBadge,
} from '@/components/ui';
import { listCustomReviewSets, listReviewItems } from '@/data/mvpRepository';
import { getTeacherProfile } from '@/data/repository';
import { redistributionDecision, type TransferRole } from '@/domain/packageV2';
import {
  TERMINAL_STATES,
  TRANSFER_STATE_LABELS,
  pairingQr,
  parsePairingQr,
  type TransferState,
} from '@/domain/transferProtocol';
import type { RootStackParamList } from '@/navigation/types';
import { buildReviewSetPackage } from '@/services/files';
import { inspectLearningPackage } from '@/services/learningPackages';
import { NEARBY_UNAVAILABLE_MESSAGES, nearby } from '@/services/nearby';
import {
  ReceiverSession,
  SenderSession,
  sendableFromInstalled,
  sendableFromLegacy,
  useTransferSession,
  type SendablePackage,
  type TransferSnapshot,
} from '@/services/nearbyTransfer';
import { getInstalledPackage } from '@/services/packagesV2';
import { useSessionStore } from '@/store/session';
import { colors, radius, spacing, text } from '@/theme/tokens';

type SendProps = NativeStackScreenProps<RootStackParamList, 'Transfer'>;
type ReceiveProps = NativeStackScreenProps<RootStackParamList, 'ReceiveTransfer'>;

const TYPE_LABELS: Record<SendablePackage['packageType'], string> = {
  lesson: 'Lesson',
  quiz: 'Mini-quiz',
  teacher_bundle: 'Teacher bundle',
  legacy_module: 'Module',
  legacy_study: 'Study package',
};

function useIdentity(): { role: TransferRole; name: string; ownerId: string } | null {
  const student = useSessionStore((state) => state.student);
  const [identity, setIdentity] = useState<{ role: TransferRole; name: string; ownerId: string } | null>(
    student ? { role: 'student', name: student.firstName, ownerId: `student:${student.id}` } : null,
  );
  useEffect(() => {
    if (student) return;
    void getTeacherProfile().then((teacher) =>
      setIdentity({ role: 'teacher', name: teacher?.name ?? 'Teacher', ownerId: `teacher:${teacher?.teacherId ?? 'local'}` }),
    );
  }, [student]);
  return identity;
}

/* ────────────────────────────────────────────────────────────────────────
   Send nearby
   ──────────────────────────────────────────────────────────────────────── */

export function NearbySendScreen({ navigation, route }: SendProps) {
  const identity = useIdentity();
  const [item, setItem] = useState<SendablePackage | null>(null);
  const [error, setError] = useState('');
  const [receiverRole, setReceiverRole] = useState<TransferRole>('student');

  useEffect(() => {
    void (async () => {
      try {
        const params = route.params ?? {};
        if (params.v2PackageId) {
          const installed = await getInstalledPackage(params.v2PackageId, params.v2Version);
          if (!installed) throw new Error('This package is not on this device yet.');
          setItem(sendableFromInstalled(installed));
          if (installed.manifest.audience === 'teacher') setReceiverRole('teacher');
        } else if (params.packageUri) {
          setItem(sendableFromLegacy(await inspectLearningPackage(params.packageUri, params.displayName)));
        } else if (params.setId) {
          const [sets, items] = await Promise.all([listCustomReviewSets(), listReviewItems()]);
          const set = sets.find((candidate) => candidate.setId === params.setId);
          if (!set) throw new Error('This review set was not found.');
          setItem(sendableFromLegacy(await buildReviewSetPackage(set, items)));
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'The package could not be prepared.');
      }
    })();
  }, [route.params]);

  if (!identity || (!item && !error)) {
    return (
      <Screen>
        <ScreenHeader overline="Share" title="Send nearby" onBack={navigation.goBack} />
        <Callout icon={FileText} tone="info" title="Preparing" body="Checking the package on this device…" />
      </Screen>
    );
  }
  if (error || !item) {
    return (
      <Screen>
        <ScreenHeader overline="Share" title="Send nearby" onBack={navigation.goBack} />
        <Callout icon={XCircle} tone="error" title="Nothing to send" body={error || 'Choose a package to send first.'} />
      </Screen>
    );
  }
  const blocked =
    identity.role === 'student'
      ? redistributionDecision(
          { audience: item.audience, packageType: item.packageType === 'legacy_module' || item.packageType === 'legacy_study' ? 'lesson' : item.packageType, redistribution: { studentToStudent: item.allowsStudentSharing, teacherToTeacher: false, expiresAt: item.expiresAt ? new Date(item.expiresAt).toISOString() : null } },
          'student',
          'student',
        )
      : { allowed: true as const };
  return (
    <SendFlow
      key={`${item.packageId}-${receiverRole}`}
      item={item}
      identity={identity}
      receiverRole={identity.role === 'student' ? 'student' : receiverRole}
      onReceiverRole={identity.role === 'teacher' && item.audience === 'student' ? setReceiverRole : null}
      blockedReason={blocked.allowed ? null : blocked.reason}
      onBack={navigation.goBack}
    />
  );
}

function SendFlow({
  item,
  identity,
  receiverRole,
  onReceiverRole,
  blockedReason,
  onBack,
}: {
  item: SendablePackage;
  identity: { role: TransferRole; name: string };
  receiverRole: TransferRole;
  onReceiverRole: ((role: TransferRole) => void) | null;
  blockedReason: string | null;
  onBack: () => void;
}) {
  const { session, snapshot } = useTransferSession(() => new SenderSession(identity.role, identity.name, item, receiverRole));
  const [scanning, setScanning] = useState(false);
  const started = snapshot.state !== 'preparing';
  const terminal = TERMINAL_STATES.includes(snapshot.state);
  const unavailable = nearby.availability();

  return (
    <Screen>
      <ScreenHeader overline="Share" title="Send nearby" subtitle="Device to device. No internet, router, or account needed." onBack={onBack} />
      <PackageCard item={item} sender={`${identity.name} - ${identity.role === 'teacher' ? 'Teacher' : 'Student'}`} recipient={snapshot.peer?.displayName ?? `A ${receiverRole}`} />
      {blockedReason ? <Callout icon={ShieldCheck} tone="warning" title="Sharing not allowed" body={blockedReason} /> : null}
      {!unavailable.available ? <Callout icon={WifiOff} tone="warning" title="Nearby unavailable" body={NEARBY_UNAVAILABLE_MESSAGES[unavailable.reason]} /> : null}
      {onReceiverRole && !started ? (
        <View style={styles.chipRow}>
          <Chip label="To a student" selected={receiverRole === 'student'} onPress={() => onReceiverRole('student')} />
          <Chip label="To a teacher" selected={receiverRole === 'teacher'} onPress={() => onReceiverRole('teacher')} />
        </View>
      ) : null}

      <StateCard snapshot={snapshot} />

      {!started ? (
        <PrimaryButton label="Send nearby" icon={Send} disabled={Boolean(blockedReason) || !unavailable.available} onPress={() => void session?.start()} />
      ) : null}

      {(snapshot.state === 'looking' || snapshot.state === 'device_found') && !snapshot.peer ? (
        <>
          <SectionHeader title="Nearby PAVO devices" caption="Ask the other person to tap Receive nearby" />
          {snapshot.peers.length ? (
            <Card>
              {snapshot.peers.map((peer, index) => (
                <View key={peer.id}>
                  {index > 0 ? <Divider /> : null}
                  <ListRow
                    icon={Smartphone}
                    color={peer.role === 'teacher' ? colors.primary : colors.secondary}
                    title={peer.role ? `${peer.displayName} - ${peer.role === 'teacher' ? 'Teacher' : 'Student'}` : peer.name}
                    subtitle={peer.sessionCode ? `Session ${peer.sessionCode}` : 'Tap to connect'}
                    onPress={() => void session?.select(peer)}
                  />
                </View>
              ))}
            </Card>
          ) : (
            <Callout icon={Radio} tone="info" title="Looking for devices" body="Keep both phones close together with Bluetooth on." />
          )}
          <PrimaryButton label="Scan their pairing QR" icon={QrCode} tone="ghost" onPress={() => setScanning(true)} />
        </>
      ) : null}

      <VerificationCard snapshot={snapshot} onAnswer={(matches) => void session?.confirmCode(matches)} />

      {snapshot.state === 'paused' || (snapshot.state === 'failed' && snapshot.bytes > 0) ? (
        <PrimaryButton label="Retry and resume" icon={RefreshCw} onPress={() => void session?.retry()} />
      ) : null}
      {started && !terminal ? <PrimaryButton label="Cancel transfer" icon={X} tone="danger" onPress={() => void session?.cancel()} /> : null}
      {terminal ? <PrimaryButton label="Done" icon={CheckCircle2} tone="secondary" onPress={onBack} /> : null}

      <Modal visible={scanning} animationType="slide" onRequestClose={() => setScanning(false)}>
        <Screen scroll={false}>
          <ScreenHeader title="Scan pairing QR" subtitle="Shown on the receiving device" onBack={() => setScanning(false)} />
          <View style={styles.camera}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => {
                const code = parsePairingQr(data);
                if (!code) return;
                session?.pairWithCode(code);
                setScanning(false);
              }}
            />
          </View>
          <Callout icon={ShieldCheck} tone="info" title="Only a session code" body="The pairing QR identifies the device. The package itself always travels over the verified connection." />
        </Screen>
      </Modal>
    </Screen>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Receive nearby
   ──────────────────────────────────────────────────────────────────────── */

export function NearbyReceiveScreen({ navigation }: ReceiveProps) {
  const identity = useIdentity();
  if (!identity) {
    return (
      <Screen>
        <ScreenHeader overline="Share" title="Receive nearby" onBack={navigation.goBack} />
      </Screen>
    );
  }
  return <ReceiveFlow identity={identity} navigation={navigation} />;
}

function ReceiveFlow({
  identity,
  navigation,
}: {
  identity: { role: TransferRole; name: string; ownerId: string };
  navigation: ReceiveProps['navigation'];
}) {
  const { session, snapshot } = useTransferSession(() => new ReceiverSession(identity.role, identity.name, identity.ownerId));
  const started = snapshot.state !== 'preparing';
  const terminal = TERMINAL_STATES.includes(snapshot.state);
  const unavailable = nearby.availability();
  const offer = snapshot.offer;
  const installed = session?.lastImport?.installed;

  return (
    <Screen>
      <ScreenHeader overline="Share" title="Receive nearby" subtitle="Nothing is installed until you approve it and it passes every check." onBack={navigation.goBack} />
      {!unavailable.available ? <Callout icon={WifiOff} tone="warning" title="Nearby unavailable" body={NEARBY_UNAVAILABLE_MESSAGES[unavailable.reason]} /> : null}
      <StateCard snapshot={snapshot} />
      {!started ? <PrimaryButton label="Receive nearby" icon={Download} disabled={!unavailable.available} onPress={() => void session?.start()} /> : null}

      {snapshot.state === 'looking' && snapshot.sessionCode ? (
        <Card style={styles.center}>
          <Text style={styles.caption}>
            Visible as {identity.name} - {identity.role === 'teacher' ? 'Teacher' : 'Student'} · {snapshot.sessionCode}
          </Text>
          <View style={styles.qrFrame}>
            <QRCode value={pairingQr(snapshot.sessionCode)} size={180} ecl="M" />
          </View>
          <Text style={styles.caption}>The sender can scan this to pick your device. It contains only the session code.</Text>
        </Card>
      ) : null}

      <VerificationCard snapshot={snapshot} onAnswer={(matches) => void session?.confirmCode(matches)} />

      {snapshot.state === 'awaiting_approval' && offer ? (
        <Card accent={colors.primary}>
          <CardHeader icon={FileText} title={offer.displayName} subtitle="Review before accepting" />
          <Detail label="Type" value={TYPE_LABELS[offer.packageType]} />
          <Detail label="Version" value={`${offer.packageVersion}`} />
          <Detail label="From" value={`${offer.senderName} - ${offer.senderRole === 'teacher' ? 'Teacher' : 'Student'}`} />
          <Detail label="To" value={`${identity.name} - ${identity.role === 'teacher' ? 'Teacher' : 'Student'}`} />
          <Detail label="Size" value={formatBytes(offer.byteSize)} />
          {snapshot.bytes > 0 ? <Text style={styles.caption}>Resuming from {formatBytes(snapshot.bytes)} kept from the last try.</Text> : null}
          <View style={styles.row}>
            <View style={styles.flex}>
              <PrimaryButton label="Decline" icon={X} tone="secondary" onPress={() => void session?.decide(false)} />
            </View>
            <View style={styles.flex}>
              <PrimaryButton label="Accept" icon={CheckCircle2} onPress={() => void session?.decide(true)} />
            </View>
          </View>
        </Card>
      ) : null}

      {snapshot.state === 'completed' && installed ? (
        installed.manifest.packageType === 'lesson' ? (
          <PrimaryButton label="Open lesson" icon={FileText} onPress={() => navigation.replace('Lesson', { packageId: installed.manifest.packageId, version: installed.manifest.version })} />
        ) : installed.manifest.packageType === 'quiz' && installed.manifest.assessment ? (
          <PrimaryButton
            label="Open mini-quiz"
            icon={ScanLine}
            onPress={() => navigation.replace('MiniQuiz', { quizId: installed.manifest.assessment!.quizId, version: installed.manifest.assessment!.quizVersion })}
          />
        ) : null
      ) : null}
      {started && !terminal ? <PrimaryButton label="Cancel" icon={X} tone="danger" onPress={() => void session?.cancel()} /> : null}
      {terminal ? <PrimaryButton label="Done" icon={CheckCircle2} tone="secondary" onPress={navigation.goBack} /> : null}
    </Screen>
  );
}

/* ── Shared pieces ──────────────────────────────────────────────────── */

const STATE_TONE: Partial<Record<TransferState, 'success' | 'warning' | 'error'>> = {
  completed: 'success',
  paused: 'warning',
  reconnecting: 'warning',
  rejected: 'error',
  cancelled: 'warning',
  failed: 'error',
  insufficient_storage: 'error',
  permission_denied: 'error',
  unsupported_package: 'error',
  integrity_failure: 'error',
  duplicate_package: 'warning',
};

function StateCard({ snapshot }: { snapshot: TransferSnapshot }) {
  const tone = STATE_TONE[snapshot.state];
  const showProgress = ['sending', 'resuming', 'paused', 'reconnecting', 'verifying', 'importing', 'completed'].includes(snapshot.state) && snapshot.total > 0;
  return (
    <Card accent={tone === 'success' ? colors.success : tone === 'error' ? colors.error : tone === 'warning' ? colors.warning : colors.primary}>
      <View style={styles.rowBetween}>
        <View style={styles.row}>
          {tone === 'error' ? <TriangleAlert size={18} color={colors.error} /> : <Bluetooth size={18} color={colors.primary} />}
          <Text style={styles.stateLabel}>{TRANSFER_STATE_LABELS[snapshot.state]}</Text>
        </View>
        <StatusBadge
          label={snapshot.state === 'completed' ? 'Done' : TERMINAL_STATES.includes(snapshot.state) ? 'Stopped' : 'Live'}
          status={snapshot.state === 'completed' ? 'completed' : TERMINAL_STATES.includes(snapshot.state) ? 'notStarted' : 'inProgress'}
        />
      </View>
      {showProgress ? (
        <>
          <ProgressBar value={snapshot.bytes / snapshot.total} accessibilityLabel={`${Math.round((snapshot.bytes / snapshot.total) * 100)} percent transferred`} />
          <Text style={styles.caption}>
            {formatBytes(snapshot.bytes)} of {formatBytes(snapshot.total)}
          </Text>
        </>
      ) : null}
      {snapshot.message ? <Text style={styles.body}>{snapshot.message}</Text> : null}
      {snapshot.receipt ? (
        <Text style={styles.caption}>
          Receipt {snapshot.receipt.transferId.slice(-8)} · {new Date(snapshot.receipt.importedAt).toLocaleTimeString()}
          {snapshot.receipt.finalSha256 ? ` · SHA-256 ${snapshot.receipt.finalSha256.slice(0, 12)}…` : ''}
        </Text>
      ) : null}
      {snapshot.throughput && snapshot.state === 'completed' ? (
        <Text style={styles.caption}>
          Measured: {formatBytes(snapshot.total)} in {snapshot.throughput.seconds.toFixed(1)} s ({formatBytes(snapshot.throughput.bytesPerSecond)}/s). Speed depends on the phones and radio conditions.
        </Text>
      ) : null}
    </Card>
  );
}

function VerificationCard({ snapshot, onAnswer }: { snapshot: TransferSnapshot; onAnswer: (matches: boolean) => void }) {
  if (snapshot.state !== 'awaiting_verification' || !snapshot.verification) return null;
  return (
    <Card accent={colors.secondary}>
      <CardHeader icon={ShieldCheck} title="Check the code on both phones" subtitle={snapshot.verification.peerName} color={colors.secondary} />
      <Text style={styles.code} accessibilityLabel={`Verification code ${snapshot.verification.code.split('').join(' ')}`}>
        {snapshot.verification.code}
      </Text>
      <View style={styles.row}>
        <View style={styles.flex}>
          <PrimaryButton label="Codes differ" icon={X} tone="secondary" onPress={() => onAnswer(false)} />
        </View>
        <View style={styles.flex}>
          <PrimaryButton label="Codes match" icon={CheckCircle2} onPress={() => onAnswer(true)} />
        </View>
      </View>
    </Card>
  );
}

function PackageCard({ item, sender, recipient }: { item: SendablePackage; sender: string; recipient: string }) {
  return (
    <Card>
      <CardHeader icon={FileText} title={item.title} subtitle={`${TYPE_LABELS[item.packageType]} · version ${item.version}`} />
      <Detail label="From" value={sender} />
      <Detail label="To" value={recipient} />
      <Detail label="Size" value={formatBytes(item.sizeBytes)} />
      <Text style={styles.hash} numberOfLines={1}>
        SHA-256 {item.sha256}
      </Text>
    </Card>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.rowBetween}>
      <Text style={styles.caption}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function formatBytes(value: number): string {
  if (value < 1_024) return `${Math.round(value)} B`;
  if (value < 1_048_576) return `${(value / 1_024).toFixed(1)} KB`;
  return `${(value / 1_048_576).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  center: { alignItems: 'center', gap: spacing.md },
  stateLabel: { ...text.bodyStrong, color: colors.ink },
  body: { ...text.body, color: colors.ink },
  caption: { ...text.caption, color: colors.inkMuted, fontWeight: '500' },
  detailValue: { ...text.bodyStrong, color: colors.ink, flexShrink: 1 },
  hash: { fontFamily: 'monospace', fontSize: 11, color: colors.inkSubtle },
  code: { ...text.display, color: colors.secondary, textAlign: 'center', letterSpacing: 6 },
  qrFrame: { padding: spacing.md, backgroundColor: colors.white, borderRadius: radius.md },
  camera: { height: 360, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.canopyDeep },
});
