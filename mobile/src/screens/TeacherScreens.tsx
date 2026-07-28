import {
  type ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  Bluetooth,
  Bot,
  Camera,
  CheckCircle2,
  FileUp,
  QrCode,
  RefreshCw,
  Search,
  ShieldCheck,
  Upload,
  UsersRound,
  WifiOff,
} from 'lucide-react-native';
import {
  Card,
  Chip,
  EmptyState,
  Metric,
  PrimaryButton,
  Screen,
  ScreenHeader,
  SectionTitle,
} from '@/components/ui';
import {
  getAttempts,
  getLearningProfile,
  getModule,
  getPrivacyConsent,
  getTeacherDashboard,
  importQrReport,
  listModules,
} from '@/data/repository';
import type {
  AiSuggestion,
  DiagnosticInput,
  LearningModule,
  TeacherDashboard,
  TeacherLearnerRow,
  TransferPackage,
} from '@/domain/types';
import type {
  RootStackParamList,
  TeacherTabParamList,
} from '@/navigation/types';
import { generateDiagnostic, generateLessonPlan, type LessonPlanResult } from '@/services/ai';
import { pickPdfPackage } from '@/services/files';
import {
  nearby,
  type NearbyPeer,
  type NearbyTransferUpdate,
  type NearbyVerificationRequest,
} from '@/services/nearby';
import { useSessionStore } from '@/store/session';
import { colors, radius, spacing } from '@/theme/tokens';

type TeacherTabProps<Route extends keyof TeacherTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TeacherTabParamList, Route>,
  NativeStackScreenProps<RootStackParamList>
>;

type StackProps<Route extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  Route
>;

export function TeacherHomeScreen({ navigation }: TeacherTabProps<'TeacherHome'>) {
  const [dashboard, setDashboard] = useState<TeacherDashboard | null>(null);
  const load = useCallback(() => void getTeacherDashboard().then(setDashboard), []);
  useFocusEffect(load);

  return (
    <Screen>
      <ScreenHeader
        title="Class overview"
        subtitle="Calculated from reports stored on this device."
        action={<Chip label="Offline ready" color={colors.emerald} selected />}
      />
      <View style={styles.metricGrid}>
        <Metric label="Class average" value={`${dashboard?.classAverage ?? 0}%`} tint={colors.indigoTint} />
        <Metric label="Learners" value={dashboard?.learners.length ?? 0} tint={colors.emeraldTint} />
        <Metric label="Need support" value={dashboard?.strugglingStudents.length ?? 0} tint={colors.amberTint} />
      </View>
      <Card accent={colors.emerald}>
        <View style={styles.headingRow}>
          <UsersRound size={22} color={colors.emerald} />
          <SectionTitle>Leaderboard</SectionTitle>
        </View>
        {(dashboard?.leaderboard ?? []).slice(0, 5).map((learner, index) => (
          <Pressable
            key={learner.studentId}
            style={styles.learnerRow}
            onPress={() => navigation.navigate('LearnerDetail', { studentId: learner.studentId })}
          >
            <Text style={styles.rank}>{index + 1}</Text>
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>{learner.displayName}</Text>
              <Text style={styles.rowMeta}>{learner.section} - {learner.totalAttempts} attempts</Text>
            </View>
            <Text style={styles.rowScore}>{learner.averageScore}%</Text>
          </Pressable>
        ))}
        {!dashboard?.learners.length ? (
          <EmptyState title="No scanned reports" body="Use the scanner to build the local class dashboard." />
        ) : null}
      </Card>
      <PrimaryButton
        label="Distribute PDF modules"
        icon={Bluetooth}
        tone="secondary"
        onPress={() => navigation.navigate('Transfer')}
      />
    </Screen>
  );
}

