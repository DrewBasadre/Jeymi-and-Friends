import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAudioPlayer } from 'expo-audio';
import {
  BookOpen,
  Brain,
  CircleStop,
  Clock3,
  CloudUpload,
  Download,
  LogOut,
  Play,
  QrCode,
  RefreshCw,
  Settings2,
  Sparkles,
  Volume2,
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import Pdf from 'react-native-pdf';
import {
  Card,
  Chip,
  EmptyState,
  IconButton,
  Metric,
  PrimaryButton,
  Screen,
  ScreenHeader,
  SectionTitle,
} from '@/components/ui';
import {
  getAttempts,
  getDueFlashcards,
  getLearningProfile,
  getModule,
  getPrivacyConsent,
  getQuestions,
  getStudentDashboard,
  listModules,
  markLessonRead,
  reviewFlashcard,
  savePrivacyConsent,
  submitQuiz,
} from '@/data/repository';
import { encodeQuizReportV2 } from '@/domain/qr';
import type {
  DueFlashcard,
  FlashcardRating,
  LearningModule,
  LearningProfile,
  QuestionResponse,
  QuizAttempt,
  QuizQuestion,
  StudentDashboard,
  Subject,
} from '@/domain/types';
import type {
  RootStackParamList,
  StudentTabParamList,
} from '@/navigation/types';
import {
  connectStudentCloudAccount,
  syncStudentData,
} from '@/services/cloudSync';
import { generateCloudVoice } from '@/services/cloudVoice';
import { readModuleAloud, stopReading } from '@/services/speech';
import { useSessionStore } from '@/store/session';
import { colors, radius, spacing, subjectColor } from '@/theme/tokens';

type StudentTabProps<Route extends keyof StudentTabParamList> = CompositeScreenProps<
  BottomTabScreenProps<StudentTabParamList, Route>,
  NativeStackScreenProps<RootStackParamList>
>;

type StackProps<Route extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  Route
>;

export function StudentHomeScreen({ navigation }: StudentTabProps<'StudentHome'>) {
  const student = useSessionStore((state) => state.student);
  const mode = useSessionStore((state) => state.mode);
  const [dashboard, setDashboard] = useState<StudentDashboard | null>(null);
  const [profile, setProfile] = useState<LearningProfile | null>(null);

  const load = useCallback(async () => {
    if (!student) return;
    const [nextDashboard, nextProfile] = await Promise.all([
      getStudentDashboard(student.id),
      getLearningProfile(student.id),
    ]);
    setDashboard(nextDashboard);
    setProfile(nextProfile);
  }, [student]);

  useFocusEffect(useCallback(() => void load(), [load]));

  if (!student) return <EmptyState title="No student profile" body="Sign in again to open your learning hub." />;
  return (
    <Screen>
      <ScreenHeader
        title={`Hi, ${student.firstName}`}
        subtitle={`Grade ${student.gradeLevel} - ${student.section}`}
        action={<Chip label={mode === 'lightweight' ? 'Offline light' : 'Full mode'} color={colors.emerald} selected />}
      />
      <Card accent={colors.indigo}>
        <Text style={styles.eyebrow}>LEARNING MATCH</Text>
        <Text style={styles.heroTitle}>
          {profile ? `${capitalize(profile.primaryStyle)} learning` : 'Balanced learning'}
        </Text>
        <Text style={styles.body}>
          Lessons with matching formats appear first. This profile guides presentation, not ability.
        </Text>
      </Card>
      <View style={styles.metricGrid}>
        <Metric
          label="Modules complete"
          value={`${dashboard?.completedModules ?? 0}/${dashboard?.totalModules ?? 0}`}
          tint={colors.indigoTint}
        />
        <Metric label="Average score" value={`${dashboard?.averageScore ?? 0}%`} tint={colors.emeraldTint} />
        <Metric label="Cards due" value={dashboard?.dueFlashcards ?? 0} tint={colors.amberTint} />
        <Metric label="Quiz attempts" value={dashboard?.totalAttempts ?? 0} tint={colors.coralTint} />
      </View>
      <Card>
        <SectionTitle>Today’s focus</SectionTitle>
        <Text style={styles.focusLabel}>Practice next</Text>
        <Text style={styles.focusValue}>{dashboard?.weakTopic ?? 'Loading...'}</Text>
        <Text style={styles.focusLabel}>Strong area</Text>
        <Text style={styles.focusValue}>{dashboard?.strongTopic ?? 'Loading...'}</Text>
      </Card>
      <PrimaryButton
        label="Review flashcards"
        icon={Brain}
        onPress={() => navigation.navigate('Flashcards')}
      />
      <PrimaryButton
        label="Open modules"
        tone="secondary"
        icon={BookOpen}
        onPress={() => navigation.navigate('Modules')}
      />
    </Screen>
  );
}

export function ModulesScreen({ navigation }: StudentTabProps<'Modules'>) {
  const student = useSessionStore((state) => state.student);
  const [modules, setModules] = useState<LearningModule[]>([]);
  const [filter, setFilter] = useState<Subject | 'ALL'>('ALL');

  useFocusEffect(
    useCallback(() => {
      if (student) void listModules(student.id).then(setModules);
    }, [student]),
  );

  const filtered = filter === 'ALL' ? modules : modules.filter((module) => module.subject === filter);
  return (
    <Screen scroll={false} style={styles.flex}>
      <View style={styles.fixedHeader}>
        <ScreenHeader title="Modules" subtitle="Downloaded lessons remain available without internet." />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {(['ALL', 'SCIENCE', 'MATH', 'ENGLISH', 'ADDED_MATERIALS'] as const).map((subject) => (
            <Chip
              key={subject}
              label={subject === 'ADDED_MATERIALS' ? 'Added' : capitalize(subject.toLocaleLowerCase())}
              selected={filter === subject}
              color={subject === 'ALL' ? colors.indigo : subjectColor[subject]}
              onPress={() => setFilter(subject)}
            />
          ))}
        </ScrollView>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(module) => module.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate('ModuleReader', { moduleId: item.id })}>
            <Card accent={subjectColor[item.subject]}>
              <View style={styles.moduleTop}>
                <Chip label={item.subject.replace('_', ' ')} color={subjectColor[item.subject]} selected />
                <Text style={styles.moduleCode}>{item.competencyCode}</Text>
              </View>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.body}>{item.summary}</Text>
              <View style={styles.styleTags}>
                {item.contentStyleTags.slice(0, 3).map((tag) => (
                  <Text key={tag} style={styles.styleTag}>{capitalize(tag)}</Text>
                ))}
              </View>
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={<EmptyState title="No modules here" body="Choose another subject or import a teacher module." />}
      />
    </Screen>
  );
}

