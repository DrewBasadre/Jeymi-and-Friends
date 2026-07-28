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
  PencilLine,
  QrCode,
  RefreshCw,
  Search,
  Upload,
  UsersRound,
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
  getActiveSection,
  getClassPerformanceReport,
  getStudentPerformanceReport,
  getTeacherDashboard,
  importQrReport,
} from '@/data/repository';
import {
  listCustomReviewSets,
  listReviewItems,
  setStrugglingThreshold,
} from '@/data/mvpRepository';
import type {
  ClassPerformanceReport,
  LearningModule,
  Section,
  StudentPerformanceReport,
  TeacherDashboard,
  TransferPackage,
} from '@/domain/types';
import type {
  RootStackParamList,
  TeacherTabParamList,
} from '@/navigation/types';
import { buildReviewSetPackage } from '@/services/files';
import { inspectModulePackage } from '@/services/modulePackages';
import {
  nearby,
  type NearbyPeer,
  type NearbyTransferUpdate,
  type NearbyVerificationRequest,
} from '@/services/nearby';
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
  const [overallDashboard, setOverallDashboard] =
    useState<TeacherDashboard | null>(null);
  const [activeSection, setActiveSection] = useState<Section | null>(null);
  const [classReport, setClassReport] =
    useState<ClassPerformanceReport | null>(null);
  const load = useCallback(() => {
    void (async () => {
      const section = await getActiveSection();
      const [sectionDashboard, overall, report] = await Promise.all([
        getTeacherDashboard(section?.sectionId),
        getTeacherDashboard(),
        section ? getClassPerformanceReport(section.sectionId) : null,
      ]);
      setActiveSection(section);
      setDashboard(sectionDashboard);
      setOverallDashboard(overall);
      setClassReport(report);
    })();
  }, []);
  useFocusEffect(load);

  return (
    <Screen>
      <ScreenHeader
        title={activeSection?.name ?? 'Class overview'}
        subtitle={
          activeSection
            ? `Grade ${activeSection.gradeLevel} - calculated on this device.`
            : 'Choose an active section to begin.'
        }
        action={<Chip label="Offline ready" color={colors.emerald} selected />}
      />
      <View style={styles.metricGrid}>
        <Metric label="Class average" value={`${dashboard?.classAverage ?? 0}%`} tint={colors.indigoTint} />
        <Metric label="Learners" value={dashboard?.learners.length ?? 0} tint={colors.emeraldTint} />
        <Metric label="Need support" value={dashboard?.strugglingStudents.length ?? 0} tint={colors.amberTint} />
      </View>
      <Card>
        <Text style={styles.fieldLabel}>Support threshold</Text>
        <View style={styles.chipRow}>
          {[50, 60, 70].map((value) => (
            <Chip
              key={value}
              label={`${value}%`}
              selected={dashboard?.strugglingThreshold === value}
              onPress={() => {
                void setStrugglingThreshold(value).then(load);
              }}
            />
          ))}
        </View>
      </Card>
      <Card accent={colors.emerald}>
        <View style={styles.headingRow}>
          <UsersRound size={22} color={colors.emerald} />
          <SectionTitle>Active section leaderboard</SectionTitle>
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
          <EmptyState title="No rostered learners" body="Choose a section, then scan student profile QR codes." />
        ) : null}
      </Card>
      {classReport?.commonlyMissedConcepts.length ? (
        <Card accent={colors.amber}>
          <SectionTitle>Commonly missed concepts</SectionTitle>
          {classReport.commonlyMissedConcepts.slice(0, 5).map((concept) => (
            <View key={concept.conceptId} style={styles.rowBetween}>
              <Text style={styles.rowTitle}>{concept.conceptId}</Text>
              <Text style={styles.rowScore}>
                {concept.percentOfClassMissing}%
              </Text>
            </View>
          ))}
        </Card>
      ) : null}
      <Card>
        <SectionTitle>Overall leaderboard</SectionTitle>
        {(overallDashboard?.leaderboard ?? []).slice(0, 5).map(
          (learner, index) => (
            <Pressable
              key={learner.studentId}
              style={styles.learnerRow}
              onPress={() =>
                navigation.navigate('LearnerDetail', {
                  studentId: learner.studentId,
                })
              }
            >
              <Text style={styles.rank}>{index + 1}</Text>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{learner.displayName}</Text>
                <Text style={styles.rowMeta}>{learner.section}</Text>
              </View>
              <Text style={styles.rowScore}>{learner.averageScore}%</Text>
            </Pressable>
          ),
        )}
        {!overallDashboard?.learners.length ? (
          <Text style={styles.rowMeta}>
            Learners appear here after joining a managed section.
          </Text>
        ) : null}
      </Card>
      <PrimaryButton
        label="Manage sections"
        icon={UsersRound}
        tone="secondary"
        onPress={() => navigation.navigate('Sections')}
      />
      <PrimaryButton
        label="Create assignment QR"
        icon={QrCode}
        tone="secondary"
        onPress={() => navigation.navigate('AssignmentBuilder')}
      />
      <PrimaryButton
        label="Author review sets"
        icon={PencilLine}
        tone="secondary"
        onPress={() => navigation.navigate('CustomReviewSets')}
      />
      <PrimaryButton
        label="Author Markdown module"
        icon={Bluetooth}
        tone="secondary"
        onPress={() => navigation.navigate('ModuleAuthor')}
      />
    </Screen>
  );
}