export function RecordBookScreen({ navigation }: TeacherTabProps<'RecordBook'>) {
  const [dashboard, setDashboard] = useState<TeacherDashboard | null>(null);
  const [query, setQuery] = useState('');
  useFocusEffect(useCallback(() => void getTeacherDashboard().then(setDashboard), []));

  const learners = useMemo(() => {
    const value = query.trim().toLocaleLowerCase();
    if (!value) return dashboard?.learners ?? [];
    return (dashboard?.learners ?? []).filter((learner) =>
      `${learner.displayName} ${learner.studentNumber} ${learner.section}`.toLocaleLowerCase().includes(value),
    );
  }, [dashboard, query]);

  return (
    <Screen scroll={false} style={styles.flex}>
      <View style={styles.fixedHeader}>
        <ScreenHeader title="Record book" subtitle="Local reports and intervention flags." />
        <View style={styles.searchBox}>
          <Search size={19} color={colors.inkMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Find a learner"
            placeholderTextColor={colors.inkMuted}
            style={styles.searchInput}
          />
        </View>
      </View>
      <FlatList
        data={learners}
        keyExtractor={(learner) => learner.studentId}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate('LearnerDetail', { studentId: item.studentId })}>
            <Card accent={item.struggling ? colors.amber : colors.emerald}>
              <View style={styles.rowBetween}>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>{item.displayName}</Text>
                  <Text style={styles.rowMeta}>{item.studentNumber} - {item.section}</Text>
                </View>
                <Chip
                  label={item.struggling ? 'Support' : `${item.averageScore}%`}
                  color={item.struggling ? colors.amber : colors.emerald}
                  selected
                />
              </View>
              <Text style={styles.body}>Practice next: {item.weakTopic}</Text>
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={<EmptyState title="No matching learner" body="Scan a student profile or quiz report to add it." />}
      />
    </Screen>
  );
}