export function ModuleReaderScreen({ navigation, route }: StackProps<'ModuleReader'>) {
  const student = useSessionStore((state) => state.student);
  const canUseOnline = useSessionStore((state) => state.canUseOnlineEnhancements);
  const [module, setModule] = useState<LearningModule | null>(null);
  const [reading, setReading] = useState(false);
  const [cloudVoiceLoading, setCloudVoiceLoading] = useState(false);
  const [cloudVoiceAllowed, setCloudVoiceAllowed] = useState(false);
  const cloudVoicePlayer = useAudioPlayer(null);

  useEffect(() => {
    void getModule(route.params.moduleId).then(setModule);
    if (student) {
      void getPrivacyConsent(student.id).then((consent) => {
        setCloudVoiceAllowed(consent?.aiDiagnosticsAllowed === true);
      });
    }
    return () => void stopReading();
  }, [route.params.moduleId, student]);

  if (!module) {
    return <Screen><ScreenHeader title="Opening module..." onBack={navigation.goBack} /></Screen>;
  }

  async function toggleRead() {
    if (reading) {
      await stopReading();
      setReading(false);
      return;
    }
    setReading(true);
    await readModuleAloud(module!.content, {
      onDone: () => setReading(false),
      onError: () => setReading(false),
    }).catch((error) => Alert.alert('Read aloud', error.message));
  }

  async function finishLesson() {
    if (student) await markLessonRead(student.id, module!.id);
    navigation.navigate('Quiz', { moduleId: module!.id });
  }

  async function playEnhancedVoice() {
    setCloudVoiceLoading(true);
    try {
      const uri = await generateCloudVoice(module!.content);
      cloudVoicePlayer.replace(uri);
      cloudVoicePlayer.play();
    } catch (error) {
      Alert.alert(
        'Enhanced voice unavailable',
        error instanceof Error ? error.message : 'Use the on-device read aloud button.',
      );
    } finally {
      setCloudVoiceLoading(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader
        title={module.title}
        subtitle={module.competencyCode}
        onBack={navigation.goBack}
        action={
          <IconButton
            icon={reading ? CircleStop : Volume2}
            label={reading ? 'Stop reading' : 'Read aloud'}
            active={reading}
            onPress={() => void toggleRead()}
          />
        }
      />
      {module.localAssetUri ? (
        <View style={styles.pdfFrame}>
          <Pdf
            source={{ uri: module.localAssetUri, cache: true }}
            style={styles.pdf}
            trustAllCerts={false}
            onError={(error) => Alert.alert('PDF unavailable', String(error))}
          />
        </View>
      ) : (
        <Card accent={subjectColor[module.subject]}>
          <Text style={styles.readerText}>{module.content}</Text>
        </Card>
      )}
      <Card>
        <Text style={styles.cardTitle}>Try it your way</Text>
        <Text style={styles.body}>
          Explain one idea aloud, sketch it, write two sentences, or demonstrate it with nearby objects.
        </Text>
      </Card>
      {canUseOnline && cloudVoiceAllowed && module.content ? (
        <PrimaryButton
          label="Play enhanced voice sample"
          tone="secondary"
          icon={Sparkles}
          loading={cloudVoiceLoading}
          onPress={() => void playEnhancedVoice()}
        />
      ) : null}
      <PrimaryButton label="Lesson read - start quiz" icon={Play} onPress={() => void finishLesson()} />
    </Screen>
  );
}

export function QuizScreen({ navigation, route }: StackProps<'Quiz'>) {
  const student = useSessionStore((state) => state.student);
  const [module, setModule] = useState<LearningModule | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timings, setTimings] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const startedAt = useRef(Date.now());
  const questionStartedAt = useRef(Date.now());

  useEffect(() => {
    void Promise.all([getModule(route.params.moduleId), getQuestions(route.params.moduleId)]).then(
      ([nextModule, nextQuestions]) => {
        setModule(nextModule);
        setQuestions(nextQuestions);
      },
    );
  }, [route.params.moduleId]);

  const question = questions[index];
  const selected = question ? answers[question.id] : undefined;

  function answer(value: string) {
    if (!question) return;
    setAnswers((current) => ({ ...current, [question.id]: value }));
  }

  async function next() {
    if (!question || !selected) return;
    const now = Date.now();
    const nextTimings = {
      ...timings,
      [question.id]: (timings[question.id] ?? 0) + (now - questionStartedAt.current),
    };
    setTimings(nextTimings);
    questionStartedAt.current = now;
    if (index < questions.length - 1) {
      setIndex((current) => current + 1);
      return;
    }
    if (!student || !module) return;
    setSubmitting(true);
    try {
      const responses = questions.map((item) => ({
        questionId: item.id,
        answer: answers[item.id] ?? '',
        elapsedMs: nextTimings[item.id] ?? 0,
      }));
      const attempt = await submitQuiz({
        studentId: student.id,
        moduleId: module.id,
        responses,
        startedAt: startedAt.current,
      });
      navigation.replace('QuizResult', { module, attempt });
    } catch (error) {
      Alert.alert('Quiz not saved', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!module || !question) {
    return <Screen><ScreenHeader title="Preparing quiz..." onBack={navigation.goBack} /></Screen>;
  }
  return (
    <Screen>
      <ScreenHeader
        title={module.title}
        subtitle={`Question ${index + 1} of ${questions.length}`}
        onBack={navigation.goBack}
      />
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${((index + 1) / questions.length) * 100}%` }]} />
      </View>
      <Card accent={subjectColor[module.subject]}>
        <View style={styles.timerLine}>
          <Clock3 size={17} color={colors.inkMuted} />
          <Text style={styles.moduleCode}>Timing this question locally</Text>
        </View>
        <Text style={styles.question}>{question.questionText}</Text>
      </Card>
      <View style={styles.optionList}>
        {question.choices.map((choice) => (
          <Pressable
            key={choice}
            onPress={() => answer(choice)}
            style={[styles.answerOption, selected === choice && styles.answerSelected]}
          >
            <View style={[styles.radio, selected === choice && styles.radioSelected]} />
            <Text style={styles.answerText}>{choice}</Text>
          </Pressable>
        ))}
      </View>
      <PrimaryButton
        label={index === questions.length - 1 ? 'Submit quiz' : 'Next question'}
        loading={submitting}
        disabled={!selected}
        onPress={() => void next()}
      />
    </Screen>
  );
}

export function QuizResultScreen({ navigation, route }: StackProps<'QuizResult'>) {
  const { module, attempt } = route.params;
  const percent = attempt.totalItems > 0 ? Math.round((attempt.score / attempt.totalItems) * 100) : 0;
  return (
    <Screen>
      <ScreenHeader title="Quiz complete" subtitle={module.title} />
      <Card accent={percent >= 80 ? colors.emerald : colors.amber}>
        <Text style={styles.score}>{attempt.score}/{attempt.totalItems}</Text>
        <Text style={styles.scoreLabel}>{percent}% - {capitalize(attempt.masteryLevel.toLocaleLowerCase())}</Text>
        <View style={styles.resultRow}>
          <View style={styles.flex}>
            <Text style={styles.focusLabel}>Strong topic</Text>
            <Text style={styles.focusValue}>{attempt.strongTopic}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.focusLabel}>Practice next</Text>
            <Text style={styles.focusValue}>{attempt.weakTopic}</Text>
          </View>
        </View>
        <Text style={styles.body}>Time: {formatDuration(attempt.durationSeconds)} - Attempt {attempt.attemptNumber} of 2</Text>
      </Card>
      <PrimaryButton
        label="Show report QR"
        icon={QrCode}
        onPress={() => navigation.navigate('QuizReport', { moduleId: module.id, attemptId: attempt.id })}
      />
      <PrimaryButton label="Back to modules" tone="secondary" onPress={() => navigation.navigate('StudentTabs')} />
    </Screen>
  );
}

export function FlashcardsScreen({ navigation }: StackProps<'Flashcards'>) {
  const student = useSessionStore((state) => state.student);
  const [cards, setCards] = useState<DueFlashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const load = useCallback(async () => {
    if (student) setCards(await getDueFlashcards(student.id));
  }, [student]);
  useEffect(() => void load(), [load]);
  const card = cards[index];

  async function rate(rating: FlashcardRating) {
    if (!card) return;
    await reviewFlashcard(card, rating);
    setRevealed(false);
    setIndex((current) => current + 1);
  }

  return (
    <Screen>
      <ScreenHeader
        title="Flashcard review"
        subtitle={card ? `${index + 1} of ${cards.length} due` : 'Spaced repetition'}
        onBack={navigation.goBack}
      />
      {!card ? (
        <EmptyState title="You’re caught up" body="WAIS will bring cards back when they are useful to review." />
      ) : (
        <>
          <Pressable onPress={() => setRevealed((value) => !value)}>
            <View style={[styles.flashcard, revealed && styles.flashcardBack]}>
              <Text style={styles.flashcardLabel}>{revealed ? 'ANSWER' : 'PROMPT'}</Text>
              <Text style={styles.flashcardText}>{revealed ? card.back : card.front}</Text>
              <Text style={styles.helper}>{revealed ? 'How well did you remember?' : 'Tap to reveal'}</Text>
            </View>
          </Pressable>
          {revealed ? (
            <View style={styles.ratingGrid}>
              {([
                [1, 'Again'],
                [2, 'Hard'],
                [3, 'Good'],
                [4, 'Easy'],
              ] as const).map(([rating, label]) => (
                <Pressable key={rating} style={styles.rating} onPress={() => void rate(rating)}>
                  <Text style={styles.ratingNumber}>{rating}</Text>
                  <Text style={styles.ratingLabel}>{label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

export function ReportsScreen({ navigation }: StudentTabProps<'Reports'>) {
  const student = useSessionStore((state) => state.student);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [modules, setModules] = useState<LearningModule[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!student) return;
      void Promise.all([getAttempts(student.id), listModules(student.id)]).then(([nextAttempts, nextModules]) => {
        setAttempts(nextAttempts);
        setModules(nextModules);
      });
    }, [student]),
  );

  return (
    <Screen>
      <ScreenHeader title="My reports" subtitle="QR reports can be scanned without internet." />
      {attempts.length === 0 ? (
        <EmptyState title="No reports yet" body="Complete a quiz to create your first offline report." />
      ) : attempts.map((attempt) => {
        const module = modules.find((item) => item.id === attempt.moduleId);
        return (
          <Card key={attempt.id} accent={module ? subjectColor[module.subject] : colors.indigo}>
            <Text style={styles.cardTitle}>{module?.title ?? attempt.moduleId}</Text>
            <Text style={styles.body}>
              Score {attempt.score}/{attempt.totalItems} - {formatDuration(attempt.durationSeconds)}
            </Text>
            <PrimaryButton
              label="Open QR"
              tone="secondary"
              icon={QrCode}
              onPress={() => navigation.navigate('QuizReport', { moduleId: attempt.moduleId, attemptId: attempt.id })}
            />
          </Card>
        );
      })}
    </Screen>
  );
}

export function QuizReportScreen({ navigation, route }: StackProps<'QuizReport'>) {
  const student = useSessionStore((state) => state.student);
  const [payload, setPayload] = useState('');
  const [module, setModule] = useState<LearningModule | null>(null);

  useEffect(() => {
    if (!student) return;
    void Promise.all([
      getModule(route.params.moduleId),
      getAttempts(student.id, route.params.moduleId),
      getLearningProfile(student.id),
    ]).then(([nextModule, attempts, profile]) => {
      const attempt = attempts.find((item) => item.id === route.params.attemptId);
      if (!nextModule || !attempt) return;
      setModule(nextModule);
      setPayload(
        encodeQuizReportV2({
          student,
          module: nextModule,
          attempt,
          learningStyleTag: profile?.primaryStyle ?? 'balanced',
        }),
      );
    });
  }, [route.params.attemptId, route.params.moduleId, student]);

  return (
    <Screen>
      <ScreenHeader title="Offline quiz report" subtitle={module?.title ?? 'Preparing report'} onBack={navigation.goBack} />
      <Card style={styles.qrCard}>
        {payload ? <QRCode value={payload} size={260} ecl="L" /> : null}
      </Card>
      <Text style={styles.qrNote}>
        This QR includes the quiz score, total time, time per question, and learning-format tag. Show it only to the intended teacher.
      </Text>
    </Screen>
  );
}

export function StudentProfileScreen({ navigation }: StudentTabProps<'Profile'>) {
  const student = useSessionStore((state) => state.student);
  const mode = useSessionStore((state) => state.mode);
  const modeReason = useSessionStore((state) => state.modeReason);
  const canUseOnline = useSessionStore((state) => state.canUseOnlineEnhancements);
  const setMode = useSessionStore((state) => state.setMode);
  const signOut = useSessionStore((state) => state.signOut);
  const [guardianName, setGuardianName] = useState('');
  const [cloudAllowed, setCloudAllowed] = useState(false);
  const [diagnosticsAllowed, setDiagnosticsAllowed] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');

  useEffect(() => {
    if (!student) return;
    void getPrivacyConsent(student.id).then((consent) => {
      if (!consent) return;
      setGuardianName(consent.guardianName);
      setCloudAllowed(consent.cloudSyncAllowed);
      setDiagnosticsAllowed(consent.aiDiagnosticsAllowed);
    });
  }, [student]);

  if (!student) return null;

  async function saveCloudChoices() {
    if (!guardianName.trim()) {
      Alert.alert('Guardian confirmation needed', 'Enter the parent or guardian name before enabling cloud services.');
      return;
    }
    setSyncing(true);
    setSyncStatus('');
    try {
      await savePrivacyConsent({
        studentId: student!.id,
        noticeVersion: '2026-07',
        guardianName,
        guardianAcknowledgedAt: Date.now(),
        aiDiagnosticsAllowed: diagnosticsAllowed,
        cloudSyncAllowed: cloudAllowed,
      });
      if (!cloudAllowed) {
        setSyncStatus('Privacy choices saved. Learning records remain only on this device.');
        return;
      }
      const result = email.trim() && password
        ? await connectStudentCloudAccount(student!.id, email, password)
        : await syncStudentData(student!.id);
      setPassword('');
      setSyncStatus(`Cloud backup is current. ${result.synced} queued record(s) synced${result.failed ? `; ${result.failed} will retry` : ''}.`);
    } catch (error) {
      setSyncStatus(error instanceof Error ? error.message : 'Cloud backup could not finish.');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Profile" subtitle={student.studentNumber} />
      <Card>
        <Text style={styles.cardTitle}>{student.displayName}</Text>
        <ProfileLine label="Grade and section" value={`Grade ${student.gradeLevel} - ${student.section}`} />
        <ProfileLine label="Student number" value={student.studentNumber} />
      </Card>
      <Card>
        <View style={styles.cardTitleRow}>
          <CloudUpload size={23} color={colors.emerald} />
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>Optional cloud backup</Text>
            <Text style={styles.body}>A parent or guardian controls whether learning records leave this device.</Text>
          </View>
        </View>
        <TextInput
          value={guardianName}
          onChangeText={setGuardianName}
          style={styles.input}
          placeholder="Parent or guardian name"
          placeholderTextColor={colors.inkMuted}
        />
        <ConsentSwitch
          label="Back up learning profile and quiz results"
          value={cloudAllowed}
          onValueChange={setCloudAllowed}
        />
        <ConsentSwitch
          label="Allow de-identified AI diagnostics and enhanced voice"
          value={diagnosticsAllowed}
          onValueChange={setDiagnosticsAllowed}
        />
        {cloudAllowed ? (
          <>
            <TextInput
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="Provisioned student email"
              placeholderTextColor={colors.inkMuted}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              style={styles.input}
              secureTextEntry
              placeholder="Cloud account password"
              placeholderTextColor={colors.inkMuted}
            />
          </>
        ) : null}
        <PrimaryButton
          label={cloudAllowed ? 'Save and sync' : 'Save privacy choices'}
          icon={CloudUpload}
          loading={syncing}
          disabled={cloudAllowed && (mode !== 'full' || !canUseOnline)}
          onPress={() => void saveCloudChoices()}
        />
        {mode !== 'full' ? <Text style={styles.helper}>Cloud controls are paused in lightweight mode.</Text> : null}
        {syncStatus ? <Text style={styles.helper}>{syncStatus}</Text> : null}
      </Card>
      <Card>
        <View style={styles.cardTitleRow}>
          <Settings2 size={23} color={colors.indigo} />
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>Device mode</Text>
            <Text style={styles.body}>{modeReason}</Text>
          </View>
        </View>
        <View style={styles.segmented}>
          {(['lightweight', 'full'] as const).map((option) => (
            <Pressable
              key={option}
              style={[styles.segment, mode === option && styles.segmentActive]}
              onPress={() => void setMode(option)}
            >
              <Text style={[styles.segmentText, mode === option && styles.segmentTextActive]}>
                {option === 'lightweight' ? 'Offline light' : 'Full'}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>
      <PrimaryButton
        label="Receive a module"
        tone="secondary"
        icon={Download}
        onPress={() => navigation.navigate('ReceiveTransfer')}
      />
      <PrimaryButton
        label="Sign out"
        tone="danger"
        icon={LogOut}
        onPress={() => void signOut().then(() => navigation.getParent()?.navigate('Role'))}
      />
    </Screen>
  );
}

function ConsentSwitch({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange(value: boolean): void;
}) {
  return (
    <View style={styles.consentRow}>
      <Text style={styles.consentLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.outline, true: colors.emeraldTint }}
        thumbColor={value ? colors.emerald : colors.inkMuted}
      />
    </View>
  );
}

function ProfileLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.profileLine}>
      <Text style={styles.focusLabel}>{label}</Text>
      <Text style={styles.profileValue}>{value}</Text>
    </View>
  );
}

function capitalize(value: string): string {
  return value ? `${value[0]?.toLocaleUpperCase()}${value.slice(1)}` : value;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fixedHeader: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, gap: spacing.md },
  listContent: { padding: spacing.xl, gap: spacing.md, paddingBottom: 40 },
  chipRow: { gap: spacing.sm, paddingRight: spacing.xl },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  eyebrow: { color: colors.indigo, fontSize: 12, fontWeight: '900' },
  heroTitle: { color: colors.ink, fontSize: 24, lineHeight: 30, fontWeight: '900' },
  body: { color: colors.inkMuted, fontSize: 15, lineHeight: 22 },
  focusLabel: { color: colors.inkMuted, fontSize: 12, lineHeight: 17, fontWeight: '800' },
  focusValue: { color: colors.ink, fontSize: 16, lineHeight: 22, fontWeight: '800' },
  cardTitle: { color: colors.ink, fontSize: 19, lineHeight: 25, fontWeight: '800' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  moduleTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  moduleCode: { color: colors.inkMuted, fontSize: 12, fontWeight: '700' },
  styleTags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  styleTag: { color: colors.indigo, fontSize: 12, fontWeight: '800', backgroundColor: colors.indigoTint, padding: 6, borderRadius: radius.sm },
  readerText: { color: colors.ink, fontSize: 18, lineHeight: 30 },
  pdfFrame: { height: 560, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.outline },
  pdf: { flex: 1, backgroundColor: colors.surfaceMuted },
  progressTrack: { height: 8, borderRadius: radius.round, backgroundColor: colors.surfaceMuted, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.indigo },
  input: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surface,
    color: colors.ink,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
  },
  consentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  consentLabel: { flex: 1, color: colors.ink, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  timerLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  question: { color: colors.ink, fontSize: 21, lineHeight: 29, fontWeight: '800' },
  optionList: { gap: spacing.md },
  answerOption: {
    minHeight: 60,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  answerSelected: { borderColor: colors.indigo, backgroundColor: colors.indigoTint },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.outline },
  radioSelected: { borderWidth: 6, borderColor: colors.indigo },
  answerText: { flex: 1, color: colors.ink, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  score: { color: colors.ink, fontSize: 54, fontWeight: '900', textAlign: 'center' },
  scoreLabel: { color: colors.inkMuted, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  resultRow: { flexDirection: 'row', gap: spacing.xl, borderTopWidth: 1, borderTopColor: colors.outline, paddingTop: spacing.lg },
  flashcard: {
    minHeight: 340,
    borderRadius: radius.md,
    backgroundColor: colors.indigo,
    padding: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  flashcardBack: { backgroundColor: colors.emerald },
  flashcardLabel: { color: colors.white, fontSize: 12, fontWeight: '900' },
  flashcardText: { color: colors.white, fontSize: 30, lineHeight: 39, fontWeight: '900', textAlign: 'center' },
  helper: { color: colors.inkMuted, textAlign: 'center', fontSize: 13, lineHeight: 19 },
  ratingGrid: { flexDirection: 'row', gap: spacing.sm },
  rating: { flex: 1, minHeight: 70, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.outline, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  ratingNumber: { color: colors.indigo, fontSize: 20, fontWeight: '900' },
  ratingLabel: { color: colors.inkMuted, fontSize: 11, fontWeight: '800' },
  qrCard: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl },
  qrNote: { color: colors.inkMuted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  profileLine: { borderTopWidth: 1, borderTopColor: colors.outline, paddingTop: spacing.md, gap: spacing.xs },
  profileValue: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  segmented: { flexDirection: 'row', borderWidth: 1, borderColor: colors.outline, borderRadius: radius.md, overflow: 'hidden' },
  segment: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
  segmentActive: { backgroundColor: colors.indigo },
  segmentText: { color: colors.inkMuted, fontSize: 14, fontWeight: '800' },
  segmentTextActive: { color: colors.white },
});
