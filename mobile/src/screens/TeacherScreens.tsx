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
  StyleSheet,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Crypto from 'expo-crypto';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  Award,
  Bluetooth,
  BookOpen,
  Camera,
  CheckCircle2,
  ClipboardList,
  FileText,
  History,
  Layers,
  LogOut,
  MessageSquareText,
  Minus,
  Phone,
  Plus,
  PencilLine,
  QrCode,
  RefreshCw,
  ScanLine,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Trophy,
  Upload,
  UsersRound,
  WifiOff,
  X,
} from 'lucide-react-native';
import {
  ActionTile,
  Callout,
  Card,
  CardHeader,
  Divider,
  Dropdown,
  EmptyState,
  HeroCard,
  IconPlate,
  ListRow,
  PressableScale,
  PrimaryButton,
  ProgressBar,
  RingProgress,
  Row,
  Screen,
  ScreenHeader,
  SectionHeader,
  SegmentedControl,
  Skeleton,
  StatTile,
  TileGrid,
  StatusBadge,
  useCompactViewport,
  useResponsiveColumns,
} from '@/components/ui';
import { MascotPanel, PeacockPhase, peacockPhaseFromScore } from '@/components/mascot';
import { InteractiveLearningPreview } from '@/components/InteractiveLearningPreview';
import { CompanionThinking } from '@/components/CompanionThinking';
import { TypewriterLine, useTypewriterSequence } from '@/components/Typewriter';
import { capitalize, formatDate } from '@/utils/format';
import {
  buildTeacherCompanionRequest,
  type CompanionResponse,
} from '@/domain/companion';
import {
  getActiveSection,
  getClassPerformanceReport,
  getOverallClassPerformanceReport,
  getStudentPerformanceReport,
  getTeacherDashboard,
  getTeacherProfile,
  importQrReport,
  listSections,
} from '@/data/repository';
import {
  appendChatMessage,
  createChatSession,
  listChatSessions,
  saveLearningPackage,
} from '@/data/learningRepository';
import { useSessionStore } from '@/store/session';
import {
  listCustomReviewSets,
  listReviewItems,
  setStrugglingThreshold,
} from '@/data/mvpRepository';
import type {
  ClassPerformanceReport,
  ChatSession,
  QuizAttempt,
  Section,
  StudyPackageManifest,
  StudentPerformanceReport,
  TeacherDashboard,
  TeacherLearnerRow,
  TeacherProfile,
  TransferPackage,
} from '@/domain/types';
import type {
  RootStackParamList,
  TeacherTabParamList,
} from '@/navigation/types';
import { buildReviewSetPackage } from '@/services/files';
import { askPavo, isCompanionConfigured } from '@/services/companion';
import { useConnectivity } from '@/services/connectivity';
import {
  PARENT_SMS_CHARACTER_LIMIT,
  sendParentSmsDemo,
  type ParentSmsReceipt,
} from '@/services/parentMessaging';
import {
  buildLearningPackage,
  inspectLearningPackage,
} from '@/services/learningPackages';
import { buildTeacherModulePackage } from '@/services/modulePackages';
import {
  nearby,
  type NearbyPeer,
  type NearbyTransferUpdate,
  type NearbyVerificationRequest,
} from '@/services/nearby';
import {
  colors,
  gradients,
  radius,
  spacing,
  text,
} from '@/theme/tokens';

type TeacherTabProps<Route extends keyof TeacherTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TeacherTabParamList, Route>,
  NativeStackScreenProps<RootStackParamList>
>;

type StackProps<Route extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  Route
>;

/* ────────────────────────────────────────────────────────────────────────
   Class dashboard
   ──────────────────────────────────────────────────────────────────────── */

