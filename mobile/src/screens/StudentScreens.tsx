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
  Chip,
  EmptyState,
  IconButton,
  PrimaryButton,
  Screen,
  ScreenHeader,
  SectionTitle,
} from '@/components/ui';
import { ParentPinPrompt } from '@/components/ParentPinPrompt';
import { MascotNote } from '@/components/MascotNote';
import { MiniBarChart, ProgressBar } from '@/components/ProgressCharts';
import {
  getAttempts,
  getDueFlashcards,
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
import {
  dashboardMascotMessage,
  quizMascotMessage,
} from '@/domain/motivation';
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
  const [tasks, setTasks] = useState<StudentTask[]>([]);

  const load = useCallback(async () => {
    if (!student) return;
    const [nextDashboard, nextTasks] = await Promise.all([
      getStudentDashboard(student.id),
      listStudentTasks(student.id),
    ]);
    setDashboard(nextDashboard);
    setTasks(nextTasks);
  }, [student]);

  useFocusEffect(useCallback(() => void load(), [load]));

  if (!student) return <EmptyState title="No student profile" body="Sign in again to open your learning hub." />;
  const openTasks = tasks
    .filter((task) => !task.completedAt)
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate));
  const nearestTask = openTasks[0];
  const todayFocus =
    (dashboard?.dueReviews ?? 0) > 0
      ? `Review ${dashboard!.dueReviews} due item${dashboard!.dueReviews === 1 ? '' : 's'} in Study.`
      : nearestTask
        ? `Complete ${nearestTask.targetId} before ${formatShortDate(nearestTask.dueDate)}.`
        : dashboard?.weakTopic && dashboard.weakTopic !== 'No weak topic yet'
          ? `Practice ${dashboard.weakTopic} in the next module quiz.`
          : 'Open the next module in your grade library.';
  return (
    <Screen>
      <ScreenHeader
        title={`Hi, ${student.firstName}`}
        subtitle={formatSectionLabel(student.gradeLevel, student.section)}
        action={<Chip label={mode === 'lightweight' ? 'Offline light' : 'Full mode'} color={colors.emerald} selected />}
      />
      {dashboard ? (
        <MascotNote message={dashboardMascotMessage(dashboard)} />
      ) : null}
      <Card accent={colors.amber}>
        <Text style={styles.cardTitle}>Today&apos;s focus</Text>
        <Text style={styles.focusValue}>{todayFocus}</Text>
        <View style={styles.dashboardRow}>
          <View style={styles.dashboardStat}>
            <Text style={styles.dashboardValue}>{dashboard?.dueReviews ?? 0}</Text>
            <Text style={styles.focusLabel}>Reviews due</Text>
          </View>
          <View style={styles.dashboardStat}>
            <Text style={styles.dashboardValue}>{dashboard?.quizAttemptsToday ?? 0}</Text>
            <Text style={styles.focusLabel}>Quizzes today</Text>
          </View>
          <View style={styles.dashboardStat}>
            <Text style={styles.dashboardValue}>{openTasks.length}</Text>
            <Text style={styles.focusLabel}>Open deadlines</Text>
          </View>
        </View>
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Deadlines</Text>
        {openTasks.length === 0 ? (
          <Text style={styles.body}>
            Scan an assignment QR from your teacher to add tasks here.
          </Text>
        ) : (
          openTasks
            .slice(0, 5)
            .map((task) => (
              <View key={task.taskId} style={styles.profileLine}>
                <View style={styles.rowBetween}>
                  <Text style={styles.focusValue}>{task.targetId}</Text>
                  <Text style={styles.focusLabel}>
                    {formatShortDate(task.dueDate)}
                  </Text>
                </View>
                <ProgressBar
                  color={deadlineColor(task.dueDate)}
                  value={deadlineProgress(task)}
                />
                <Text style={styles.focusLabel}>
                  {task.type === 'module' ? 'Module' : 'Quiz'} deadline
                </Text>
              </View>
            ))
        )}
      </Card>
      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Module completion</Text>
          <Text style={styles.progressValue}>
            {dashboard?.completedModules ?? 0}/{dashboard?.totalModules ?? 0}
          </Text>
        </View>
        <ProgressBar value={dashboard?.moduleCompletionPercentage ?? 0} />
        <Text style={styles.body}>
          {dashboard?.moduleCompletionPercentage ?? 0}% of the offline grade library completed
        </Text>
      </Card>
      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Quiz attempts</Text>
          <Chip label={`${dashboard?.totalAttempts ?? 0} total`} />
        </View>
        <MiniBarChart
          color={colors.coral}
          emptyLabel="No quizzes in the last seven days"
          points={(dashboard?.quizAttemptsByDay ?? []).map((point) => ({
            label: shortWeekday(point.date),
            value: point.count,
          }))}
        />
      </Card>
      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Average score trend</Text>
          <Chip label={`${Math.round(dashboard?.averageScore ?? 0)}% overall`} color={colors.emerald} />
        </View>
        <MiniBarChart
          color={colors.emerald}
          emptyLabel="Complete a quiz to begin the score trend"
          suffix="%"
          points={(dashboard?.averageScoreTrend ?? []).map((point) => ({
            label: shortWeekday(point.date),
            value: point.averageScorePercentage,
          }))}
        />
      </Card>
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
        ListEmptyComponent={
          <EmptyState
            title="Preparing your offline library"
            body="Sign in again to retry the bundled Grade-level lesson setup."
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
      <Card accent={colors.amber}>
        <View style={styles.cardTitleRow}>
          <Brain size={23} color={colors.amber} />
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>Inline recall</Text>
            <Text style={styles.body}>
              Tap a highlighted term above, or select a phrase below.
            </Text>
          </View>
        </View>
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
        title={module.title}
        subtitle={`Question ${index + 1} of ${questions.length}`}
        onBack={navigation.goBack}
      />
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${((index + 1) / questions.length) * 100}%` }]} />
      </View>
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
      <Card accent={subjectColor[module.subject]}>
        <View style={styles.timerLine}>
          <Clock3 size={17} color={colors.inkMuted} />
          <Text style={styles.moduleCode}>Timing this question locally</Text>
        </View>
        <Text style={styles.question}>{question.questionText}</Text>
      </Card>
      <View style={styles.optionList}>
        {question.type !== 'MULTIPLE_CHOICE' ? (
          <TextInput
            value={selected ?? ''}
            onChangeText={answer}
            style={styles.input}
            autoCapitalize="sentences"
            placeholder={
              question.type === 'FILL_IN_THE_BLANK'
                ? 'Complete the missing word or phrase'
                : 'Type your answer'
            }
            placeholderTextColor={colors.inkMuted}
          />
        ) : (
          question.choices.map((choice) => (
            <Pressable
              key={choice}
              onPress={() => answer(choice)}
              style={[
                styles.answerOption,
                selected === choice && styles.answerSelected,
              ]}
            >
              <View
                style={[
                  styles.radio,
                  selected === choice && styles.radioSelected,
                ]}
              />
              <Text style={styles.answerText}>{choice}</Text>
            </Pressable>
          ))
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
        <Text style={styles.body}>
          Time: {formatDuration(attempt.durationSeconds)} - Attempt {attempt.attemptNumber} - {capitalize(attempt.learningFormatUsed)}
        </Text>
      </Card>
      <MascotNote
        message={quizMascotMessage({
          correct: attempt.score,
          total: attempt.totalItems,
          attemptNumber: attempt.attemptNumber,
        })}
      />
      <SectionTitle>Question breakdown</SectionTitle>
      {attempt.responses.map((response, index) => {
        const question = questions.find((item) => item.id === response.questionId);
        return (
          <Card
            key={response.questionId}
            accent={response.isCorrect ? colors.emerald : colors.coral}
          >
            <Text style={styles.focusLabel}>Question {index + 1}</Text>
            <Text style={styles.focusValue}>
              {question?.questionText ?? response.questionId}
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
                [0, 'Again'],
                [2, 'Hard'],
                [4, 'Good'],
                [5, 'Easy'],
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
  const [pendingFormat, setPendingFormat] = useState<
    LearningFormat | null | undefined
  >(undefined);

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
          WAIS recommends {adaptive?.currentDefaultFormat ?? 'text'} from
          recent completed work. A parent PIN is required to change this visible
          default.
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
              onPress={() => setPendingFormat(format)}
            />
          ))}
          <Chip
            label="Use recommendation"
            selected={adaptive?.manualOverride === null}
            onPress={() => setPendingFormat(null)}
          />
        </View>
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
        label="Parent weekly digest"
        tone="secondary"
        onPress={() => navigation.navigate('ParentDigest')}
      />
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
      <ParentPinPrompt
        studentId={student.id}
        visible={pendingFormat !== undefined}
        purpose="Changing the learner's default lesson format requires a parent or guardian."
        onAuthorized={() => {
          const nextFormat = pendingFormat;
          setPendingFormat(undefined);
          if (nextFormat !== undefined) {
            void setLearningFormatOverride(student.id, nextFormat).then(
              setAdaptive,
            );
          }
        }}
        onCancel={() => setPendingFormat(undefined)}
      />
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

function shortWeekday(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
  });
}

function formatShortDate(value: string): string {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function deadlineProgress(task: StudentTask): number {
  const issued = Date.parse(task.issuedAt);
  const due = Date.parse(`${task.dueDate}T23:59:59`);
  if (!Number.isFinite(issued) || due <= issued) return 100;
  return Math.round(
    Math.max(0, Math.min(1, (Date.now() - issued) / (due - issued))) * 100,
  );
}

function deadlineColor(value: string): string {
  const daysLeft = Math.ceil(
    (Date.parse(`${value}T23:59:59`) - Date.now()) / 86_400_000,
  );
  if (daysLeft <= 2) return colors.coral;
  if (daysLeft <= 5) return colors.amber;
  return colors.indigo;
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingRight: spacing.xl,
  },
  dashboardRow: { flexDirection: 'row', gap: spacing.sm },
  dashboardStat: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
    padding: spacing.md,
  },
  dashboardValue: { color: colors.ink, fontSize: 24, fontWeight: '900' },
  rowBetween: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  progressValue: { color: colors.indigo, fontSize: 16, fontWeight: '900' },
  body: { color: colors.inkMuted, fontSize: 15, lineHeight: 22 },
  focusLabel: { color: colors.inkMuted, fontSize: 12, lineHeight: 17, fontWeight: '800' },
  focusValue: { color: colors.ink, fontSize: 16, lineHeight: 22, fontWeight: '800' },
  cardTitle: { color: colors.ink, fontSize: 19, lineHeight: 25, fontWeight: '800' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  moduleTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  moduleCode: { color: colors.inkMuted, fontSize: 12, fontWeight: '700' },
  styleTags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  styleTag: { color: colors.indigo, fontSize: 12, fontWeight: '800', backgroundColor: colors.indigoTint, padding: 6, borderRadius: radius.sm },
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
  recallSource: {
    minHeight: 180,
    lineHeight: 24,
    paddingVertical: spacing.md,
  },
  recallCorrect: {
    color: colors.emerald,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  recallRetry: {
    color: colors.coral,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
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
