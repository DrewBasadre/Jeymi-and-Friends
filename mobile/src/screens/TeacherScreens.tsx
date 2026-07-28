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
  Camera,
  CheckCircle2,
  FileText,
  Layers,
  PencilLine,
  QrCode,
  RefreshCw,
  Search,
  Sparkles,
  TriangleAlert,
  Upload,
  UsersRound,
} from 'lucide-react-native';
import {
  Card,
  CardHeader,
  Chip,
  EmptyState,
  Metric,
  PrimaryButton,
  ProgressBar,
  Screen,
  ScreenHeader,
  SectionTitle,
  Skeleton,
  StatusBadge,
} from '@/components/ui';
import { MascotPanel } from '@/components/mascot';
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
import { colors, elevation, radius, spacing, text } from '@/theme/tokens';

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
        overline="Teacher"
        title={activeSection?.name ?? 'Class overview'}
        subtitle={
          activeSection
            ? `Grade ${activeSection.gradeLevel} · calculated on this device.`
            : 'Choose an active section to begin.'
        }
        action={<StatusBadge label="Offline ready" status="completed" />}
      />
      {!dashboard ? (
        <View style={styles.metricGrid}>
          <Skeleton width="47%" height={92} style={styles.metricSkeleton} />
          <Skeleton width="47%" height={92} style={styles.metricSkeleton} />
          <Skeleton width="47%" height={92} style={styles.metricSkeleton} />
        </View>
      ) : (
        <View style={styles.metricGrid}>
          <Metric label="Class average" value={`${dashboard.classAverage}%`} tint={colors.primaryTint} color={colors.primaryStrong} />
          <Metric label="Learners" value={dashboard.learners.length} tint={colors.secondaryTint} color={colors.secondary} />
          <Metric label="Need support" value={dashboard.strugglingStudents.length} tint={colors.warningTint} color={colors.warning} />
        </View>
      )}
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
      <Card accent={colors.primary}>
        <CardHeader icon={UsersRound} title="Active section leaderboard" color={colors.primary} />
        {!dashboard?.learners.length ? (
          <EmptyState title="No rostered learners yet" body="Choose a section, then scan student profile QR codes to build your class." />
        ) : (
          (dashboard?.leaderboard ?? []).slice(0, 5).map((learner, index) => (
            <Pressable
              key={learner.studentId}
              style={[styles.learnerRow, index === 0 && styles.learnerRowFirst]}
              onPress={() => navigation.navigate('LearnerDetail', { studentId: learner.studentId })}
            >
              <View style={[styles.rank, index < 3 && styles.rankTop]}>
                <Text style={[styles.rankText, index < 3 && styles.rankTextTop]}>{index + 1}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{learner.displayName}</Text>
                <Text style={styles.rowMeta}>{learner.section} · {learner.totalAttempts} attempts</Text>
              </View>
              <Text style={styles.rowScore}>{learner.averageScore}%</Text>
            </Pressable>
          ))
        )}
      </Card>
      {classReport?.commonlyMissedConcepts.length ? (
        <Card accent={colors.warning}>
          <CardHeader icon={TriangleAlert} title="Commonly missed concepts" color={colors.warning} />
          {classReport.commonlyMissedConcepts.slice(0, 5).map((concept) => (
            <View key={concept.conceptId} style={styles.rowBetween}>
              <Text style={styles.rowTitle}>{concept.conceptId}</Text>
              <Text style={styles.rowScoreWarn}>{concept.percentOfClassMissing}%</Text>
            </View>
          ))}
        </Card>
      ) : null}
      <Card>
        <CardHeader icon={Layers} title="Overall leaderboard" color={colors.secondary} />
        {(overallDashboard?.leaderboard ?? []).slice(0, 5).map((learner, index) => (
          <Pressable
            key={learner.studentId}
            style={[styles.learnerRow, index === 0 && styles.learnerRowFirst]}
            onPress={() => navigation.navigate('LearnerDetail', { studentId: learner.studentId })}
          >
            <View style={[styles.rank, index < 3 && styles.rankTop]}>
              <Text style={[styles.rankText, index < 3 && styles.rankTextTop]}>{index + 1}</Text>
            </View>
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>{learner.displayName}</Text>
              <Text style={styles.rowMeta}>{learner.section}</Text>
            </View>
            <Text style={styles.rowScore}>{learner.averageScore}%</Text>
          </Pressable>
        ))}
        {!overallDashboard?.learners.length ? (
          <Text style={styles.rowMeta}>Learners appear here after joining a managed section.</Text>
        ) : null}
      </Card>
      <PrimaryButton
        label="Create assignment QR"
        icon={QrCode}
        onPress={() => navigation.navigate('AssignmentBuilder')}
      />
      <PrimaryButton
        label="Manage sections"
        icon={UsersRound}
        tone="ghost"
        onPress={() => navigation.navigate('Sections')}
      />
      <PrimaryButton
        label="Author review sets"
        icon={Layers}
        tone="ghost"
        onPress={() => navigation.navigate('CustomReviewSets')}
      />
      <PrimaryButton
        label="Author Markdown module"
        icon={FileText}
        tone="ghost"
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
          <Search size={19} color={colors.inkSubtle} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Find a learner"
            placeholderTextColor={colors.inkSubtle}
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
            <Card accent={item.struggling ? colors.warning : colors.success}>
              <View style={styles.rowBetween}>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>{item.displayName}</Text>
                  <Text style={styles.rowMeta}>{item.studentNumber} · {item.section}</Text>
                </View>
                {item.struggling ? (
                  <StatusBadge label="Needs support" status="inProgress" />
                ) : (
                  <Text style={styles.rowScore}>{item.averageScore}%</Text>
                )}
              </View>
              <Text style={styles.body}>Practice next: {item.weakTopic}</Text>
              <Text style={styles.rowMeta}>
                {item.recommendedFormat
                  ? `${capitalize(item.recommendedFormat)} recommendation · ${Math.round(item.formatConfidence * 100)}% confidence`
                  : 'Format recommendation pending'}
              </Text>
              {item.struggling ? (
                <Text style={styles.supportReason}>{item.strugglingReason}</Text>
              ) : null}
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={<EmptyState title="No matching learner" body="Scan a student profile or quiz report to add them here." />}
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
      setError(caught instanceof Error ? caught.message : 'This is not a valid Pavo report.');
    }
  }

  if (!permission) {
    return (
      <Screen>
        <ScreenHeader title="QR scanner" />
        <Skeleton width="60%" height={16} />
      </Screen>
    );
  }
  if (!permission.granted) {
    return (
      <Screen>
        <ScreenHeader title="QR scanner" subtitle="Reports are decoded and stored locally." />
        <MascotPanel
          expression="encouraging"
          title="Let Pavo see the QR"
          body="The camera is used only while scanning a classroom QR code — nothing leaves this device."
        />
        <PrimaryButton label="Allow camera" icon={Camera} onPress={() => void requestPermission()} />
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
        <View style={styles.scanOverlay} pointerEvents="none">
          <View style={styles.scanTarget} />
          <Text style={styles.scanHint}>Point at a Pavo QR code</Text>
        </View>
      </View>
      <View style={styles.scanResult}>
        {message ? (
          <Card accent={colors.success}>
            <View style={styles.rowInline}>
              <CheckCircle2 size={22} color={colors.success} />
              <Text style={styles.rowTitle}>{message}</Text>
            </View>
          </Card>
        ) : null}
        {error ? (
          <View style={styles.errorNote}>
            <TriangleAlert size={16} color={colors.error} />
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : null}
        {!active ? (
          <PrimaryButton
            label="Scan another"
            icon={RefreshCw}
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

export function GurobotScreen({ navigation }: TeacherTabProps<'Gurobot'>): ReactElement {
  return (
    <Screen>
      <ScreenHeader overline="Assist" title="Gurobot" subtitle="Your future teaching co-pilot." />
      <MascotPanel
        expression="idle"
        title="Coming soon"
        body="AI lesson help is on the way. For now, everything you author stays fully offline and private on this device."
      />
      <Card accent={colors.secondary}>
        <CardHeader
          icon={Sparkles}
          color={colors.secondary}
          title="What Gurobot will do"
          action={<StatusBadge label="Planned" status="notStarted" />}
        />
        <Text style={styles.body}>
          Draft modules from a topic, suggest quiz questions, and summarize class
          performance — all opt-in. No lesson content or student data leaves this
          device today.
        </Text>
      </Card>
      <Card>
        <CardHeader icon={PencilLine} title="Available now" color={colors.primary} />
        <Text style={styles.body}>Author lessons and review sets by hand — fully offline.</Text>
        <PrimaryButton
          label="Author a module"
          icon={FileText}
          tone="ghost"
          onPress={() => navigation.navigate('ModuleAuthor')}
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
            <Metric label="Average" value={`${report.averageScorePercentage}%`} tint={colors.primaryTint} color={colors.primaryStrong} />
            <Metric label="Attempts" value={report.quizHistory.length} tint={colors.secondaryTint} color={colors.secondary} />
            <Metric label="Trend" value={capitalize(report.trend)} tint={colors.accentTint} color={colors.accentText} />
          </View>
          <Card>
            <Text style={styles.fieldLabel}>Current learning format</Text>
            <Text style={styles.cardTitle}>
              {capitalize(report.profile.currentLearningFormat)}
            </Text>
          </Card>
          <Card accent={colors.warning}>
            <CardHeader icon={TriangleAlert} title="Struggling concepts" color={colors.warning} />
            {report.strugglingConcepts.slice(0, 5).map((concept) => (
              <View key={concept.conceptId} style={styles.rowBetween}>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>{concept.conceptId}</Text>
                  <Text style={styles.rowMeta}>
                    Missed across {concept.attempts}{' '}
                    {concept.attempts === 1 ? 'attempt' : 'attempts'}
                  </Text>
                </View>
                <Chip label={`${concept.missCount} misses`} color={colors.warning} />
              </View>
            ))}
            {!report.strugglingConcepts.length ? (
              <Text style={styles.rowMeta}>No missed concepts recorded.</Text>
            ) : null}
          </Card>
          <Card>
            <CardHeader icon={FileText} title="Quiz history" color={colors.secondary} />
            {report.quizHistory.slice(0, 10).map((attempt) => (
              <View key={attempt.id} style={styles.rowBetween}>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle}>
                    {new Date(attempt.submittedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {attempt.score}/{attempt.totalItems} correct
                  </Text>
                </View>
                <Text style={styles.rowScore}>
                  {Math.round((attempt.score / Math.max(1, attempt.totalItems)) * 100)}%
                </Text>
              </View>
            ))}
            {!report.quizHistory.length ? (
              <Text style={styles.rowMeta}>No quiz reports scanned yet.</Text>
            ) : null}
          </Card>
        </>
      ) : <EmptyState title="Learner not found" body="Scan the learner's report again to view their progress." />}
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
      <Card accent={available ? colors.success : colors.warning}>
        <CardHeader
          icon={Bluetooth}
          color={available ? colors.success : colors.warning}
          title={available ? 'Nearby is ready' : 'Development build required'}
        />
        <Text style={styles.body}>
          {available
            ? 'Nearby Connections can use Bluetooth and local Wi-Fi without internet.'
            : 'Module inspection works here; device-to-device transfer requires the native Nearby module on physical devices.'}
        </Text>
      </Card>
      {transferPackage ? (
        <Card accent={colors.primary}>
          <Text style={styles.cardTitle}>{transferPackage.displayName}</Text>
          <Text style={styles.body}>
            {formatBytes(transferPackage.sizeBytes)} · {transferPackage.manifest.assets.length} image asset
            {transferPackage.manifest.assets.length === 1 ? '' : 's'} · manifest v{transferPackage.manifest.version}
          </Text>
          <Text style={styles.hash} numberOfLines={2}>SHA-256 {transferPackage.sha256}</Text>
        </Card>
      ) : (
        <PrimaryButton
          label="Author a Markdown module"
          icon={PencilLine}
          tone="ghost"
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
            <View style={styles.rowInline}>
              <View style={styles.peerDot} />
              <Text style={styles.rowTitle}>{peer.name}</Text>
            </View>
            <View style={styles.peerAction}>
              <PrimaryButton
                label={peer.connected ? 'Send' : 'Connect'}
                size="sm"
                icon={peer.connected ? Upload : Bluetooth}
                disabled={!transferPackage}
                onPress={() => void pairOrSend(peer)}
              />
            </View>
          </View>
        </Card>
      ))}
      {update ? (
        <Card
          accent={
            update.status === 'complete'
              ? colors.success
              : update.status === 'failed'
                ? colors.error
                : colors.primary
          }
        >
          <StatusBadge
            label={capitalize(update.status)}
            status={
              update.status === 'complete'
                ? 'completed'
                : update.status === 'failed' || update.status === 'cancelled'
                  ? 'notStarted'
                  : 'inProgress'
            }
          />
          <ProgressBar value={update.totalBytes > 0 ? update.bytesTransferred / update.totalBytes : 0} />
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
  flex: { flex: 1, minWidth: 0 },
  fixedHeader: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, gap: spacing.md },
  listContent: { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.huge },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metricSkeleton: { borderRadius: radius.lg, flexGrow: 1 },
  cardTitle: { ...text.title, color: colors.ink },
  body: { ...text.body, color: colors.inkMuted, fontSize: 15 },
  learnerRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.outline,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  learnerRowFirst: { borderTopWidth: 0, marginTop: 0, paddingTop: spacing.xs },
  rank: {
    width: 30,
    height: 30,
    borderRadius: radius.round,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankTop: { backgroundColor: colors.primaryTint },
  rankText: { ...text.caption, fontWeight: '800', color: colors.inkMuted },
  rankTextTop: { color: colors.primary },
  rowTitle: { ...text.bodyStrong, color: colors.ink },
  rowMeta: { ...text.caption, color: colors.inkMuted },
  rowScore: { ...text.title, color: colors.success },
  rowScoreWarn: { ...text.title, color: colors.warning },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  rowInline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  searchBox: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchInput: { flex: 1, color: colors.ink, fontSize: 16 },
  scannerScreen: { padding: 0, gap: 0 },
  scannerHeader: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  cameraFrame: { flex: 1, minHeight: 340, overflow: 'hidden', backgroundColor: colors.black },
  scanOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  scanTarget: { width: 236, height: 236, borderWidth: 3, borderColor: colors.white, borderRadius: radius.xl },
  scanHint: { ...text.label, color: colors.white, backgroundColor: 'rgba(15,42,40,0.55)', paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.round, overflow: 'hidden' },
  scanResult: { padding: spacing.xl, gap: spacing.md, backgroundColor: colors.background },
  error: { flex: 1, color: colors.error, ...text.label, fontWeight: '700' },
  errorNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.errorTint,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  supportReason: {
    ...text.caption,
    color: colors.warning,
    backgroundColor: colors.warningTint,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  fieldLabel: { ...text.label, color: colors.ink, fontWeight: '800' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  peerDot: { width: 10, height: 10, borderRadius: radius.round, backgroundColor: colors.success },
  peerAction: { minWidth: 116 },
  hash: { color: colors.inkSubtle, fontSize: 11, lineHeight: 16, fontFamily: 'monospace' },
});