export function TeacherHomeScreen({ navigation }: TeacherTabProps<'TeacherHome'>) {
  const [dashboard, setDashboard] = useState<TeacherDashboard | null>(null);
  const [activeSection, setActiveSection] = useState<Section | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [scope, setScope] = useState<string>('all');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [classReport, setClassReport] =
    useState<ClassPerformanceReport | null>(null);
  const [classInsight, setClassInsight] =
    useState<CompanionResponse | null>(null);
  const [classInsightLoading, setClassInsightLoading] = useState(false);
  const compact = useCompactViewport();
  const connectivity = useConnectivity();
  const load = useCallback(() => {
    void (async () => {
      const [section, nextSections] = await Promise.all([
        getActiveSection(),
        listSections(),
      ]);
      const sectionId = scope === 'all' ? undefined : scope;
      const [sectionDashboard, report] = await Promise.all([
        getTeacherDashboard(sectionId),
        sectionId
          ? getClassPerformanceReport(sectionId)
          : getOverallClassPerformanceReport(),
      ]);
      setActiveSection(section);
      setSections(nextSections);
      setDashboard(sectionDashboard);
      setClassReport(report);
    })();
  }, [scope]);
  useFocusEffect(load);

  const learners = dashboard?.learners ?? [];
  const struggling = dashboard?.strugglingStudents ?? [];
  const classAverage = dashboard?.classAverage ?? 0;
  const threshold = dashboard?.strugglingThreshold ?? 60;
  const leaderboard = [...(dashboard?.leaderboard ?? [])].sort((left, right) =>
    sortDirection === 'asc'
      ? left.averageScore - right.averageScore
      : right.averageScore - left.averageScore,
  );
  const missedConcepts = classReport?.commonlyMissedConcepts.slice(0, 5) ?? [];
  const onTrack = Math.max(0, learners.length - struggling.length);
  const selectedSection = sections.find(
    (section) => section.sectionId === scope,
  );
  const scopeLabel =
    scope === 'all' ? 'All classes (overall)' : selectedSection?.name ?? 'Section';

  async function generateClassInsight() {
    if (!classReport) return;
    if (connectivity !== 'online' || !isCompanionConfigured()) {
      Alert.alert('Internet required', 'Connect to use Gurobot class insight.');
      return;
    }
    setClassInsightLoading(true);
    try {
      setClassInsight(
        await askPavo(
          buildTeacherCompanionRequest({
            intent: 'teacher_class_insight',
            gradeLevel: selectedSection?.gradeLevel ?? activeSection?.gradeLevel ?? 5,
            question:
              'Recommend a reteaching order, grouping strategy, pacing adjustment, and monitoring check.',
            teacherContext: {
              classAveragePercentage: classReport.classAveragePercentage,
              learnerCount: learners.length,
              commonlyMissedConcepts: classReport.commonlyMissedConcepts,
            },
          }),
        ),
      );
    } catch (error) {
      Alert.alert(
        'Insight unavailable',
        error instanceof Error ? error.message : 'Try again.',
      );
    } finally {
      setClassInsightLoading(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader
        overline="Teacher"
        title="Class dashboard"
        subtitle={
          activeSection
            ? 'Every figure below is calculated on this device.'
            : 'Choose an active section to begin.'
        }
        action={<StatusBadge label="Offline ready" status="completed" />}
      />

      {!dashboard ? (
        <Skeleton width="100%" height={186} style={styles.heroSkeleton} />
      ) : (
        <HeroCard>
          <View style={styles.heroTop}>
            <View style={styles.flex}>
              <Text style={styles.heroOverline}>
                {scopeLabel.toUpperCase()}
              </Text>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {scopeLabel}
              </Text>
              <Text style={styles.heroBody}>
                {scope === 'all'
                  ? `${learners.length} ${
                      learners.length === 1 ? 'learner' : 'learners'
                    } across ${sections.length} ${
                      sections.length === 1 ? 'class' : 'classes'
                    }.`
                  : selectedSection
                  ? `Grade ${selectedSection.gradeLevel} — ${learners.length} ${
                      learners.length === 1 ? 'learner' : 'learners'
                    } on this device.`
                  : 'Activate a section, then scan learner profile QR codes to build your roster.'}
              </Text>
            </View>
            <RingProgress
              value={classAverage / 100}
              size={compact ? 78 : 94}
              thickness={9}
              color={colors.accent}
              accessibilityLabel={`Class average ${classAverage} percent`}
            >
              <Text style={styles.ringValue}>{classAverage}%</Text>
              <Text style={styles.ringCaption}>Average</Text>
            </RingProgress>
          </View>
          <View style={styles.heroPanel}>
            <HeroStat label="Learners" value={learners.length} />
            <View style={styles.heroPanelLine} />
            <HeroStat label="On track" value={onTrack} />
            <View style={styles.heroPanelLine} />
            <HeroStat label="Need support" value={struggling.length} />
          </View>
        </HeroCard>
      )}

      <SectionHeader
        title="At a glance"
        caption="Recalculated whenever a report is scanned"
      />
      {!dashboard ? (
        <TileGrid>
          <Skeleton width="47%" height={104} style={styles.tileSkeleton} />
          <Skeleton width="47%" height={104} style={styles.tileSkeleton} />
          <Skeleton width="47%" height={104} style={styles.tileSkeleton} />
          <Skeleton width="47%" height={104} style={styles.tileSkeleton} />
        </TileGrid>
      ) : (
        <TileGrid>
          <StatTile
            icon={Trophy}
            label="Class average"
            value={`${classAverage}%`}
            footnote={
              classAverage >= threshold ? 'Above the support line' : 'Below the support line'
            }
            color={colors.primary}
          />
          <StatTile
            icon={UsersRound}
            label="Rostered learners"
            value={learners.length}
              footnote={scopeLabel}
            color={colors.secondary}
          />
          <StatTile
            icon={TriangleAlert}
            label="Need support"
            value={struggling.length}
            footnote={`Below ${threshold}% average`}
            color={colors.warning}
          />
          <StatTile
            icon={Layers}
            label="All sections"
              value={sections.length}
              footnote="Managed on this device"
            color={colors.accentText}
          />
        </TileGrid>
      )}

      <SectionHeader title="Quick actions" caption="Everything works without internet" />
      <TileGrid>
        <ActionTile
          icon={ScanLine}
          label="Scan reports"
          caption="Import quiz QR codes"
          color={colors.primary}
          onPress={() => navigation.navigate('Scanner')}
        />
        <ActionTile
          icon={ClipboardList}
          label="Record book"
          caption="Roster and flags"
          color={colors.secondary}
          badge={struggling.length}
          onPress={() => navigation.navigate('RecordBook')}
        />
        <ActionTile
          icon={QrCode}
          label="Assignment QR"
          caption="Set tasks and deadlines"
          color={colors.accentText}
          onPress={() => navigation.navigate('AssignmentBuilder')}
        />
        <ActionTile
          icon={UsersRound}
          label="Sections"
          caption="Manage your classes"
          color={colors.success}
          onPress={() => navigation.navigate('Sections')}
        />
      </TileGrid>

      <Card>
        <CardHeader
          icon={Target}
          title="Support threshold"
          subtitle="Learners averaging below this are flagged for intervention."
          color={colors.warning}
        />
        <SegmentedControl
          value={`${threshold}`}
          onChange={(value) => {
            void setStrugglingThreshold(Number(value)).then(load);
          }}
          options={[
            { value: '50', label: '50%' },
            { value: '60', label: '60%' },
            { value: '70', label: '70%' },
          ]}
        />
      </Card>

      <SectionHeader
        title="Leaderboard"
        caption={`${scopeLabel} · ${
          sortDirection === 'asc' ? 'Lowest averages first' : 'Highest averages first'
        }`}
        actionLabel={learners.length ? 'Record book' : undefined}
        onAction={learners.length ? () => navigation.navigate('RecordBook') : undefined}
      />
      <Card>
        <Text style={styles.fieldCaption}>Scope</Text>
        <Dropdown
          accessibilityLabel="Choose which class to view"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'all', label: 'All classes (overall)' },
            ...sections.map((section) => ({
              value: section.sectionId,
              label: section.name,
            })),
          ]}
        />
        <Divider />
        <Text style={styles.fieldCaption}>Sort by average score</Text>
        <SegmentedControl
          value={sortDirection}
          onChange={setSortDirection}
          options={[
            { value: 'asc', label: 'Lowest first' },
            { value: 'desc', label: 'Highest first' },
          ]}
        />
      </Card>
      <Card>
        {!learners.length ? (
          <EmptyState
            title="No rostered learners yet"
            body="Choose a section, then scan student profile QR codes to build your class."
          />
        ) : (
          leaderboard.map((learner, index) => (
            <View key={learner.studentId}>
              {index > 0 ? <Divider style={styles.rowDivider} /> : null}
              <LeaderboardRow
                learner={learner}
                rank={index + 1}
                meta={`${peacockPhaseFromScore(learner.averageScore).name} · ${
                  learner.totalAttempts
                } ${learner.totalAttempts === 1 ? 'attempt' : 'attempts'}`}
                onPress={() =>
                  navigation.navigate('LearnerDetail', { studentId: learner.studentId })
                }
              />
            </View>
          ))
        )}
      </Card>

      {missedConcepts.length ? (
        <>
          <SectionHeader
            title="Commonly missed"
            caption="Concepts to reteach before the next quiz"
          />
          <Card>
            {missedConcepts.map((concept, index) => (
              <View key={concept.conceptId}>
                {index > 0 ? <Divider style={styles.rowDivider} /> : null}
                <View style={styles.conceptRow}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.rowTitle} numberOfLines={2}>
                      {concept.conceptId}
                    </Text>
                    <Text style={[styles.rowScore, styles.rowScoreWarn]}>
                      {concept.percentOfClassMissing}%
                    </Text>
                  </View>
                  <ProgressBar
                    value={concept.percentOfClassMissing / 100}
                    height={8}
                    ramp={gradients.math}
                    accessibilityLabel={`${concept.conceptId} missed by ${concept.percentOfClassMissing} percent of the class`}
                  />
                </View>
              </View>
            ))}
          </Card>
          <PrimaryButton
            label={
              classInsightLoading
                ? 'Preparing class approach...'
                : 'Generate class AI insight'
            }
            icon={Sparkles}
            disabled={classInsightLoading}
            onPress={() => void generateClassInsight()}
          />
          {classInsight ? (
            <AiReportCard
              key={`insight-${classInsight.summary.length}`}
              result={classInsight}
              animate
            />
          ) : null}
        </>
      ) : null}

      <SectionHeader title="Teaching tools" caption="Author and share offline material" />
      <Card>
        <ListRow
          icon={FileText}
          title="Author a Markdown module"
          subtitle="Write a lesson and package it for transfer"
          onPress={() => navigation.navigate('ModuleAuthor')}
        />
        <Divider style={styles.rowDivider} />
        <ListRow
          icon={Layers}
          title="Author review sets"
          subtitle="Build custom flashcard and drill sets"
          color={colors.secondary}
          onPress={() => navigation.navigate('CustomReviewSets')}
        />
        <Divider style={styles.rowDivider} />
        <ListRow
          icon={Send}
          title="Send to a Nearby device"
          subtitle="Hand a module to a learner without internet"
          color={colors.accentText}
          onPress={() => navigation.navigate('Transfer')}
        />
      </Card>
    </Screen>
  );
}

function HeroStat({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

function LeaderboardRow({
  learner,
  rank,
  meta,
  onPress,
}: {
  learner: TeacherLearnerRow;
  rank: number;
  meta: string;
  onPress: () => void;
}) {
  const growth = peacockPhaseFromScore(learner.averageScore);
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={`${learner.displayName}, rank ${rank}, ${learner.averageScore} percent average`}
      accessibilityHint="Opens this learner's profile"
    >
      <View style={styles.leaderRow}>
        <View style={[styles.rank, rank <= 3 && styles.rankTop]}>
          <Text style={[styles.rankText, rank <= 3 && styles.rankTextTop]}>{rank}</Text>
        </View>
        <View style={styles.peacockCell}>
          <PeacockPhase
            size={34}
            phase={growth.phase}
            accessibilityLabel={`${learner.displayName}'s peacock — ${growth.name}`}
          />
        </View>
        <View style={styles.flex}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {learner.displayName}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {meta}
          </Text>
        </View>
        <Text style={styles.rowScore}>{learner.averageScore}%</Text>
      </View>
    </PressableScale>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Record book
   ──────────────────────────────────────────────────────────────────────── */

export function RecordBookScreen({ navigation }: TeacherTabProps<'RecordBook'>) {
  const [dashboard, setDashboard] = useState<TeacherDashboard | null>(null);
  const [activeSection, setActiveSection] = useState<Section | null>(null);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      void getActiveSection().then(async (section) => {
        setActiveSection(section);
        setDashboard(await getTeacherDashboard(section?.sectionId));
      });
    }, []),
  );

  const columns = useResponsiveColumns();
  const learners = useMemo(() => {
    const value = query.trim().toLocaleLowerCase();
    if (!value) return dashboard?.learners ?? [];
    return (dashboard?.learners ?? []).filter((learner) =>
      `${learner.displayName} ${learner.studentNumber} ${learner.section}`.toLocaleLowerCase().includes(value),
    );
  }, [dashboard, query]);

  const total = dashboard?.learners.length ?? 0;
  const flagged = dashboard?.strugglingStudents.length ?? 0;

  return (
    <Screen scroll={false} style={styles.flex}>
      <View style={styles.fixedHeader}>
        <ScreenHeader
          overline="Roster"
          title="Record book"
          subtitle={
            activeSection
              ? `${activeSection.name} — local reports and intervention flags.`
              : 'Choose an active section to view its roster.'
          }
        />
        <View style={[styles.searchBox, focused && styles.searchBoxFocused]}>
          <Search size={19} color={focused ? colors.primary : colors.inkSubtle} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Find a learner"
            placeholderTextColor={colors.inkSubtle}
            selectionColor={colors.primary}
            style={styles.searchInput}
            accessibilityLabel="Find a learner"
            returnKeyType="search"
          />
        </View>
        <Row gap={spacing.sm}>
          <Text style={styles.rosterMeta}>
            {learners.length} of {total} shown
          </Text>
          {flagged > 0 ? (
            <StatusBadge label={`${flagged} need support`} status="inProgress" />
          ) : total > 0 ? (
            <StatusBadge label="All on track" status="completed" />
          ) : null}
        </Row>
      </View>
      <FlatList
        data={learners}
        key={columns}
        numColumns={columns}
        keyExtractor={(learner) => learner.studentId}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <LearnerCard
            learner={item}
            onPress={() =>
              navigation.navigate('LearnerDetail', { studentId: item.studentId })
            }
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title="No matching learner"
            body="Scan a student profile or quiz report to add them here."
          />
        }
      />
    </Screen>
  );
}