export function RecordBookScreen({ navigation }: TeacherTabProps<'RecordBook'>) {
  const [dashboard, setDashboard] = useState<TeacherDashboard | null>(null);
  const [activeSection, setActiveSection] = useState<Section | null>(null);
  const [query, setQuery] = useState('');
  useFocusEffect(
    useCallback(() => {
      void getActiveSection().then(async (section) => {
        setActiveSection(section);
        setDashboard(await getTeacherDashboard(section?.sectionId));
      });
    }, []),
  );

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
        <ScreenHeader
          title="Record book"
          subtitle={
            activeSection
              ? `${activeSection.name} - local reports and intervention flags.`
              : 'Choose an active section to view its roster.'
          }
        />
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
              <Text style={styles.rowMeta}>
                {item.recommendedFormat
                  ? `${capitalize(item.recommendedFormat)} recommendation - ${Math.round(item.formatConfidence * 100)}% confidence`
                  : 'Format recommendation pending'}
              </Text>
              {item.struggling ? (
                <Text style={styles.error}>{item.strugglingReason}</Text>
              ) : null}
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
  return (
    <Screen>
      <ScreenHeader
        title="AI assist"
        subtitle="Reserved for a later online build."
      />
      <Card accent={colors.amber}>
        <Bot size={30} color={colors.amber} />
        <Text style={styles.cardTitle}>AI assist coming soon</Text>
        <Text style={styles.body}>
          Manual module authoring is fully available offline. No lesson content
          or student data leaves this device in the current Android build.
        </Text>
        <PrimaryButton
          label="AI assist coming soon"
          icon={Bot}
          disabled
          onPress={() => undefined}
        />
      </Card>
    </Screen>
  );
}

