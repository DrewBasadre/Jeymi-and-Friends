import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  BookOpen,
  Brain,
  CircleStop,
  Clock3,
  Download,
  LogOut,
  Play,
  QrCode,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Settings2,
  Volume2,
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import {
  markdownToPlainText,
  ModuleMarkdown,
} from '@/components/ModuleMarkdown';
import {
  Card,
  CardHeader,
  Chip,
  EmptyState,
  IconButton,
  Metric,
  PrimaryButton,
  ProgressBar,
  Screen,
  ScreenHeader,
  SectionTitle,
  Skeleton,
  SkeletonCard,
  StatusBadge,
  useResponsiveColumns,
} from '@/components/ui';
import { Celebrate, MascotPanel } from '@/components/mascot';
import { PeacockMeter } from '@/components/PeacockMeter';
import { formatDeadline } from '@/utils/format';
import {
  getAttempts,
  getDueFlashcards,
  getLearningProfile,
  getModule,
  getQuestions,
  getStudentDashboard,
  listStudentTasks,
  listModules,
  markLessonRead,
  reviewFlashcard,
  submitQuiz,
} from '@/data/repository';
import {
  getAdaptiveFormatProfile,
  getEffectiveLearningFormat,
  setLearningFormatOverride,
} from '@/data/mvpRepository';
import { encodeProfileQr, encodeQuizReportParts } from '@/domain/qr';
import { formatSectionLabel } from '@/domain/section';
import {
  createInlineRecallForTerm,
  createInlineRecallFromSelection,
  isInlineRecallAnswerCorrect,
  type InlineRecallActivity,
} from '@/domain/inlineRecall';
import type {
  AdaptiveFormatProfile,
  DueFlashcard,
  FlashcardRating,
  LearningFormat,
  LearningModule,
  LearningProfile,
  QuestionResponse,
  QuizAttempt,
  QuizQuestion,
  StudentDashboard,
  StudentTask,
  Subject,
} from '@/domain/types';
import type {
  RootStackParamList,
  StudentTabParamList,
} from '@/navigation/types';
import { readModuleAloud, stopReading } from '@/services/speech';
import { useSessionStore } from '@/store/session';
import { colors, elevation, radius, spacing, subjectColor, text } from '@/theme/tokens';

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
  const [adaptive, setAdaptive] = useState<AdaptiveFormatProfile | null>(null);
  const [tasks, setTasks] = useState<StudentTask[]>([]);

  const load = useCallback(async () => {
    if (!student) return;
    const [nextDashboard, nextProfile, nextAdaptive, nextTasks] = await Promise.all([
      getStudentDashboard(student.id),
      getLearningProfile(student.id),
      getAdaptiveFormatProfile(student.id),
      listStudentTasks(student.id),
    ]);
    setDashboard(nextDashboard);
    setProfile(nextProfile);
    setAdaptive(nextAdaptive);
    setTasks(nextTasks);
  }, [student]);

  useFocusEffect(useCallback(() => void load(), [load]));

  if (!student) return <EmptyState title="No student profile" body="Sign in again to open your learning hub." />;
  const loading = !dashboard;
  const completed = dashboard?.completedModules ?? 0;
  const total = dashboard?.totalModules ?? 0;
  const openTasks = tasks.filter((task) => !task.completedAt).slice(0, 5);
  return (
    <Screen>
      <ScreenHeader
        overline="Welcome back"
        title={`Hi, ${student.firstName}!`}
        subtitle={formatSectionLabel(student.gradeLevel, student.section)}
        action={
          <StatusBadge
            label={mode === 'lightweight' ? 'Offline light' : 'Full mode'}
            status={mode === 'lightweight' ? 'inProgress' : 'completed'}
          />
        }
      />
      {loading ? (
        <SkeletonCard />
      ) : (
        <PeacockMeter
          completedModules={completed}
          totalModules={total}
          averageScore={dashboard?.averageScore ?? 0}
        />
      )}
      <Card accent={colors.secondary} tone={colors.secondaryTint}>
        <View style={styles.matchRow}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>LEARNING MATCH</Text>
            <Text style={styles.matchTitle}>
              {adaptive
                ? `${capitalize(adaptive.manualOverride ?? adaptive.currentDefaultFormat)} format`
                : profile
                  ? `${capitalize(profile.primaryStyle)} learning`
                  : 'Balanced learning'}
            </Text>
          </View>
          {total > 0 ? (
            <View style={styles.matchProgress}>
              <Text style={styles.heroProgressLabel}>{completed}/{total} modules</Text>
              <ProgressBar value={completed / total} height={8} />
            </View>
          ) : null}
        </View>
      </Card>
      {loading ? (
        <View style={styles.metricGrid}>
          <Skeleton width="47%" height={92} style={styles.metricSkeleton} />
          <Skeleton width="47%" height={92} style={styles.metricSkeleton} />
          <Skeleton width="47%" height={92} style={styles.metricSkeleton} />
          <Skeleton width="47%" height={92} style={styles.metricSkeleton} />
        </View>
      ) : (
        <View style={styles.metricGrid}>
          <Metric label="Modules done" value={`${completed}/${total}`} tint={colors.primaryTint} color={colors.primaryStrong} />
          <Metric label="Average score" value={`${dashboard?.averageScore ?? 0}%`} tint={colors.successTint} color={colors.success} />
          <Metric label="Cards due" value={dashboard?.dueFlashcards ?? 0} tint={colors.accentTint} color={colors.accentText} />
          <Metric label="Quiz attempts" value={dashboard?.totalAttempts ?? 0} tint={colors.secondaryTint} color={colors.secondary} />
        </View>
      )}
      <Card>
        <CardHeader icon={Clock3} title="Deadlines" color={colors.secondary} />
        {openTasks.length === 0 ? (
          <Text style={styles.body}>
            You're all caught up. Scan an assignment QR from your teacher to add tasks here.
          </Text>
        ) : (
          openTasks.map((task) => (
            <View key={task.taskId} style={styles.taskRow}>
              <View style={[styles.taskDot, { backgroundColor: task.type === 'module' ? colors.secondary : colors.accent }]} />
              <View style={styles.flex}>
                <Text style={styles.focusValue}>
                  {task.type === 'module' ? 'Module to read' : 'Quiz to take'}
                </Text>
                <Text style={styles.taskDue}>{formatDeadline(task.dueDate)}</Text>
              </View>
            </View>
          ))
        )}
      </Card>
      <Card>
        <CardHeader icon={Brain} title="Today's focus" color={colors.primary} />
        <View style={styles.focusRow}>
          <View style={styles.flex}>
            <Text style={styles.focusLabel}>Practice next</Text>
            {loading ? <Skeleton width="80%" height={18} /> : (
              <Text style={styles.focusValue} numberOfLines={2}>{dashboard?.weakTopic ?? 'No weak topic yet'}</Text>
            )}
          </View>
          <View style={styles.flex}>
            <Text style={styles.focusLabel}>Strong area</Text>
            {loading ? <Skeleton width="80%" height={18} /> : (
              <Text style={styles.focusValue} numberOfLines={2}>{dashboard?.strongTopic ?? 'Take a quiz to unlock'}</Text>
            )}
          </View>
        </View>
      </Card>
      <PrimaryButton
        label="Open study techniques"
        icon={Brain}
        onPress={() => navigation.navigate('ReviewHub')}
      />
      <PrimaryButton
        label="Open modules"
        tone="ghost"
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
  const columns = useResponsiveColumns();
  return (
    <Screen scroll={false} style={styles.flex}>
      <View style={styles.fixedHeader}>
        <ScreenHeader title="Modules" subtitle="Downloaded lessons stay available without internet." />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {(['ALL', 'SCIENCE', 'MATH', 'ENGLISH', 'ADDED_MATERIALS'] as const).map((subject) => (
            <Chip
              key={subject}
              label={subject === 'ADDED_MATERIALS' ? 'Added' : capitalize(subject.toLocaleLowerCase())}
              selected={filter === subject}
              color={subject === 'ALL' ? colors.primary : subjectColor[subject]}
              onPress={() => setFilter(subject)}
            />
          ))}
        </ScrollView>
      </View>
      <FlatList
        data={filtered}
        key={columns}
        numColumns={columns}
        keyExtractor={(module) => module.id}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
        renderItem={({ item }) => (
          <Pressable style={styles.moduleCell} onPress={() => navigation.navigate('ModuleReader', { moduleId: item.id })}>
            <Card accent={subjectColor[item.subject]} style={styles.moduleCard}>
              <View style={styles.moduleTop}>
                <Chip label={capitalize(item.subject.replace('_', ' ').toLocaleLowerCase())} color={subjectColor[item.subject]} selected />
                <Text style={styles.moduleCode}>{item.competencyCode}</Text>
              </View>
              <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.body} numberOfLines={3}>{item.summary}</Text>
              <View style={styles.styleTags}>
                {item.contentStyleTags.slice(0, 3).map((tag) => (
                  <Text key={tag} style={styles.styleTag}>{capitalize(tag)}</Text>
                ))}
              </View>
              <View style={styles.cardAction}>
                <Text style={styles.cardActionText}>Open lesson</Text>
                <ChevronRight size={18} color={colors.primary} />
              </View>
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={
          <EmptyState
            title="Waiting for your first lesson"
            body="Ask your teacher to send a module from their device, then scan the QR to add it here."
          />
        }
      />
    </Screen>
  );
}

export function ModuleReaderScreen({ navigation, route }: StackProps<'ModuleReader'>) {
  const student = useSessionStore((state) => state.student);
  const [module, setModule] = useState<LearningModule | null>(null);
  const [reading, setReading] = useState(false);
  const [recallActivity, setRecallActivity] =
    useState<InlineRecallActivity | null>(null);
  const [recallAnswer, setRecallAnswer] = useState('');
  const [recallResult, setRecallResult] =
    useState<'correct' | 'retry' | null>(null);
  const plainText = useMemo(
    () => (module ? markdownToPlainText(module.content) : ''),
    [module],
  );

  useEffect(() => {
    void getModule(route.params.moduleId).then(setModule);
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
    await readModuleAloud(plainText, {
      onDone: () => setReading(false),
      onError: () => setReading(false),
    }).catch((error) => Alert.alert('Read aloud', error.message));
  }

  async function finishLesson() {
    if (student) await markLessonRead(student.id, module!.id);
    const questions = await getQuestions(module!.id);
    if (questions.length === 0) {
      Alert.alert(
        'Lesson complete',
        'This module has no graded quiz yet. Your reading progress is saved.',
      );
      return;
    }
    navigation.navigate('Quiz', { moduleId: module!.id });
  }

  function openRecallActivity(activity: InlineRecallActivity | null) {
    if (!activity) {
      setRecallActivity(null);
      setRecallAnswer('');
      setRecallResult(null);
      return;
    }
    setRecallActivity(activity);
    setRecallAnswer('');
    setRecallResult(null);
  }

  function checkRecallAnswer() {
    if (!recallActivity || !recallAnswer.trim()) return;
    setRecallResult(
      isInlineRecallAnswerCorrect(recallActivity, recallAnswer)
        ? 'correct'
        : 'retry',
    );
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
      <Card accent={subjectColor[module.subject]}>
        <ModuleMarkdown
          markdown={module.content}
          moduleDirectoryUri={module.localAssetUri}
          onTaggedTermPress={(term) =>
            openRecallActivity(createInlineRecallForTerm(plainText, term))
          }
        />
      </Card>
      <Card accent={colors.accent}>
        <CardHeader
          icon={Brain}
          color={colors.accent}
          title="Inline recall"
          subtitle="Tap a highlighted term above, or select any phrase below to quiz yourself."
        />
        {recallActivity ? (
          <>
            <Text style={styles.question}>{recallActivity.prompt}</Text>
            <TextInput
              value={recallAnswer}
              onChangeText={(value) => {
                setRecallAnswer(value);
                setRecallResult(null);
              }}
              style={styles.input}
              placeholder="Fill in the blank"
              placeholderTextColor={colors.inkMuted}
            />
            <PrimaryButton
              label="Check answer"
              icon={CheckCircle2}
              disabled={!recallAnswer.trim()}
              onPress={checkRecallAnswer}
            />
            {recallResult ? (
              <Text
                style={
                  recallResult === 'correct'
                    ? styles.recallCorrect
                    : styles.recallRetry
                }
              >
                {recallResult === 'correct'
                  ? 'Correct. Nice retrieval.'
                  : 'Try again. The answer is in the sentence above.'}
              </Text>
            ) : null}
            <PrimaryButton
              label="Choose another phrase"
              tone="secondary"
              onPress={() => openRecallActivity(null)}
            />
          </>
        ) : (
          <TextInput
            value={plainText}
            editable
            multiline
            onChangeText={() => undefined}
            onSelectionChange={({ nativeEvent }) => {
              const { start, end } = nativeEvent.selection;
              if (end > start) {
                openRecallActivity(
                  createInlineRecallFromSelection(plainText, start, end),
                );
              }
            }}
            selectTextOnFocus={false}
            showSoftInputOnFocus={false}
            style={[styles.input, styles.recallSource]}
            textAlignVertical="top"
          />
        )}
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Try it your way</Text>
        <Text style={styles.body}>
          Explain one idea aloud, sketch it, write two sentences, or demonstrate it with nearby objects.
        </Text>
      </Card>
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
  const [learningFormat, setLearningFormat] =
    useState<LearningFormat>('text');
  const startedAt = useRef(Date.now());
  const questionStartedAt = useRef(Date.now());

  useEffect(() => {
    void Promise.all([getModule(route.params.moduleId), getQuestions(route.params.moduleId)]).then(
      ([nextModule, nextQuestions]) => {
        setModule(nextModule);
        setQuestions(nextQuestions);
      },
    );
    if (student) {
      void getEffectiveLearningFormat(student.id).then(setLearningFormat);
    }
  }, [route.params.moduleId, student]);

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
        learningFormatUsed: learningFormat,
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
        overline={`Question ${index + 1} of ${questions.length}`}
        title={module.title}
        onBack={navigation.goBack}
      />
      <ProgressBar value={(index + 1) / questions.length} />
      <View>
        <Text style={styles.formatLabel}>Show me this as</Text>
        <View style={styles.chipRow}>
          {(['text', 'audio', 'visual', 'kinesthetic'] as const).map((format) => (
            <Chip
              key={format}
              label={capitalize(format)}
              selected={learningFormat === format}
              onPress={() => setLearningFormat(format)}
            />
          ))}
        </View>
      </View>
      <Card accent={subjectColor[module.subject]}>
        <View style={styles.timerLine}>
          <Clock3 size={17} color={colors.inkMuted} />
          <Text style={styles.moduleCode}>Timing this question locally</Text>
        </View>
        <Text style={styles.question}>{question.questionText}</Text>
      </Card>
      <View style={styles.optionList}>
        {question.type === 'ENUMERATION' ? (
          <TextInput
            value={selected ?? ''}
            onChangeText={answer}
            style={styles.input}
            autoCapitalize="sentences"
            placeholder="Type your answer"
            placeholderTextColor={colors.inkMuted}
          />
        ) : (
          question.choices.map((choice) => {
            const isSelected = selected === choice;
            return (
              <Pressable
                key={choice}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                onPress={() => answer(choice)}
                style={[styles.answerOption, isSelected && styles.answerSelected]}
              >
                <View style={[styles.radio, isSelected && styles.radioSelected]}>
                  {isSelected ? <CheckCircle2 size={16} color={colors.white} /> : null}
                </View>
                <Text style={styles.answerText}>{choice}</Text>
              </Pressable>
            );
          })
        )}
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
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  useEffect(() => {
    void getQuestions(module.id).then(setQuestions);
  }, [module.id]);
  const percent = attempt.totalItems > 0 ? Math.round((attempt.score / attempt.totalItems) * 100) : 0;
  const great = percent >= 80;
  const good = percent >= 50;
  return (
    <Screen>
      {great ? <Celebrate trigger={1} /> : null}
      <MascotPanel
        expression={great ? 'happy' : 'encouraging'}
        title={great ? 'Amazing work!' : good ? 'Nice effort!' : "Let's practice more"}
        body={
          great
            ? "You've really got this. Keep the streak going."
            : good
              ? "You're getting there — review the misses below."
              : "Every attempt helps you learn. Take another look below."
        }
      />
      <Card accent={great ? colors.success : good ? colors.accent : colors.secondary}>
        <Text style={styles.score}>{attempt.score}/{attempt.totalItems}</Text>
        <Text style={styles.scoreLabel}>{percent}% · {capitalize(attempt.masteryLevel.toLocaleLowerCase())}</Text>
        <ProgressBar value={percent / 100} height={12} />
        <View style={styles.resultRow}>
          <View style={styles.flex}>
            <Text style={styles.focusLabel}>Strong topic</Text>
            <Text style={styles.focusValue} numberOfLines={2}>{attempt.strongTopic}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.focusLabel}>Practice next</Text>
            <Text style={styles.focusValue} numberOfLines={2}>{attempt.weakTopic}</Text>
          </View>
        </View>
        <Text style={styles.body}>
          {formatDuration(attempt.durationSeconds)} · Attempt {attempt.attemptNumber} · {capitalize(attempt.learningFormatUsed)}
        </Text>
      </Card>
      <SectionTitle>Question breakdown</SectionTitle>
      {attempt.responses.map((response, index) => {
        const question = questions.find((item) => item.id === response.questionId);
        return (
          <Card
            key={response.questionId}
            accent={response.isCorrect ? colors.success : colors.coral}
          >
            <View style={styles.breakdownTop}>
              <StatusBadge
                label={response.isCorrect ? 'Correct' : 'Review'}
                status={response.isCorrect ? 'completed' : 'inProgress'}
              />
              <Text style={styles.focusLabel}>Question {index + 1}</Text>
            </View>
            <Text style={styles.focusValue}>
              {question?.questionText ?? `Question ${index + 1}`}
            </Text>
            <Text style={styles.body}>Your answer: {response.answer}</Text>
            {!response.isCorrect ? (
              <Text style={styles.body}>
                Correct answer: {question?.correctAnswer ?? 'Review with your teacher'}
              </Text>
            ) : null}
          </Card>
        );
      })}
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
        <EmptyState
          expression="happy"
          title="You're all caught up!"
          body="Pavo will bring cards back right when they're most useful to review."
        />
      ) : (
        <>
          <ProgressBar value={(index + 1) / Math.max(cards.length, 1)} />
          <Pressable onPress={() => setRevealed((value) => !value)}>
            <View style={[styles.flashcard, revealed && styles.flashcardBack]}>
              <Text style={styles.flashcardLabel}>{revealed ? 'ANSWER' : 'PROMPT'}</Text>
              <Text style={styles.flashcardText}>{revealed ? card.back : card.front}</Text>
              <Text style={styles.flashcardHint}>{revealed ? 'How well did you remember?' : 'Tap to reveal'}</Text>
            </View>
          </Pressable>
          {revealed ? (
            <View style={styles.ratingGrid}>
              {([
                [0, 'Again', colors.coral],
                [2, 'Hard', colors.accent],
                [4, 'Good', colors.secondary],
                [5, 'Easy', colors.success],
              ] as const).map(([rating, label, tint]) => (
                <Pressable
                  key={rating}
                  accessibilityRole="button"
                  accessibilityLabel={`Rate ${label}`}
                  style={styles.rating}
                  onPress={() => void rate(rating)}
                >
                  <View style={[styles.ratingDot, { backgroundColor: tint }]} />
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
  const [payloads, setPayloads] = useState<string[]>([]);
  const [partIndex, setPartIndex] = useState(0);
  const [module, setModule] = useState<LearningModule | null>(null);

  useEffect(() => {
    if (!student) return;
    void Promise.all([
      getModule(route.params.moduleId),
      getAttempts(student.id, route.params.moduleId),
      getQuestions(route.params.moduleId),
    ]).then(([nextModule, attempts, questions]) => {
      const attempt = attempts.find((item) => item.id === route.params.attemptId);
      if (!nextModule || !attempt) return;
      setModule(nextModule);
      setPayloads(
        encodeQuizReportParts({
          student,
          module: nextModule,
          attempt,
          questions,
        }),
      );
    });
  }, [route.params.attemptId, route.params.moduleId, student]);

  return (
    <Screen>
      <ScreenHeader title="Offline quiz report" subtitle={module?.title ?? 'Preparing report'} onBack={navigation.goBack} />
      <Card style={styles.qrCard}>
        {payloads[partIndex] ? (
          <QRCode value={payloads[partIndex]} size={260} ecl="M" />
        ) : null}
      </Card>
      {payloads.length > 1 ? (
        <Card>
          <Text style={styles.focusValue}>
            QR {partIndex + 1} of {payloads.length}
          </Text>
          <View style={styles.resultRow}>
            <PrimaryButton
              label="Previous"
              icon={ChevronLeft}
              tone="secondary"
              disabled={partIndex === 0}
              onPress={() => setPartIndex((value) => Math.max(0, value - 1))}
            />
            <PrimaryButton
              label="Next"
              icon={ChevronRight}
              disabled={partIndex === payloads.length - 1}
              onPress={() =>
                setPartIndex((value) => Math.min(payloads.length - 1, value + 1))
              }
            />
          </View>
        </Card>
      ) : null}
      <Text style={styles.qrNote}>
        Scan every numbered QR. Correct-answer details are omitted; only missed answers and timing for every question are included.
      </Text>
    </Screen>
  );
}

export function StudentProfileScreen({ navigation }: StudentTabProps<'Profile'>) {
  const student = useSessionStore((state) => state.student);
  const mode = useSessionStore((state) => state.mode);
  const modeReason = useSessionStore((state) => state.modeReason);
  const setMode = useSessionStore((state) => state.setMode);
  const signOut = useSessionStore((state) => state.signOut);
  const [adaptive, setAdaptive] = useState<AdaptiveFormatProfile | null>(null);

  useEffect(() => {
    if (!student) return;
    void getAdaptiveFormatProfile(student.id).then(setAdaptive);
  }, [student]);

  if (!student) return null;
  const profilePayload = encodeProfileQr({
    student,
    currentLearningFormat:
      adaptive?.manualOverride ?? adaptive?.currentDefaultFormat ?? 'text',
  });

  return (
    <Screen>
      <ScreenHeader title="Profile" subtitle={student.studentNumber} />
      <Card>
        <Text style={styles.cardTitle}>{student.displayName}</Text>
        <ProfileLine
          label="Grade and section"
          value={formatSectionLabel(student.gradeLevel, student.section)}
        />
        <ProfileLine label="Student number" value={student.studentNumber} />
      </Card>
      <Card style={styles.qrCard}>
        <Text style={styles.cardTitle}>My profile QR</Text>
        <QRCode value={profilePayload} size={240} ecl="M" />
        <Text style={styles.qrNote}>
          Show this once to your teacher while your class section is active.
        </Text>
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Default learning format</Text>
        <Text style={styles.body}>
          Pavo recommends {adaptive?.currentDefaultFormat ?? 'text'} from recent completed work. Choose a default at any time.
        </Text>
        <View style={styles.chipRow}>
          {(['text', 'audio', 'visual', 'kinesthetic'] as const).map((format) => (
            <Chip
              key={format}
              label={capitalize(format)}
              selected={
                (adaptive?.manualOverride ?? adaptive?.currentDefaultFormat) ===
                format
              }
              onPress={() => {
                void setLearningFormatOverride(student.id, format).then(
                  setAdaptive,
                );
              }}
            />
          ))}
          <Chip
            label="Use recommendation"
            selected={adaptive?.manualOverride === null}
            onPress={() => {
              void setLearningFormatOverride(student.id, null).then(setAdaptive);
            }}
          />
        </View>
      </Card>
      <Card>
        <CardHeader icon={Settings2} title="Device mode" subtitle={modeReason} color={colors.primary} />
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
        label="Parent weekly digest"
        tone="ghost"
        onPress={() => navigation.navigate('ParentDigest')}
      />
      <PrimaryButton
        label="Receive a module"
        tone="ghost"
        icon={Download}
        onPress={() => navigation.navigate('ReceiveTransfer')}
      />
      <View style={styles.signOutRow}>
        <PrimaryButton
          label="Sign out"
          tone="danger"
          size="sm"
          icon={LogOut}
          onPress={() => void signOut().then(() => navigation.getParent()?.navigate('Role'))}
        />
      </View>
    </Screen>
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
  flex: { flex: 1, minWidth: 0 },
  fixedHeader: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, gap: spacing.md },
  listContent: { padding: spacing.xl, gap: spacing.md, paddingBottom: spacing.huge },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingRight: spacing.xl },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metricSkeleton: { borderRadius: radius.lg, flexGrow: 1 },
  eyebrow: { ...text.overline, color: colors.secondary },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  matchTitle: { ...text.title, color: colors.ink, marginTop: 2 },
  matchProgress: { width: 108, gap: spacing.xs },
  heroProgressLabel: { ...text.caption, color: colors.secondary, textAlign: 'right' },
  body: { ...text.body, color: colors.inkMuted, fontSize: 15 },
  focusRow: { flexDirection: 'row', gap: spacing.lg },
  focusLabel: { ...text.overline, color: colors.inkMuted, letterSpacing: 0.4 },
  focusValue: { ...text.bodyStrong, color: colors.ink, marginTop: 2 },
  cardTitle: { ...text.title, color: colors.ink },
  formatLabel: { ...text.caption, color: colors.inkMuted, marginBottom: spacing.sm },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
  taskDot: { width: 10, height: 10, borderRadius: radius.round },
  taskDue: { ...text.caption, color: colors.secondary, marginTop: 1 },
  moduleCell: { flex: 1 },
  moduleCard: { flex: 1 },
  gridRow: { gap: spacing.md },
  cardAction: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.outline,
  },
  cardActionText: { ...text.label, color: colors.primary, fontWeight: '800' },
  moduleTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  moduleCode: { ...text.caption, color: colors.inkMuted },
  styleTags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  styleTag: {
    ...text.caption,
    color: colors.primary,
    backgroundColor: colors.primaryTint,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  input: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surface,
    color: colors.ink,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
  },
  recallSource: {
    minHeight: 160,
    lineHeight: 24,
    backgroundColor: colors.surfaceMuted,
    paddingVertical: spacing.md,
  },
  recallCorrect: { color: colors.success, ...text.label, fontWeight: '800', textAlign: 'center' },
  recallRetry: { color: colors.coral, ...text.label, fontWeight: '800', textAlign: 'center' },
  timerLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  question: { ...text.h2, color: colors.ink, fontSize: 21, lineHeight: 29 },
  optionList: { gap: spacing.md },
  answerOption: {
    minHeight: 60,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.outline,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  answerSelected: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  radio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.outlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  answerText: { flex: 1, color: colors.ink, ...text.bodyStrong },
  score: { color: colors.ink, fontSize: 52, lineHeight: 58, fontWeight: '800', textAlign: 'center' },
  scoreLabel: { color: colors.inkMuted, ...text.title, textAlign: 'center' },
  resultRow: { flexDirection: 'row', gap: spacing.xl, borderTopWidth: 1, borderTopColor: colors.outline, paddingTop: spacing.lg },
  breakdownTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  flashcard: {
    minHeight: 320,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    padding: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    ...elevation.e2,
  },
  flashcardBack: { backgroundColor: colors.secondary },
  flashcardLabel: { ...text.overline, color: colors.white, opacity: 0.85 },
  flashcardText: { color: colors.white, fontSize: 30, lineHeight: 39, fontWeight: '800', textAlign: 'center' },
  flashcardHint: { color: colors.white, opacity: 0.85, textAlign: 'center', ...text.caption },
  ratingGrid: { flexDirection: 'row', gap: spacing.sm },
  rating: {
    flex: 1,
    minHeight: 74,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingDot: { width: 16, height: 16, borderRadius: radius.round },
  ratingLabel: { color: colors.ink, ...text.label, fontWeight: '800' },
  qrCard: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl, gap: spacing.lg },
  qrNote: { color: colors.inkMuted, ...text.label, textAlign: 'center' },
  profileLine: { borderTopWidth: 1, borderTopColor: colors.outline, paddingTop: spacing.md, gap: spacing.xs },
  profileValue: { color: colors.ink, ...text.bodyStrong },
  segmented: { flexDirection: 'row', borderWidth: 1, borderColor: colors.outline, borderRadius: radius.md, overflow: 'hidden' },
  segment: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { color: colors.inkMuted, ...text.label, fontWeight: '800' },
  segmentTextActive: { color: colors.white },
  signOutRow: { marginTop: spacing.sm, alignItems: 'center' },
});