function LearnerCard({
  learner,
  onPress,
}: {
  learner: TeacherLearnerRow;
  onPress: () => void;
}) {
  const growth = peacockPhaseFromScore(learner.averageScore);
  return (
    <PressableScale
      style={styles.cardCell}
      onPress={onPress}
      accessibilityLabel={`${learner.displayName}, ${learner.averageScore} percent average${
        learner.struggling ? ', needs support' : ''
      }`}
      accessibilityHint="Opens this learner's profile"
    >
      <Card
        accent={learner.struggling ? colors.warning : colors.success}
        style={styles.flexCard}
      >
        <View style={styles.learnerTop}>
          <View style={styles.peacockCell}>
            <PeacockPhase
              size={34}
              phase={growth.phase}
              accessibilityLabel={`${learner.displayName}'s peacock — ${growth.name}`}
            />
          </View>
          <View style={styles.flex}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {learner.displayName}
            </Text>
            <Text style={styles.rowMeta} numberOfLines={1}>
              {learner.studentNumber} · {learner.section}
            </Text>
          </View>
          <Text
            style={[
              styles.rowScore,
              learner.struggling && styles.rowScoreWarn,
            ]}
          >
            {learner.averageScore}%
          </Text>
        </View>

        <View style={styles.masteryBlock}>
          <View style={styles.rowBetween}>
            <Text style={styles.fieldCaption}>Mastery</Text>
            <Text style={styles.fieldCaption}>{growth.name}</Text>
          </View>
          <ProgressBar
            value={learner.averageScore / 100}
            height={8}
            accessibilityLabel={`${learner.displayName} mastery ${learner.averageScore} percent`}
          />
        </View>

        <View style={styles.badgeRow}>
          <StatusBadge
            label={learner.struggling ? 'Needs support' : 'On track'}
            status={learner.struggling ? 'inProgress' : 'completed'}
          />
          {learner.decliningTrend ? (
            <StatusBadge label="Trending down" status="notStarted" />
          ) : null}
        </View>

        <View style={styles.learnerFacts}>
          <Text style={styles.body} numberOfLines={2}>
            Practice next: {learner.weakTopic}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={2}>
            {learner.recommendedFormat
              ? `${capitalize(learner.recommendedFormat)} recommendation — ${Math.round(
                  learner.formatConfidence * 100,
                )}% confidence`
              : 'Format recommendation pending'}
          </Text>
        </View>

        {learner.struggling ? (
          <Text style={styles.supportReason}>{learner.strugglingReason}</Text>
        ) : null}
      </Card>
    </PressableScale>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Scanner
   ──────────────────────────────────────────────────────────────────────── */

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
        <ScreenHeader
          overline="Import"
          title="QR scanner"
          subtitle="Checking camera access…"
        />
        <Card>
          <Skeleton width="60%" height={18} />
          <Skeleton width="100%" height={12} />
          <Skeleton width="80%" height={12} />
        </Card>
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen>
        <ScreenHeader
          overline="Import"
          title="QR scanner"
          subtitle="Reports are decoded and stored on this device."
        />
        <MascotPanel
          expression="encouraging"
          title="Let Pavo see the QR"
          body="The camera is used only while scanning a classroom QR code — nothing leaves this device."
        />
        <Callout
          icon={ShieldCheck}
          tone="info"
          title="Camera access needed"
          body="Grant access once and scanning works offline from then on."
        />
        <PrimaryButton
          label="Allow camera"
          icon={Camera}
          onPress={() => void requestPermission()}
        />
      </Screen>
    );
  }

  const state: 'scanning' | 'success' | 'error' = error
    ? 'error'
    : message
      ? 'success'
      : 'scanning';

  return (
    <Screen scroll={false} style={styles.scannerScreen}>
      <View style={styles.scannerHeader}>
        <ScreenHeader
          overline="Import"
          title="QR scanner"
          subtitle="No internet required."
          action={
            <StatusBadge
              label={state === 'scanning' ? 'Scanning' : state === 'success' ? 'Imported' : 'Retry'}
              status={
                state === 'scanning' ? 'inProgress' : state === 'success' ? 'completed' : 'notStarted'
              }
            />
          }
        />
      </View>
      <View style={styles.cameraFrame}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={active ? ({ data }) => void handlePayload(data) : undefined}
        />
        <View style={styles.scanOverlay} pointerEvents="none">
          <View style={styles.scanTarget}>
            <View style={[styles.scanCorner, styles.scanCornerTopLeft]} />
            <View style={[styles.scanCorner, styles.scanCornerTopRight]} />
            <View style={[styles.scanCorner, styles.scanCornerBottomLeft]} />
            <View style={[styles.scanCorner, styles.scanCornerBottomRight]} />
          </View>
          <Text style={styles.scanHint}>
            {active ? 'Point at a Pavo QR code' : 'Scanner paused'}
          </Text>
        </View>
      </View>
      <View style={styles.scanResult}>
        {state === 'success' ? (
          <Callout
            icon={CheckCircle2}
            tone="success"
            title="Report imported"
            body={message}
          />
        ) : null}
        {state === 'error' ? (
          <Callout
            icon={TriangleAlert}
            tone="error"
            title="That code could not be read"
            body={error}
          />
        ) : null}
        {state === 'scanning' ? (
          <Callout
            icon={ScanLine}
            tone="info"
            title="Ready to scan"
            body="Hold the learner's QR inside the frame — results are saved straight to your record book."
          />
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

/* ────────────────────────────────────────────────────────────────────────
   Gurobot
   ──────────────────────────────────────────────────────────────────────── */

export function GurobotScreen({ navigation }: TeacherTabProps<'Gurobot'>): ReactElement {
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [section, setSection] = useState<Section | null>(null);
  const [report, setReport] = useState<ClassPerformanceReport | null>(null);
  const [intent, setIntent] = useState<
    | 'teacher_lesson_plan'
    | 'teacher_class_summary'
    | 'teacher_author_module'
    | 'teacher_author_quiz'
    | 'teacher_author_reviewer'
  >('teacher_lesson_plan');
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<CompanionResponse | null>(null);
  const [transferPackage, setTransferPackage] =
    useState<TransferPackage | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  // In-flight request drives the stepped thinking animation, mirroring the
  // student companion (see AiCompanionScreen). `submission` holds the prompt
  // being answered; `thinkingComplete` flips the panel to "Answer ready".
  const [submission, setSubmission] = useState<{ id: number; label: string } | null>(null);
  const [thinkingComplete, setThinkingComplete] = useState(false);
  // Bumped per answer so AiReportCard remounts and re-types each generation.
  const [answerKey, setAnswerKey] = useState(0);
  const connectivity = useConnectivity();

  const load = useCallback(async () => {
    const [nextProfile, nextSection] = await Promise.all([
      getTeacherProfile(),
      getActiveSection(),
    ]);
    setProfile(nextProfile);
    setSection(nextSection);
    if (nextSection) {
      setReport(await getClassPerformanceReport(nextSection.sectionId));
    }
    const ownerId = `teacher:${nextProfile?.teacherId ?? 'local-teacher'}` as const;
    const nextSessions = await listChatSessions(ownerId);
    setSessions(nextSessions);
    if (!activeSession) {
      const session =
        nextSessions[0] ?? (await createChatSession(ownerId));
      setActiveSession(session);
      if (nextSessions.length === 0) setSessions([session]);
    }
  }, [activeSession]);

  useFocusEffect(useCallback(() => void load(), [load]));

  async function newConversation() {
    const ownerId =
      `teacher:${profile?.teacherId ?? 'local-teacher'}` as const;
    const session = await createChatSession(ownerId);
    setSessions((current) => [session, ...current]);
    setActiveSession(session);
    setResult(null);
    setTransferPackage(null);
    setHistoryOpen(false);
  }

  async function generate() {
    if (!prompt.trim()) {
      Alert.alert('Add a request', 'Tell Gurobot what you want to prepare.');
      return;
    }
    if (connectivity !== 'online' || !isCompanionConfigured()) {
      Alert.alert('Internet required', 'Connect to use Gurobot.');
      return;
    }
    const ownerId =
      `teacher:${profile?.teacherId ?? 'local-teacher'}` as const;
    let session =
      activeSession ?? (await createChatSession(ownerId));
    const label = prompt.trim();
    const submissionId = Date.now();
    setSubmission({ id: submissionId, label });
    setThinkingComplete(false);
    setResult(null);
    setLoading(true);
    setTransferPackage(null);
    try {
      session = await appendChatMessage(session, {
        role: 'user',
        content: label,
        timestamp: new Date().toISOString(),
      });
      // Race the request against a floor delay so the thinking steps read as
      // deliberate rather than flashing past — same pacing as the student bot.
      const [nextResult] = await Promise.all([
        askPavo(
          buildTeacherCompanionRequest({
            intent,
            gradeLevel: section?.gradeLevel ?? 5,
            question: prompt,
            conversation: session.messages.slice(0, -1).map((message) => ({
              role: message.role,
              content: teacherReadableContent(message.content),
            })),
            teacherContext:
              intent === 'teacher_class_summary' && report
                ? {
                    classAveragePercentage: report.classAveragePercentage,
                    learnerCount: report.leaderboard.length,
                    commonlyMissedConcepts: report.commonlyMissedConcepts,
                  }
                : undefined,
          }),
        ),
        companionDelay(1700),
      ]);
      const built = await buildTeacherAssistantPackage({
        intent,
        result: nextResult,
        teacherId: profile?.teacherId ?? 'local-teacher',
        gradeLevel: section?.gradeLevel ?? 5,
      });
      if (built) {
        setTransferPackage(built);
      }
      session = await appendChatMessage(session, {
        role: 'assistant',
        content: JSON.stringify(nextResult),
        timestamp: new Date().toISOString(),
        producedPackageId: built?.moduleId ?? null,
      });
      setActiveSession(session);
      setSessions((current) => [
        session,
        ...current.filter((item) => item.sessionId !== session.sessionId),
      ]);
      setThinkingComplete(true);
      await companionDelay(280);
      setAnswerKey(submissionId);
      setResult(nextResult);
      setSubmission(null);
      setPrompt('');
    } catch (error) {
      setSubmission(null);
      Alert.alert(
        'Gurobot could not finish',
        error instanceof Error ? error.message : 'Try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function exportLessonPlan() {
    if (!result) return;
    try {
      const { uri } = await Print.printToFileAsync({
        html: lessonPlanHtml(result),
      });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Export ${result.title}`,
        UTI: 'com.adobe.pdf',
      });
    } catch (error) {
      Alert.alert(
        'PDF could not be exported',
        error instanceof Error ? error.message : 'Try again.',
      );
    }
  }

  const preview = result ? teacherPreviewManifest(result, profile?.teacherId) : null;

  return (
    <Screen>
      <ScreenHeader
        overline="Assist"
        title="Gurobot"
        subtitle="Draft, analyze, review, then decide what leaves your device."
        action={
          <StatusBadge
            label={connectivity === 'online' ? 'Online' : 'Offline'}
            status={connectivity === 'online' ? 'completed' : 'notStarted'}
          />
        }
      />

      <SegmentedControl
        value={intent}
        onChange={(next) => {
          setIntent(next);
          setResult(null);
          setTransferPackage(null);
        }}
        options={[
          { value: 'teacher_lesson_plan', label: 'Plan' },
          { value: 'teacher_class_summary', label: 'Class' },
          { value: 'teacher_author_module', label: 'Module' },
          { value: 'teacher_author_quiz', label: 'Quiz' },
          { value: 'teacher_author_reviewer', label: 'Review' },
        ]}
      />

      <PressableScale onPress={() => setHistoryOpen((value) => !value)}>
        <Card>
          <CardHeader
            icon={History}
            title="Past conversations"
            subtitle={activeSession?.title ?? 'New conversation'}
            color={colors.secondary}
            action={
              <StatusBadge
                label={`${sessions.length}`}
                status={sessions.length ? 'completed' : 'notStarted'}
              />
            }
          />
        </Card>
      </PressableScale>
      {historyOpen ? (
        <Card>
          <ListRow
            icon={Plus}
            title="New conversation"
            subtitle="Start with a clean context"
            onPress={() => void newConversation()}
          />
          {sessions.slice(0, 8).map((session, index) => (
            <View key={session.sessionId}>
              <Divider style={styles.rowDivider} />
              <ListRow
                icon={History}
                title={session.title}
                subtitle={`${session.messages.length} messages · ${formatDate(
                  session.updatedAt,
                )}`}
                color={colors.secondary}
                onPress={() => {
                  setActiveSession(session);
                  setResult(latestTeacherResult(session));
                  setHistoryOpen(false);
                }}
              />
            </View>
          ))}
        </Card>
      ) : null}

      <Card>
        <CardHeader
          icon={Sparkles}
          title={teacherIntentTitle(intent)}
          subtitle={teacherIntentSubtitle(intent, section)}
          color={colors.primary}
        />
        <TextInput
          value={prompt}
          onChangeText={setPrompt}
          multiline
          maxLength={500}
          placeholder={teacherIntentPlaceholder(intent)}
          placeholderTextColor={colors.inkSubtle}
          style={styles.assistantInput}
          textAlignVertical="top"
        />
        <PrimaryButton
          label={loading ? 'Gurobot is preparing...' : 'Prepare draft'}
          icon={Send}
          disabled={loading}
          onPress={() => void generate()}
        />
      </Card>

      {submission ? (
        <CompanionThinking
          key={submission.id}
          prompt={submission.label}
          complete={thinkingComplete}
          steps={TEACHER_THINKING_STEPS}
        />
      ) : null}

      {result && !submission ? (
        <>
          <AiReportCard key={answerKey} result={result} animate />
          {preview &&
          (preview.reviewItems.length > 0 ||
            (preview.quiz?.questions.length ?? 0) > 0) ? (
            <Card>
              <CardHeader
                icon={Layers}
                title="Interactive student preview"
                subtitle="The same cards and quiz controls learners use"
                color={colors.secondary}
              />
              <InteractiveLearningPreview
                reviewItems={preview.reviewItems}
                questions={preview.quiz?.questions}
              />
            </Card>
          ) : null}
        </>
      ) : null}

      {intent === 'teacher_lesson_plan' && result ? (
        <PrimaryButton
          label="Export lesson plan as PDF"
          icon={FileText}
          onPress={() => void exportLessonPlan()}
        />
      ) : null}
      {transferPackage && !submission ? (
        <PrimaryButton
          label="Review & send to students"
          icon={Send}
          onPress={() =>
            navigation.navigate('Transfer', {
              packageUri: transferPackage.fileUri,
              displayName: transferPackage.displayName,
            })
          }
        />
      ) : null}

      <Callout
        icon={ShieldCheck}
        tone="info"
        title="Privacy boundary"
        body="Class summaries use aggregate numbers only. Learner insights send patterns without names or IDs."
      />
    </Screen>
  );
}

/** Teacher-context process steps for the shared CompanionThinking panel. */
const TEACHER_THINKING_STEPS = [
  'Reading your class context',
  'Checking privacy rules',
  'Reviewing performance signals',
  'Preparing your draft',
] as const;

function companionDelay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

type TeacherAssistantIntent =
  | 'teacher_lesson_plan'
  | 'teacher_class_summary'
  | 'teacher_author_module'
  | 'teacher_author_quiz'
  | 'teacher_author_reviewer';

function teacherIntentTitle(intent: TeacherAssistantIntent): string {
  if (intent === 'teacher_lesson_plan') return 'Draft a lesson plan';
  if (intent === 'teacher_class_summary') return 'Summarize class performance';
  if (intent === 'teacher_author_module') return 'Draft a student module';
  if (intent === 'teacher_author_quiz') return 'Draft a standalone quiz';
  return 'Draft a teacher reviewer';
}

function teacherIntentSubtitle(
  intent: TeacherAssistantIntent,
  section: Section | null,
): string {
  if (intent === 'teacher_class_summary') {
    return section
      ? `Aggregate patterns from ${section.name}`
      : 'Activate a section to include class patterns';
  }
  return `Grade ${section?.gradeLevel ?? 5} · Editable before sharing`;
}

function teacherIntentPlaceholder(intent: TeacherAssistantIntent): string {
  if (intent === 'teacher_lesson_plan') {
    return 'Example: A 45-minute lesson plan on adding unlike fractions';
  }
  if (intent === 'teacher_class_summary') {
    return 'What should the summary emphasize?';
  }
  if (intent === 'teacher_author_module') {
    return 'Topic, competency, examples, and preferred level of challenge';
  }
  if (intent === 'teacher_author_quiz') {
    return 'Topic, competency, number of questions, and difficulty';
  }
  return 'Topic and the concepts students should practise';
}

function teacherPreviewManifest(
  result: CompanionResponse,
  teacherId = 'local-teacher',
): StudyPackageManifest {
  const packageId = `preview_${result.title
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40)}`;
  return {
    packageId,
    version: 1,
    contentCategory: 'teacherReviewer',
    title: result.title,
    reviewItems: result.flashcards.map((card, index) => ({
      itemId: `${packageId}_card_${index + 1}`,
      moduleId: packageId,
      moduleVersion: 1,
      conceptId: `draft-${index + 1}`,
      type: 'flashcard',
      importance: 'core',
      prompt: card.front,
      answer: card.back,
      formats: { text: card.back },
      authoredBy: `teacher:${teacherId}`,
      tags: ['gurobot-draft'],
    })),
    ...(result.questions.length
      ? {
          quiz: {
            questions: result.questions.map((question, index) => ({
              questionId: `${packageId}_question_${index + 1}`,
              type: 'multiple-choice' as const,
              prompt: question.prompt,
              options: question.options,
              correctAnswer:
                question.options[question.correctOption] ??
                question.options[0] ??
                'No answer supplied',
              conceptId: `draft-${index + 1}`,
            })),
          },
        }
      : {}),
    createdBy: `teacher:${teacherId}`,
    sharedBy: [],
    createdAt: new Date().toISOString(),
  };
}

async function buildTeacherAssistantPackage(args: {
  intent: TeacherAssistantIntent;
  result: CompanionResponse;
  teacherId: string;
  gradeLevel: number;
}): Promise<TransferPackage | null> {
  if (args.intent === 'teacher_author_reviewer') {
    const manifest = {
      ...teacherPreviewManifest(args.result, args.teacherId),
      packageId: `reviewer_${Crypto.randomUUID()}`,
    };
    const normalized: StudyPackageManifest = {
      ...manifest,
      reviewItems: manifest.reviewItems.map((item, index) => ({
        ...item,
        itemId: `${manifest.packageId}_card_${index + 1}`,
        moduleId: manifest.packageId,
      })),
    };
    await saveLearningPackage({
      ownerId: `teacher:${args.teacherId}`,
      manifest: normalized,
    });
    return buildLearningPackage(normalized);
  }
  if (args.intent === 'teacher_author_quiz') {
    if (!args.result.questions.length) {
      throw new Error('The quiz draft did not include any questions.');
    }
    const preview = teacherPreviewManifest(args.result, args.teacherId);
    const packageId = `quiz_${Crypto.randomUUID()}`;
    const manifest: StudyPackageManifest = {
      ...preview,
      packageId,
      contentCategory: 'teacherQuiz',
      reviewItems: [],
      quiz: {
        questions:
          preview.quiz?.questions.map((question, index) => ({
            ...question,
            questionId: `${packageId}_question_${index + 1}`,
          })) ?? [],
      },
    };
    await saveLearningPackage({
      ownerId: `teacher:${args.teacherId}`,
      manifest,
    });
    return buildLearningPackage(manifest);
  }
  if (args.intent !== 'teacher_author_module') return null;
  const preview = teacherPreviewManifest(args.result, args.teacherId);
  return buildTeacherModulePackage({
    title: args.result.title,
    gradeLevel: args.gradeLevel,
    subject: 'ADDED_MATERIALS',
    markdown: [
      `# ${args.result.title}`,
      '',
      args.result.summary,
      '',
      ...args.result.sections.flatMap((section) => [
        `## ${section.heading}`,
        '',
        section.body,
        '',
      ]),
      `## Next step`,
      '',
      args.result.nextStep,
    ].join('\n'),
    images: [],
    reviewItems: preview.reviewItems,
    quizQuestions: preview.quiz?.questions,
  });
}

function latestTeacherResult(session: ChatSession): CompanionResponse | null {
  const message = [...session.messages]
    .reverse()
    .find((item) => item.role === 'assistant');
  if (!message) return null;
  try {
    return JSON.parse(message.content) as CompanionResponse;
  } catch {
    return null;
  }
}

function teacherReadableContent(content: string): string {
  try {
    const result = JSON.parse(content) as CompanionResponse;
    return [
      result.title,
      result.summary,
      ...result.sections.map(
        (section) => `${section.heading}: ${section.body}`,
      ),
      result.nextStep,
    ].join('\n');
  } catch {
    return content;
  }
}

function lessonPlanHtml(result: CompanionResponse): string {
  const sections = result.sections
    .map(
      (section) =>
        `<section><h2>${escapeHtml(section.heading)}</h2><p>${escapeHtml(
          section.body,
        ).replace(/\n/g, '<br>')}</p></section>`,
    )
    .join('');
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17221b;padding:36px;line-height:1.5}
h1{font-size:26px;margin:0 0 8px}h2{font-size:17px;margin:22px 0 6px;color:#126b4d}
p{font-size:12px;margin:0}.summary{font-size:13px;color:#4d5b52;margin-bottom:18px}
.next{margin-top:24px;padding:12px;border-left:4px solid #126b4d;background:#eef8f3}
</style></head><body><h1>${escapeHtml(result.title)}</h1>
<p class="summary">${escapeHtml(result.summary)}</p>${sections}
<div class="next"><strong>Next step:</strong> ${escapeHtml(
    result.nextStep,
  )}</div></body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ────────────────────────────────────────────────────────────────────────
   Teacher profile
   ──────────────────────────────────────────────────────────────────────── */

export function TeacherProfileScreen({ navigation }: TeacherTabProps<'TeacherProfile'>) {
  const mode = useSessionStore((state) => state.mode);
  const modeReason = useSessionStore((state) => state.modeReason);
  const setMode = useSessionStore((state) => state.setMode);
  const signOut = useSessionStore((state) => state.signOut);
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [section, setSection] = useState<Section | null>(null);
  const [dashboard, setDashboard] = useState<TeacherDashboard | null>(null);

  const load = useCallback(async () => {
    const [nextProfile, nextSection] = await Promise.all([
      getTeacherProfile(),
      getActiveSection(),
    ]);
    setProfile(nextProfile);
    setSection(nextSection);
    if (nextSection) setDashboard(await getTeacherDashboard(nextSection.sectionId));
    else setDashboard(null);
  }, []);

  useFocusEffect(useCallback(() => void load(), [load]));

  const name = profile?.name ?? 'Teacher';

  return (
    <Screen bottomClearance>
      <ScreenHeader overline="Account" title="Profile" subtitle={profile?.facultyId ?? 'Faculty'} />

      <Card>
        <View style={styles.profileHead}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>{initials(name)}</Text>
          </View>
          <View style={styles.flexMin}>
            <Text style={styles.profileName} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.body}>
              {section ? `Teacher · ${section.name}` : 'Teacher'}
            </Text>
          </View>
        </View>
        <Divider style={styles.rowDivider} />
        <InfoLine label="Faculty ID" value={profile?.facultyId ?? '—'} />
        {profile ? (
          <>
            <Divider style={styles.rowDivider} />
            <InfoLine label="Member since" value={formatDate(profile.createdAt)} />
          </>
        ) : null}
      </Card>

      <Card>
        <CardHeader
          icon={UsersRound}
          title="Active section"
          subtitle={section ? `Grade ${section.gradeLevel}` : 'No active section'}
          color={colors.secondary}
        />
        {section ? (
          <Row gap={spacing.md}>
            <StatTile
              icon={UsersRound}
              label="Learners"
              value={section?.roster.length ?? 0}
              color={colors.secondary}
            />
            <StatTile
              icon={Trophy}
              label="Class average"
              value={`${Math.round(dashboard?.classAverage ?? 0)}%`}
              color={colors.primary}
            />
          </Row>
        ) : (
          <Text style={styles.body}>
            Open Sections to create a class, then scan student profile QR codes to build your roster.
          </Text>
        )}
        <PrimaryButton
          label="Manage sections"
          icon={UsersRound}
          tone="ghost"
          size="sm"
          onPress={() => navigation.navigate('Sections')}
        />
      </Card>

      <Card>
        <CardHeader icon={Send} title="Device mode" subtitle={modeReason} color={colors.primary} />
        <SegmentedControl
          value={mode}
          onChange={(next) => void setMode(next)}
          options={[
            { value: 'lightweight', label: 'Offline light' },
            { value: 'full', label: 'Full' },
          ]}
        />
      </Card>

      <SectionHeader title="Teaching tools" />
      <Card>
        <ListRow
          icon={PencilLine}
          title="Author a module"
          subtitle="Write a lesson and package it for transfer"
          onPress={() => navigation.navigate('ModuleAuthor')}
        />
        <Divider style={styles.rowDivider} />
        <ListRow
          icon={Layers}
          title="Author review sets"
          subtitle="Build custom flashcard and drill sets"
          color={colors.secondary}
          onPress={() => navigation.navigate('CustomReviewSets')}
        />
        <Divider style={styles.rowDivider} />
        <ListRow
          icon={Send}
          title="Send to a nearby device"
          subtitle="Hand a module to a learner without internet"
          color={colors.accentText}
          onPress={() => navigation.navigate('Transfer')}
        />
      </Card>

      <View style={styles.signOutRow}>
        <PrimaryButton
          label="Sign out"
          tone="danger"
          size="sm"
          icon={LogOut}
          onPress={() => void signOut().then(() => navigation.getParent()?.navigate('Landing'))}
        />
      </View>
    </Screen>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Learner profile
   ──────────────────────────────────────────────────────────────────────── */

export function LearnerDetailScreen({ navigation, route }: StackProps<'LearnerDetail'>) {
  const [report, setReport] = useState<StudentPerformanceReport | null>(null);
  const [insight, setInsight] = useState<CompanionResponse | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [parentMessage, setParentMessage] = useState('');
  const [smsSending, setSmsSending] = useState(false);
  const [smsReceipt, setSmsReceipt] = useState<ParentSmsReceipt | null>(null);
  const compact = useCompactViewport();
  const connectivity = useConnectivity();

  useEffect(() => {
    void getStudentPerformanceReport(route.params.studentId).then(setReport);
  }, [route.params.studentId]);

  const history = report?.quizHistory ?? [];
  const modules = useMemo(() => groupAttemptsByModule(history), [history]);
  const latest = useMemo(
    () =>
      history.reduce<QuizAttempt | null>(
        (best, attempt) =>
          !best || attempt.submittedAt > best.submittedAt ? attempt : best,
        null,
      ),
    [history],
  );

  if (!report) {
    return (
      <Screen>
        <ScreenHeader title="Learner" onBack={navigation.goBack} />
        <EmptyState
          title="Learner not found"
          body="Scan the learner's report again to view their progress."
        />
      </Screen>
    );
  }

  const average = report.averageScorePercentage;
  const growth = peacockPhaseFromScore(average);
  const trendIcon =
    report.trend === 'improving' ? TrendingUp : report.trend === 'declining' ? TrendingDown : Minus;
  const trendColor =
    report.trend === 'improving'
      ? colors.success
      : report.trend === 'declining'
        ? colors.warning
        : colors.secondary;

  async function generateStudentInsight() {
    if (!report) return;
    if (connectivity !== 'online' || !isCompanionConfigured()) {
      Alert.alert('Internet required', 'Connect to use Gurobot insights.');
      return;
    }
    setInsightLoading(true);
    try {
      setInsight(
        await askPavo(
          buildTeacherCompanionRequest({
            intent: 'teacher_student_insight',
            gradeLevel: 5,
            question:
              'Prepare a concrete, format-aware intervention approach for this learner pattern.',
            teacherContext: {
              averageScorePercentage: report.averageScorePercentage,
              trend: report.trend,
              currentLearningFormat: report.profile.currentLearningFormat,
              timingPattern: timingPattern(report.quizHistory),
              strugglingConcepts: report.strugglingConcepts,
            },
          }),
        ),
      );
    } catch (error) {
      Alert.alert(
        'Insight unavailable',
        error instanceof Error ? error.message : 'Try again.',
      );
    } finally {
      setInsightLoading(false);
    }
  }

  async function sendParentMessage() {
    if (!report) return;
    setSmsSending(true);
    try {
      const receipt = await sendParentSmsDemo({
        studentId: report.studentId,
        parentName: report.profile.parentName,
        parentPhone: report.profile.parentPhone,
        message: parentMessage,
      });
      setSmsReceipt(receipt);
      setParentMessage('');
      Alert.alert(
        'Message sent',
        `The progress update was sent to ${receipt.recipientName}.`,
      );
    } catch (error) {
      Alert.alert(
        'Message not sent',
        error instanceof Error ? error.message : 'Check the message and try again.',
      );
    } finally {
      setSmsSending(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader
        overline="Learner profile"
        title={report.profile.name}
        subtitle={`${report.profile.studentNumber} · ${report.profile.section}`}
        onBack={navigation.goBack}
      />

      <HeroCard>
        <View style={styles.heroTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(report.profile.name)}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {report.profile.name}
            </Text>
            <Text style={styles.heroBody}>
              {report.profile.section} · {growth.name}
            </Text>
          </View>
          <RingProgress
            value={average / 100}
            size={compact ? 68 : 82}
            thickness={8}
            color={colors.accent}
            accessibilityLabel={`Average score ${average} percent`}
          >
            <Text style={styles.ringValue}>{average}%</Text>
          </RingProgress>
        </View>
        <View style={styles.heroPanel}>
          <HeroStat label="Attempts" value={history.length} />
          <View style={styles.heroPanelLine} />
          <HeroStat label="Modules" value={modules.length} />
          <View style={styles.heroPanelLine} />
          <HeroStat label="Trend" value={capitalize(report.trend)} />
        </View>
      </HeroCard>

      <SectionHeader title="Student and parent" caption="Contact shared from the learner profile" />
      <Card>
        <InfoLine label="Student number" value={report.profile.studentNumber} />
        <Divider />
        <InfoLine
          label="Parent or guardian"
          value={report.profile.parentName || 'Not provided'}
        />
        <Divider />
        <InfoLine
          label="Mobile number"
          value={report.profile.parentPhone || 'Not provided'}
        />
      </Card>

      <TileGrid>
        <StatTile
          icon={Trophy}
          label="Average score"
          value={`${average}%`}
          footnote={average >= 80 ? 'Strong mastery' : 'Keep practicing'}
          color={colors.primary}
        />
        <StatTile
          icon={ClipboardList}
          label="Quiz attempts"
          value={history.length}
          footnote={history.length ? 'Scanned on this device' : 'Nothing scanned yet'}
          color={colors.secondary}
        />
        <StatTile
          icon={trendIcon}
          label="Performance trend"
          value={capitalize(report.trend)}
          footnote="Across recent attempts"
          color={trendColor}
        />
        <StatTile
          icon={Sparkles}
          label="Learning format"
          value={capitalize(report.profile.currentLearningFormat)}
          footnote="Currently in use"
          color={colors.accentText}
        />
      </TileGrid>

      <SectionHeader title="Strengths and gaps" caption="Taken from the most recent report" />
      <Card>
        <View style={styles.focusRow}>
          <View style={[styles.focusPanel, { backgroundColor: colors.successTint }]}>
            <Text style={styles.focusLabel}>Strong area</Text>
            <Text style={styles.focusValue} numberOfLines={3}>
              {latest?.strongTopic ?? 'No report scanned yet'}
            </Text>
          </View>
          <View style={[styles.focusPanel, { backgroundColor: colors.warningTint }]}>
            <Text style={styles.focusLabel}>Practice next</Text>
            <Text style={styles.focusValue} numberOfLines={3}>
              {latest?.weakTopic ?? 'No report scanned yet'}
            </Text>
          </View>
        </View>
        <Divider />
        {report.strugglingConcepts.length ? (
          report.strugglingConcepts.slice(0, 5).map((concept, index) => (
            <View key={concept.conceptId}>
              {index > 0 ? <Divider style={styles.rowDivider} /> : null}
              <View style={styles.rowBetween}>
                <View style={styles.flex}>
                  <Text style={styles.rowTitle} numberOfLines={2}>
                    {concept.conceptId}
                  </Text>
                  <Text style={styles.rowMeta}>
                    Missed across {concept.attempts}{' '}
                    {concept.attempts === 1 ? 'attempt' : 'attempts'}
                  </Text>
                </View>
                <View style={styles.missPill}>
                  <Text style={styles.missPillText}>
                    {concept.missCount} {concept.missCount === 1 ? 'miss' : 'misses'}
                  </Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.rowMeta}>No missed concepts recorded.</Text>
        )}
      </Card>
      <PrimaryButton
        label={
          insightLoading ? 'Preparing approach...' : 'Generate AI approach plan'
        }
        icon={Sparkles}
        disabled={insightLoading || history.length === 0}
        onPress={() => void generateStudentInsight()}
      />
      {insight ? <AiReportCard result={insight} /> : null}

      <SectionHeader
        title="Message parent"
        caption="Prepare a direct progress update"
      />
      <Card accent={colors.secondary}>
        <CardHeader
          icon={MessageSquareText}
          title={report.profile.parentName || 'Parent contact unavailable'}
          subtitle={report.profile.parentPhone || 'Add contact details through the student profile QR'}
          color={colors.secondary}
        />
        <TextInput
          value={parentMessage}
          onChangeText={(value) => {
            setParentMessage(value);
            setSmsReceipt(null);
          }}
          accessibilityLabel="Message to parent or guardian"
          placeholder={`Write a progress update for ${report.profile.parentName || 'the parent'}...`}
          placeholderTextColor={colors.inkSubtle}
          selectionColor={colors.primary}
          multiline
          maxLength={PARENT_SMS_CHARACTER_LIMIT}
          textAlignVertical="top"
          style={styles.parentMessageInput}
        />
        <View style={styles.messageFooter}>
          <View style={styles.messageRecipient}>
            <Phone size={14} color={colors.inkMuted} />
            <Text style={styles.messageRecipientText} numberOfLines={1}>
              {report.profile.parentPhone || 'No mobile number'}
            </Text>
          </View>
          <Text style={styles.characterCount}>
            {parentMessage.length}/{PARENT_SMS_CHARACTER_LIMIT}
          </Text>
        </View>
        <PrimaryButton
          label={smsSending ? 'Sending...' : 'Send message'}
          icon={Send}
          loading={smsSending}
          disabled={
            smsSending ||
            !parentMessage.trim() ||
            !report.profile.parentName ||
            !report.profile.parentPhone
          }
          onPress={() => void sendParentMessage()}
        />
        {smsReceipt ? (
          <Callout
            icon={CheckCircle2}
            title="Message sent"
            body={`Sent to ${smsReceipt.recipientName} at ${new Date(
              smsReceipt.sentAt,
            ).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`}
            tone="success"
          />
        ) : null}
      </Card>

      <SectionHeader title="Module breakdown" caption="Averages per module on this device" />
      {modules.length ? (
        modules.map((module) => (
          <Card key={module.moduleId}>
            <CardHeader
              icon={BookOpen}
              title={module.moduleId}
              subtitle={`${module.attempts} ${
                module.attempts === 1 ? 'attempt' : 'attempts'
              } · Best ${module.best}% · Latest ${formatDate(module.lastSubmittedAt)}`}
              color={module.average >= 80 ? colors.success : colors.secondary}
              action={
                <StatusBadge
                  label={`${module.average}%`}
                  status={
                    module.average >= 80
                      ? 'completed'
                      : module.average >= 50
                        ? 'inProgress'
                        : 'notStarted'
                  }
                />
              }
            />
            <ProgressBar
              value={module.average / 100}
              height={8}
              accessibilityLabel={`${module.moduleId} average ${module.average} percent`}
            />
          </Card>
        ))
      ) : (
        <Card>
          <Text style={styles.rowMeta}>No quiz reports scanned yet.</Text>
        </Card>
      )}

      <SectionHeader title="Quiz history" caption="Most recent reports first" />
      <Card>
        {history.length ? (
          history
            .slice()
            .sort((a, b) => b.submittedAt - a.submittedAt)
            .slice(0, 10)
            .map((attempt, index) => {
              const percent = Math.round(
                (attempt.score / Math.max(1, attempt.totalItems)) * 100,
              );
              return (
                <View key={attempt.id}>
                  {index > 0 ? <Divider style={styles.rowDivider} /> : null}
                  <View style={styles.historyRow}>
                    <IconPlate
                      icon={percent >= 80 ? Award : Target}
                      color={percent >= 80 ? colors.success : colors.secondary}
                      size={36}
                    />
                    <View style={styles.flex}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {formatDate(attempt.submittedAt)}
                      </Text>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        {attempt.score} of {attempt.totalItems} correct · Attempt #
                        {attempt.attemptNumber}
                      </Text>
                    </View>
                    <Text style={styles.rowScore}>{percent}%</Text>
                  </View>
                </View>
              );
            })
        ) : (
          <Text style={styles.rowMeta}>No quiz reports scanned yet.</Text>
        )}
      </Card>
    </Screen>
  );
}

interface ModuleBreakdown {
  moduleId: string;
  attempts: number;
  average: number;
  best: number;
  lastSubmittedAt: number;
}

/** Presentation-only roll-up of the already-loaded quiz history. */
function groupAttemptsByModule(history: QuizAttempt[]): ModuleBreakdown[] {
  const buckets = new Map<string, QuizAttempt[]>();
  for (const attempt of history) {
    const bucket = buckets.get(attempt.moduleId);
    if (bucket) bucket.push(attempt);
    else buckets.set(attempt.moduleId, [attempt]);
  }
  const percent = (attempt: QuizAttempt) =>
    Math.round((attempt.score / Math.max(1, attempt.totalItems)) * 100);
  return [...buckets.entries()]
    .map(([moduleId, attempts]) => ({
      moduleId,
      attempts: attempts.length,
      average: Math.round(
        attempts.reduce((sum, attempt) => sum + percent(attempt), 0) / attempts.length,
      ),
      best: attempts.reduce((max, attempt) => Math.max(max, percent(attempt)), 0),
      lastSubmittedAt: attempts.reduce(
        (max, attempt) => Math.max(max, attempt.submittedAt),
        0,
      ),
    }))
    .sort((a, b) => b.lastSubmittedAt - a.lastSubmittedAt);
}

function timingPattern(
  attempts: QuizAttempt[],
): 'fast-and-wrong' | 'slow-and-wrong' | 'mixed' | 'no-misses' {
  const missed = attempts.flatMap((attempt) =>
    attempt.responses.filter((response) => !response.isCorrect),
  );
  if (missed.length === 0) return 'no-misses';
  const averageSeconds =
    missed.reduce((sum, response) => sum + response.elapsedMs / 1_000, 0) /
    missed.length;
  if (averageSeconds <= 15) return 'fast-and-wrong';
  if (averageSeconds >= 45) return 'slow-and-wrong';
  return 'mixed';
}

function AiReportCard({
  result,
  animate = false,
}: {
  result: CompanionResponse;
  animate?: boolean;
}) {
  // Same shared typewriter as the student bot, so both reveal answers alike.
  const typed = useTypewriterSequence(
    [result.summary, ...result.sections.map((section) => section.body)],
    { play: animate },
  );
  return (
    <Card accent={colors.accentText}>
      <CardHeader
        icon={Sparkles}
        title={result.title}
        subtitle="AI-generated suggestion · Review before acting"
        color={colors.accentText}
      />
      <Pressable
        accessibilityRole={animate && !typed.done ? 'button' : undefined}
        accessibilityLabel={animate && !typed.done ? 'Reveal the full answer' : undefined}
        onPress={animate && !typed.done ? typed.skip : undefined}
      >
        <TypewriterLine text={typed.textFor(0)} typing={typed.isTyping(0)} style={styles.body} />
        {result.sections.map((section, index) =>
          typed.isRevealed(index + 1) ? (
            <View key={`${section.heading}-${index}`} style={styles.insightSection}>
              <Text style={styles.rowTitle}>{section.heading}</Text>
              <TypewriterLine
                text={typed.textFor(index + 1)}
                typing={typed.isTyping(index + 1)}
                style={styles.body}
              />
            </View>
          ) : null,
        )}
      </Pressable>
      {typed.done ? (
        <Callout icon={Target} title="Next step" body={result.nextStep} tone="info" />
      ) : null}
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Offline transfer
   ──────────────────────────────────────────────────────────────────────── */

export function TransferScreen({ navigation, route }: StackProps<'Transfer'>) {
  const [transferPackage, setTransferPackage] = useState<TransferPackage | null>(null);
  const [peers, setPeers] = useState<NearbyPeer[]>([]);
  const [update, setUpdate] = useState<NearbyTransferUpdate | null>(null);
  const available = nearby.isAvailable();

  useEffect(() => {
    const setId = route.params?.setId;
    const packageUri = route.params?.packageUri;
    if (packageUri) {
      void inspectLearningPackage(packageUri, route.params?.displayName)
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

  const progress =
    update && update.totalBytes > 0 ? update.bytesTransferred / update.totalBytes : 0;

  return (
    <Screen>
      <ScreenHeader
        overline="Share"
        title="Offline module transfer"
        subtitle="Curriculum and review packages, device to device."
        onBack={navigation.goBack}
      />

      <Callout
        icon={available ? Bluetooth : WifiOff}
        tone={available ? 'success' : 'warning'}
        title={available ? 'Nearby is ready' : 'Development build required'}
        body={
          available
            ? 'Nearby Connections can use Bluetooth and local Wi-Fi without internet.'
            : 'Module inspection works here — device-to-device transfer needs the native Nearby module on physical devices.'
        }
      />

      <SectionHeader title="Package" caption="What will be handed over" />
      {transferPackage ? (
        <Card accent={colors.primary}>
          <CardHeader
            icon={FileText}
            title={transferPackage.displayName}
            subtitle={`${formatBytes(transferPackage.sizeBytes)} · ${
              transferPackage.manifest.contentCategory === 'teacherModule'
                ? `${transferPackage.manifest.assets.length} image asset${
                    transferPackage.manifest.assets.length === 1 ? '' : 's'
                  }`
                : transferPackage.manifest.contentCategory === 'teacherReviewer'
                  ? `${transferPackage.manifest.reviewItems.length} review items`
                  : transferPackage.manifest.contentCategory === 'studentMaterial'
                    ? `${transferPackage.manifest.reviewItems.length} Study Jam items`
                    : `${transferPackage.manifest.quiz?.questions.length ?? 0} quiz questions`
            } · Manifest v${transferPackage.manifest.version}`}
            color={colors.primary}
          />
          <Divider />
          <View>
            <Text style={styles.fieldCaption}>Integrity checksum</Text>
            <Text style={styles.hash} numberOfLines={2}>
              SHA-256 {transferPackage.sha256}
            </Text>
          </View>
        </Card>
      ) : (
        <Card>
          <CardHeader
            icon={PencilLine}
            title="Nothing queued yet"
            subtitle="Author a module or pick a review set, then come back to send it."
            color={colors.secondary}
          />
          <PrimaryButton
            label="Author a Markdown module"
            icon={PencilLine}
            tone="ghost"
            onPress={() => navigation.replace('ModuleAuthor')}
          />
        </Card>
      )}

      <PrimaryButton
        label="Find Nearby student devices"
        icon={Search}
        disabled={!available || !transferPackage}
        onPress={() => void findDevices()}
      />

      {peers.length ? (
        <>
          <SectionHeader
            title="Nearby devices"
            caption={`${peers.length} ${peers.length === 1 ? 'device' : 'devices'} in range`}
          />
          <Card>
            {peers.map((peer, index) => (
              <View key={peer.id}>
                {index > 0 ? <Divider style={styles.rowDivider} /> : null}
                <View style={styles.peerRow}>
                  <View
                    style={[
                      styles.peerDot,
                      { backgroundColor: peer.connected ? colors.success : colors.outlineStrong },
                    ]}
                  />
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {peer.name}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {peer.connected ? 'Paired and ready' : 'Discovered — not paired yet'}
                    </Text>
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
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {update ? (
        <>
          <SectionHeader title="Transfer status" caption="Live progress on this device" />
          <Card
            accent={
              update.status === 'complete'
                ? colors.success
                : update.status === 'failed'
                  ? colors.error
                  : colors.primary
            }
          >
            <View style={styles.rowBetween}>
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
              <Text style={styles.progressValue}>{Math.round(progress * 100)}%</Text>
            </View>
            <ProgressBar
              value={progress}
              accessibilityLabel={`Transfer ${Math.round(progress * 100)} percent complete`}
            />
            <Text style={styles.body}>
              {formatBytes(update.bytesTransferred)} of {formatBytes(update.totalBytes)}
            </Text>
            {update.errorMessage ? (
              <Callout
                icon={TriangleAlert}
                tone="error"
                title="Transfer interrupted"
                body={update.errorMessage}
              />
            ) : null}
            {update.status === 'queued' || update.status === 'transferring' ? (
              <PrimaryButton
                label="Cancel transfer"
                icon={X}
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
        </>
      ) : null}
    </Screen>
  );
}

function formatBytes(value: number): string {
  if (value < 1_024) return `${value} B`;
  if (value < 1_048_576) return `${(value / 1_024).toFixed(1)} KB`;
  return `${(value / 1_048_576).toFixed(1)} MB`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase() ?? '')
    .join('');
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  fixedHeader: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  listContent: { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.huge },
  gridRow: { gap: spacing.md },
  cardCell: { flex: 1 },
  flexCard: { flex: 1 },
  tileSkeleton: { borderRadius: radius.lg, flexGrow: 1 },
  heroSkeleton: { borderRadius: radius.xxl },
  rowDivider: { marginVertical: spacing.xs },

  // Hero
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  heroOverline: { ...text.overline, color: colors.onBrandSubtle },
  heroTitle: { ...text.h2, color: colors.onBrand, marginTop: 2 },
  heroBody: { ...text.bodySm, color: colors.onBrandMuted, marginTop: spacing.xs },
  heroPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.onBrandSurface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  heroPanelLine: { width: 1, alignSelf: 'stretch', backgroundColor: colors.onBrandLine },
  heroStat: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: spacing.xs },
  heroStatValue: { ...text.title, color: colors.onBrand },
  heroStatLabel: { ...text.tiny, color: colors.onBrandSubtle, textAlign: 'center' },
  ringValue: { ...text.title, color: colors.onBrand, fontWeight: '800' },
  ringCaption: { ...text.tiny, color: colors.onBrandSubtle },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.round,
    backgroundColor: colors.onBrandSurface,
    borderWidth: 1,
    borderColor: colors.onBrandLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...text.title, color: colors.onBrand, fontWeight: '800' },

  // Teacher profile
  flexMin: { flex: 1, minWidth: 0 },
  profileHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: radius.round,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: { ...text.title, color: colors.primary, fontWeight: '800' },
  profileName: { ...text.h2, color: colors.ink },
  infoLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  infoLabel: { ...text.overline, color: colors.inkMuted, letterSpacing: 0.4, fontSize: 11 },
  infoValue: { ...text.bodyStrong, color: colors.ink },

  // Shared rows
  body: { ...text.bodySm, color: colors.inkMuted },
  rowTitle: { ...text.bodyStrong, color: colors.ink },
  rowMeta: { ...text.caption, color: colors.inkMuted, fontWeight: '500' },
  rowScore: { ...text.title, color: colors.success },
  rowScoreWarn: { color: colors.warning },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  fieldCaption: { ...text.overline, color: colors.inkSubtle, fontSize: 11 },
  insightSection: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  assistantInput: {
    minHeight: 118,
    maxHeight: 220,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontSize: 16,
    lineHeight: 23,
  },
  progressValue: { ...text.label, color: colors.primary, fontWeight: '800' },

  // Leaderboard
  leaderRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  rank: {
    width: 28,
    height: 28,
    borderRadius: radius.round,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankTop: { backgroundColor: colors.primaryTint },
  rankText: { ...text.caption, fontWeight: '800', color: colors.inkMuted },
  rankTextTop: { color: colors.primary },
  peacockCell: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conceptRow: { gap: spacing.sm, paddingVertical: spacing.xs },

  // Record book
  searchBox: {
    minHeight: 50,
    borderWidth: 1.5,
    borderColor: colors.outline,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchBoxFocused: { borderColor: colors.primary, backgroundColor: colors.surface },
  searchInput: { flex: 1, color: colors.ink, fontSize: 16, minHeight: 44 },
  rosterMeta: { ...text.caption, color: colors.inkMuted, fontWeight: '600' },
  learnerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  masteryBlock: { gap: spacing.xs },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  learnerFacts: { gap: 2 },
  supportReason: {
    ...text.caption,
    color: colors.warning,
    fontWeight: '600',
    backgroundColor: colors.warningTint,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },

  // Learner detail
  focusRow: { flexDirection: 'row', gap: spacing.md },
  focusPanel: { flex: 1, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  focusLabel: { ...text.overline, color: colors.inkMuted, letterSpacing: 0.4, fontSize: 11 },
  focusValue: { ...text.bodyStrong, color: colors.ink, marginTop: 2 },
  missPill: {
    backgroundColor: colors.warningTint,
    borderRadius: radius.round,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  missPillText: { ...text.caption, color: colors.warning, fontWeight: '800' },
  parentMessageInput: {
    minHeight: 132,
    maxHeight: 220,
    borderWidth: 1.5,
    borderColor: colors.outline,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.ink,
    padding: spacing.md,
    fontSize: 16,
    lineHeight: 23,
  },
  messageFooter: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  messageRecipient: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  messageRecipientText: {
    ...text.caption,
    color: colors.inkMuted,
    fontWeight: '600',
    flex: 1,
  },
  characterCount: { ...text.caption, color: colors.inkSubtle, fontWeight: '700' },
  historyRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },

  // Scanner
  scannerScreen: { padding: 0, gap: 0 },
  scannerHeader: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  cameraFrame: {
    flex: 1,
    minHeight: 340,
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.canopyDeep,
  },
  scanOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  scanTarget: { width: 236, height: 236 },
  scanCorner: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderColor: colors.onBrand,
  },
  scanCornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: radius.lg,
  },
  scanCornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: radius.lg,
  },
  scanCornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: radius.lg,
  },
  scanCornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: radius.lg,
  },
  scanHint: {
    ...text.label,
    color: colors.onBrand,
    backgroundColor: colors.scrim,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.round,
    overflow: 'hidden',
  },
  scanResult: {
    padding: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.background,
  },

  // Transfer
  peerRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  peerDot: { width: 10, height: 10, borderRadius: radius.round },
  peerAction: { minWidth: 116 },
  hash: {
    color: colors.inkSubtle,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'monospace',
    marginTop: 2,
  },

  signOutRow: { marginTop: spacing.sm, alignItems: 'center' },
});