export function LearnerDetailScreen({ navigation, route }: StackProps<'LearnerDetail'>) {
  const [report, setReport] = useState<StudentPerformanceReport | null>(null);

  useEffect(() => {
    void getStudentPerformanceReport(route.params.studentId).then(setReport);
  }, [route.params.studentId]);

  return (
    <Screen>
      <ScreenHeader
        title={report?.profile.name ?? 'Learner'}
        subtitle={
          report
            ? `${report.profile.studentNumber} - ${report.profile.section}`
            : undefined
        }
        onBack={navigation.goBack}
      />
      {report ? (
        <>
          <View style={styles.metricGrid}>
            <Metric label="Average" value={`${report.averageScorePercentage}%`} tint={colors.indigoTint} />
            <Metric label="Attempts" value={report.quizHistory.length} tint={colors.emeraldTint} />
            <Metric label="Trend" value={capitalize(report.trend)} tint={colors.amberTint} />
          </View>
          <Card>
            <Text style={styles.fieldLabel}>Current learning format</Text>
            <Text style={styles.cardTitle}>
              {capitalize(report.profile.currentLearningFormat)}
            </Text>
          </Card>
          <Card accent={colors.amber}>
            <SectionTitle>Struggling concepts</SectionTitle>
            {report.strugglingConcepts.slice(0, 5).map((concept) => (
              <View key={concept.conceptId} style={styles.rowBetween}>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>{concept.conceptId}</Text>
                  <Text style={styles.rowMeta}>
                    Missed across {concept.attempts}{' '}
                    {concept.attempts === 1 ? 'attempt' : 'attempts'}
                  </Text>
                </View>
                <Chip label={`${concept.missCount} misses`} color={colors.amber} />
              </View>
            ))}
            {!report.strugglingConcepts.length ? (
              <Text style={styles.rowMeta}>No missed concepts recorded.</Text>
            ) : null}
          </Card>
          <Card>
            <SectionTitle>Quiz history</SectionTitle>
            {report.quizHistory.slice(0, 10).map((attempt) => (
              <View key={attempt.id} style={styles.rowBetween}>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>{attempt.moduleId}</Text>
                  <Text style={styles.rowMeta}>
                    {new Date(attempt.submittedAt).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={styles.rowScore}>
                  {Math.round(
                    (attempt.score / Math.max(1, attempt.totalItems)) * 100,
                  )}
                  %
                </Text>
              </View>
            ))}
            {!report.quizHistory.length ? (
              <Text style={styles.rowMeta}>No quiz reports scanned yet.</Text>
            ) : null}
          </Card>
          <PrimaryButton
            label="AI approach plan coming soon"
            icon={Bot}
            disabled
            onPress={() => undefined}
          />
        </>
      ) : <EmptyState title="Learner not found" body="Scan the learner’s report again." />}
    </Screen>
  );
}

export function TransferScreen({ navigation, route }: StackProps<'Transfer'>) {
  const [transferPackage, setTransferPackage] = useState<TransferPackage | null>(null);
  const [peers, setPeers] = useState<NearbyPeer[]>([]);
  const [update, setUpdate] = useState<NearbyTransferUpdate | null>(null);
  const available = nearby.isAvailable();

  useEffect(() => {
    const setId = route.params?.setId;
    const packageUri = route.params?.packageUri;
    if (packageUri) {
      void inspectModulePackage(packageUri, route.params?.displayName)
        .then(setTransferPackage)
        .catch((error: unknown) => {
          Alert.alert(
            'Module package unavailable',
            error instanceof Error ? error.message : 'Build the module again.',
          );
        });
      return;
    }
    if (setId) {
      void Promise.all([listCustomReviewSets(), listReviewItems()]).then(
        async ([sets, items]) => {
          const set = sets.find((candidate) => candidate.setId === setId);
          if (set) setTransferPackage(await buildReviewSetPackage(set, items));
        },
      );
    }
  }, [
    route.params?.displayName,
    route.params?.packageUri,
    route.params?.setId,
  ]);

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

  async function resumeTransfer() {
    if (!update) return;
    try {
      await nearby.retry(update.transferId);
    } catch (error) {
      Alert.alert(
        'Transfer could not resume',
        error instanceof Error
          ? error.message
          : 'Reconnect to the student device and try again.',
      );
    }
  }

  async function cancelTransfer() {
    if (!update || update.transferId === 'pending') return;
    try {
      await nearby.cancel(update.transferId);
    } catch (error) {
      Alert.alert(
        'Transfer could not be cancelled',
        error instanceof Error ? error.message : 'Try again.',
      );
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Offline module transfer" subtitle="Curriculum and review packages" onBack={navigation.goBack} />
      <Card accent={available ? colors.emerald : colors.amber}>
        <View style={styles.headingRow}>
          <Bluetooth size={25} color={available ? colors.emerald : colors.amber} />
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>{available ? 'Nearby is ready' : 'Development build required'}</Text>
            <Text style={styles.body}>
              {available
                ? 'Nearby Connections can use Bluetooth and local Wi-Fi without internet.'
                : 'Module inspection works here; device-to-device transfer requires the native Nearby module on physical devices.'}
            </Text>
          </View>
        </View>
      </Card>
      {transferPackage ? (
        <Card>
          <Text style={styles.cardTitle}>{transferPackage.displayName}</Text>
          <Text style={styles.body}>{formatBytes(transferPackage.sizeBytes)}</Text>
          <Text style={styles.rowMeta}>
            Markdown + {transferPackage.manifest.assets.length} image asset
            {transferPackage.manifest.assets.length === 1 ? '' : 's'} - manifest v
            {transferPackage.manifest.version}
          </Text>
          <Text style={styles.hash} numberOfLines={2}>SHA-256 {transferPackage.sha256}</Text>
        </Card>
      ) : (
        <PrimaryButton
          label="Author a Markdown module"
          icon={PencilLine}
          tone="secondary"
          onPress={() => navigation.replace('ModuleAuthor')}
        />
      )}
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
          {update.status === 'queued' || update.status === 'transferring' ? (
            <PrimaryButton
              label="Cancel transfer"
              tone="danger"
              onPress={() => void cancelTransfer()}
            />
          ) : null}
          {update.status === 'failed' || update.status === 'cancelled' ? (
            <PrimaryButton
              label="Resume transfer"
              icon={RefreshCw}
              onPress={() => void resumeTransfer()}
            />
          ) : null}
        </Card>
      ) : null}
    </Screen>
  );
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
  draftInput: { minHeight: 280, paddingVertical: spacing.md, textAlignVertical: 'top' },
  resultSection: { gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.outline, paddingTop: spacing.md },
  bullet: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  privacyLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.emeraldTint, padding: spacing.md, borderRadius: radius.md },
  privacyText: { flex: 1, color: colors.ink, fontSize: 12, lineHeight: 18, fontWeight: '700' },
  hash: { color: colors.inkMuted, fontSize: 11, lineHeight: 16, fontFamily: 'monospace' },
});