export function ScannerScreen(): ReactElement {
  const [permission, requestPermission] = useCameraPermissions();
  const [active, setActive] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function handlePayload(payload: string) {
    if (!active) return;
    setActive(false);
    setError('');
    try {
      setMessage(await importQrReport(payload));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'This is not a valid WAIS report.');
    }
  }

  if (!permission) {
    return <Screen><ScreenHeader title="QR scanner" /><Text style={styles.body}>Checking camera permission...</Text></Screen>;
  }
  if (!permission.granted) {
    return (
      <Screen>
        <ScreenHeader title="QR scanner" subtitle="Reports are decoded and stored locally." />
        <Card>
          <Camera size={32} color={colors.indigo} />
          <Text style={styles.cardTitle}>Camera permission</Text>
          <Text style={styles.body}>WAIS needs the camera only while scanning a classroom QR code.</Text>
          <PrimaryButton label="Allow camera" onPress={() => void requestPermission()} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen scroll={false} style={styles.scannerScreen}>
      <View style={styles.scannerHeader}>
        <ScreenHeader title="QR scanner" subtitle="No internet required." />
      </View>
      <View style={styles.cameraFrame}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={active ? ({ data }) => void handlePayload(data) : undefined}
        />
        <View style={styles.scanTarget} />
      </View>
      <View style={styles.scanResult}>
        {message ? (
          <Card accent={colors.emerald}>
            <CheckCircle2 size={24} color={colors.emerald} />
            <Text style={styles.rowTitle}>{message}</Text>
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

export function GurobotScreen(): ReactElement {
  const canUseOnline = useSessionStore((state) => state.canUseOnlineEnhancements);
  const [topic, setTopic] = useState('Properties of Materials');
  const [subject, setSubject] = useState<'SCIENCE' | 'MATH' | 'ENGLISH'>('SCIENCE');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LessonPlanResult | null>(null);

  async function generate() {
    setLoading(true);
    try {
      setResult(
        await generateLessonPlan({
          gradeLevel: 5,
          subject,
          quarter: 1,
          competencyCode: 'Teacher-selected competency',
          topic: topic.trim(),
          learningStyle: 'balanced',
          availableMaterials: ['paper', 'pencil', 'local objects'],
        }),
      );
    } catch (error) {
      Alert.alert('Online lesson planning unavailable', error instanceof Error ? error.message : 'Try again later.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader
        title="Gurobot"
        subtitle="AI lesson planning is an online enhancement through a protected server function."
      />
      {!canUseOnline ? (
        <Card accent={colors.amber}>
          <WifiOff size={25} color={colors.amber} />
          <Text style={styles.cardTitle}>Available in full mode</Text>
          <Text style={styles.body}>Switch device mode in the student profile or settings when this device has connectivity.</Text>
        </Card>
      ) : null}
      <Card>
        <Text style={styles.fieldLabel}>Subject</Text>
        <View style={styles.chipRow}>
          {(['SCIENCE', 'MATH', 'ENGLISH'] as const).map((option) => (
            <Chip
              key={option}
              label={option}
              selected={subject === option}
              onPress={() => setSubject(option)}
            />
          ))}
        </View>
        <Text style={styles.fieldLabel}>Lesson topic</Text>
        <TextInput
          value={topic}
          onChangeText={setTopic}
          style={styles.input}
          placeholder="Topic or competency"
          placeholderTextColor={colors.inkMuted}
        />
        <PrimaryButton
          label="Generate lesson plan"
          icon={Bot}
          loading={loading}
          disabled={!canUseOnline || !topic.trim()}
          onPress={() => void generate()}
        />
      </Card>
      {result ? (
        <Card accent={colors.indigo}>
          <Text style={styles.cardTitle}>{result.title}</Text>
          <ResultSection label="Objectives" items={result.objectives} />
          <ResultSection label="Lesson flow" items={result.lessonFlow} />
          <ResultSection label="Assessment" items={result.assessment} />
          <ResultSection label="Remediation" items={result.remediation} />
        </Card>
      ) : null}
    </Screen>
  );
}

export function LearnerDetailScreen({ navigation, route }: StackProps<'LearnerDetail'>) {
  const [learner, setLearner] = useState<TeacherLearnerRow | null>(null);
  const [suggestion, setSuggestion] = useState<AiSuggestion | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void getTeacherDashboard().then((dashboard) => {
      setLearner(dashboard.learners.find((item) => item.studentId === route.params.studentId) ?? null);
    });
  }, [route.params.studentId]);

  async function analyze() {
    if (!learner) return;
    setLoading(true);
    const [attempts, profile, modules, consent] = await Promise.all([
      getAttempts(learner.studentId),
      getLearningProfile(learner.studentId),
      listModules(learner.studentId),
      getPrivacyConsent(learner.studentId),
    ]);
    const latest = attempts[0];
    const module = latest ? modules.find((item) => item.id === latest.moduleId) : null;
    const input: DiagnosticInput = {
      gradeLevel: 5,
      subject: module?.subject ?? 'ADDED_MATERIALS',
      competencyCode: module?.competencyCode ?? 'General progress',
      scoreBand: scoreBand(learner.averageScore),
      durationBand: latest && latest.durationSeconds > 420 ? 'SLOW' : 'EXPECTED',
      topicOutcomeCounts: latest
        ? [
            { topic: latest.strongTopic, correct: latest.score, incorrect: 0 },
            { topic: latest.weakTopic, correct: 0, incorrect: Math.max(0, latest.totalItems - latest.score) },
          ]
        : [],
      attemptTrend: attempts.length < 2 ? 'FIRST_ATTEMPT' : attempts[0]!.score >= attempts[1]!.score ? 'IMPROVING' : 'DECLINING',
      learningStyleTag: profile?.primaryStyle ?? 'balanced',
    };
    setSuggestion(await generateDiagnostic(input, consent?.aiDiagnosticsAllowed === true));
    setLoading(false);
  }

  return (
    <Screen>
      <ScreenHeader title={learner?.displayName ?? 'Learner'} subtitle={learner?.studentNumber} onBack={navigation.goBack} />
      {learner ? (
        <>
          <View style={styles.metricGrid}>
            <Metric label="Average" value={`${learner.averageScore}%`} tint={colors.indigoTint} />
            <Metric label="Attempts" value={learner.totalAttempts} tint={colors.emeraldTint} />
            <Metric label="Completed" value={learner.completedModules} tint={colors.amberTint} />
          </View>
          <Card>
            <Text style={styles.fieldLabel}>Practice next</Text>
            <Text style={styles.cardTitle}>{learner.weakTopic}</Text>
          </Card>
          <PrimaryButton
            label="Suggest teaching approach"
            icon={Bot}
            loading={loading}
            onPress={() => void analyze()}
          />
          {suggestion ? (
            <Card accent={suggestion.source === 'edge' ? colors.indigo : colors.emerald}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>Teaching suggestions</Text>
                <Chip label={suggestion.source === 'edge' ? 'Online AI' : 'Offline guide'} selected color={colors.emerald} />
              </View>
              <Text style={styles.body}>{suggestion.summary}</Text>
              {suggestion.actions.map((action) => <Text key={action} style={styles.bullet}>• {action}</Text>)}
              <Text style={styles.fieldLabel}>Monitoring</Text>
              <Text style={styles.body}>{suggestion.monitoringPlan}</Text>
              <View style={styles.privacyLine}>
                <ShieldCheck size={18} color={colors.emerald} />
                <Text style={styles.privacyText}>No name, student number, birthday, section, or raw answers were sent.</Text>
              </View>
            </Card>
          ) : null}
        </>
      ) : <EmptyState title="Learner not found" body="Scan the learner’s report again." />}
    </Screen>
  );
}

export function TransferScreen({ navigation }: StackProps<'Transfer'>) {
  const [transferPackage, setTransferPackage] = useState<TransferPackage | null>(null);
  const [peers, setPeers] = useState<NearbyPeer[]>([]);
  const [update, setUpdate] = useState<NearbyTransferUpdate | null>(null);
  const available = nearby.isAvailable();

  useEffect(() => {
    const peerSubscription = nearby.addPeerListener(setPeers);
    const transferSubscription = nearby.addTransferListener(setUpdate);
    const verificationSubscription = nearby.addVerificationListener(
      showVerification,
    );
    const connectionSubscription = nearby.addConnectionListener(
      (connection) => {
        setPeers((current) =>
          current.map((peer) =>
            peer.id === connection.peerId
              ? { ...peer, connected: connection.state === 'connected' }
              : peer,
          ),
        );
      },
    );
    return () => {
      peerSubscription?.remove();
      transferSubscription?.remove();
      verificationSubscription?.remove();
      connectionSubscription?.remove();
      void nearby.stop();
    };
  }, []);

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

  async function selectPdf() {
    try {
      setTransferPackage(await pickPdfPackage());
    } catch (error) {
      Alert.alert('PDF not selected', error instanceof Error ? error.message : 'Could not open this file.');
    }
  }

  async function findDevices() {
    try {
      await nearby.discover();
    } catch (error) {
      Alert.alert('Nearby unavailable', error instanceof Error ? error.message : 'Use a physical development build.');
    }
  }

  async function pairOrSend(peer: NearbyPeer) {
    try {
      if (!peer.connected) {
        await nearby.connect(peer.id);
        return;
      }
      if (!transferPackage) return;
      setUpdate({
        transferId: 'pending',
        status: 'connecting',
        bytesTransferred: 0,
        totalBytes: transferPackage.sizeBytes,
      });
      await nearby.send(peer.id, transferPackage);
    } catch (error) {
      Alert.alert(
        'Transfer could not start',
        error instanceof Error ? error.message : 'Try pairing again.',
      );
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Offline module transfer" subtitle="Teacher to student PDF packages" onBack={navigation.goBack} />
      <Card accent={available ? colors.emerald : colors.amber}>
        <View style={styles.headingRow}>
          <Bluetooth size={25} color={available ? colors.emerald : colors.amber} />
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>{available ? 'Nearby is ready' : 'Development build required'}</Text>
            <Text style={styles.body}>
              {available
                ? 'Nearby Connections can use Bluetooth and local Wi-Fi without internet.'
                : 'PDF inspection works here; device-to-device transfer requires the native Nearby module on physical devices.'}
            </Text>
          </View>
        </View>
      </Card>
      <PrimaryButton label="Choose PDF package" icon={FileUp} tone="secondary" onPress={() => void selectPdf()} />
      {transferPackage ? (
        <Card>
          <Text style={styles.cardTitle}>{transferPackage.displayName}</Text>
          <Text style={styles.body}>{formatBytes(transferPackage.sizeBytes)}</Text>
          <Text style={styles.hash} numberOfLines={2}>SHA-256 {transferPackage.sha256}</Text>
        </Card>
      ) : null}
      <PrimaryButton
        label="Find nearby student devices"
        icon={Search}
        disabled={!available || !transferPackage}
        onPress={() => void findDevices()}
      />
      {peers.map((peer) => (
        <Card key={peer.id}>
          <View style={styles.rowBetween}>
            <Text style={styles.rowTitle}>{peer.name}</Text>
            <PrimaryButton
              label={peer.connected ? 'Send' : 'Connect'}
              disabled={!transferPackage}
              onPress={() => void pairOrSend(peer)}
            />
          </View>
        </Card>
      ))}
      {update ? (
        <Card
          accent={
            update.status === 'complete'
              ? colors.emerald
              : update.status === 'failed'
                ? colors.danger
                : colors.indigo
          }
        >
          <Text style={styles.rowTitle}>{capitalize(update.status)}</Text>
          <Text style={styles.body}>{formatBytes(update.bytesTransferred)} of {formatBytes(update.totalBytes)}</Text>
          {update.errorMessage ? <Text style={styles.error}>{update.errorMessage}</Text> : null}
        </Card>
      ) : null}
    </Screen>
  );
}

function ResultSection({ label, items }: { label: string; items: string[] }) {
  return (
    <View style={styles.resultSection}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {items.map((item) => <Text key={item} style={styles.bullet}>• {item}</Text>)}
    </View>
  );
}

function scoreBand(score: number): DiagnosticInput['scoreBand'] {
  if (score >= 90) return 'ADVANCED';
  if (score >= 80) return 'PROFICIENT';
  if (score >= 60) return 'DEVELOPING';
  return 'LOW';
}

function formatBytes(value: number): string {
  if (value < 1_024) return `${value} B`;
  if (value < 1_048_576) return `${(value / 1_024).toFixed(1)} KB`;
  return `${(value / 1_048_576).toFixed(1)} MB`;
}

function capitalize(value: string): string {
  return value ? `${value[0]?.toLocaleUpperCase()}${value.slice(1)}` : value;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fixedHeader: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, gap: spacing.md },
  listContent: { padding: spacing.xl, gap: spacing.md, paddingBottom: 40 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  cardTitle: { color: colors.ink, fontSize: 19, lineHeight: 25, fontWeight: '800' },
  body: { color: colors.inkMuted, fontSize: 15, lineHeight: 22 },
  learnerRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.outline },
  rank: { width: 28, color: colors.indigo, fontSize: 18, fontWeight: '900' },
  rowTitle: { color: colors.ink, fontSize: 16, lineHeight: 22, fontWeight: '800' },
  rowMeta: { color: colors.inkMuted, fontSize: 13, lineHeight: 18 },
  rowScore: { color: colors.emerald, fontSize: 17, fontWeight: '900' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  searchBox: { minHeight: 48, borderWidth: 1, borderColor: colors.outline, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  searchInput: { flex: 1, color: colors.ink, fontSize: 16 },
  scannerScreen: { padding: 0 },
  scannerHeader: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  cameraFrame: { flex: 1, minHeight: 340, overflow: 'hidden', backgroundColor: colors.black },
  scanTarget: { position: 'absolute', alignSelf: 'center', top: '22%', width: 230, height: 230, borderWidth: 3, borderColor: colors.white, borderRadius: radius.md },
  scanResult: { padding: spacing.xl, gap: spacing.md, backgroundColor: colors.background },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  fieldLabel: { color: colors.ink, fontSize: 14, lineHeight: 20, fontWeight: '800' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.outline, borderRadius: radius.md, color: colors.ink, backgroundColor: colors.surface, paddingHorizontal: spacing.lg, fontSize: 16 },
  resultSection: { gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.outline, paddingTop: spacing.md },
  bullet: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  privacyLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.emeraldTint, padding: spacing.md, borderRadius: radius.md },
  privacyText: { flex: 1, color: colors.ink, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  hash: { color: colors.inkMuted, fontSize: 11, lineHeight: 16, fontFamily: 'monospace' },
});
