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
  CalendarClock,
  CircleStop,
  Clock3,
  Download,
  Flame,
  Layers,
  PackageOpen,
  LogOut,
  Play,
  QrCode,
  ScanLine,
  Sparkles,
  Target,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Settings2,
  Trophy,
  Volume2,
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import {
  markdownToPlainText,
  ModuleMarkdown,
} from '@/components/ModuleMarkdown';
import {
  Callout,
  Card,
  CardHeader,
  Chip,
  Divider,
  EmptyState,
  IconButton,
  IconPlate,
  ListRow,
  PressableScale,
  PrimaryButton,
  ProgressBar,
  Screen,
  ScreenHeader,
  SectionHeader,
  SegmentedControl,
  Skeleton,
  SkeletonCard,
  StatTile,
  TileGrid,
  StatusBadge,
} from '@/components/ui';
import { ParentPinPrompt } from '@/components/ParentPinPrompt';
import { MascotNote } from '@/components/MascotNote';
import { MiniBarChart } from '@/components/ProgressCharts';
import { Celebrate, MascotPanel } from '@/components/mascot';
import { LearnerHero } from '@/components/LearnerHero';
import { MilestoneStrip } from '@/components/Milestones';
import { formatDate, formatDeadline } from '@/utils/format';
import {
  getAttempts,
  getDueFlashcards,
  getModule,
  getQuestions,
  getQuizAttemptLogs,
  getStudentDashboard,
  listStudentTasks,
  listModules,
  markLessonRead,
  reviewFlashcard,
  submitQuiz,
} from '@/data/repository';
import { listLearningPackages } from '@/data/learningRepository';
import { teacherQuizModuleId } from '@/services/learningPackages';
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
  QuizAttemptLog,
  QuizQuestion,
  StudentDashboard,
  StudentTask,
  StoredLearningPackage,
  Subject,
} from '@/domain/types';
import type {
  RootStackParamList,
  StudentTabParamList,
} from '@/navigation/types';
import { readModuleAloud, stopReading } from '@/services/speech';
import { ensureDeviceIdentity } from '@/services/deviceIdentity';
import { useSessionStore } from '@/store/session';
import {
  colors,
  elevation,
  layout,
  radius,
  spacing,
  subjectColor,
  subjectTint,
  text,
} from '@/theme/tokens';

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

  if (!student)
    return <EmptyState title="No student profile" body="Sign in again to open your learning hub." />;

  const loading = !dashboard;
  const completed = dashboard?.completedModules ?? 0;
  const total = dashboard?.totalModules ?? 0;
  const due = dashboard?.dueReviews ?? 0;
  const attempts = dashboard?.totalAttempts ?? 0;
  const average = dashboard?.averageScore ?? 0;
  const openTasks = tasks
    .filter((task) => !task.completedAt)
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate))
    .slice(0, 4);
  const nearestTask = openTasks[0];
  const todayFocus =
    due > 0
      ? `Review ${due} due item${due === 1 ? '' : 's'} in Study.`
      : nearestTask
        ? `Complete ${nearestTask.targetId} before ${formatShortDate(nearestTask.dueDate)}.`
        : dashboard?.weakTopic && dashboard.weakTopic !== 'No weak topic yet'
          ? `Practice ${dashboard.weakTopic} in the next module quiz.`
          : 'Open the next module in your grade library.';

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
        <LearnerHero
          completedModules={completed}
          totalModules={total}
          averageScore={average}
          totalAttempts={attempts}
          dueFlashcards={due}
        />
      )}

      {dashboard ? (
        <MascotNote message={dashboardMascotMessage(dashboard)} />
      ) : null}

      <Card accent={colors.accent}>
        <CardHeader
          icon={Sparkles}
          title="Today's focus"
          subtitle="One useful next step from your local progress"
          color={colors.accentText}
        />
        <Text style={styles.focusValue}>{todayFocus}</Text>
        <TileGrid>
          <StatTile
            icon={Brain}
            label="Reviews due"
            value={due}
            color={colors.primary}
          />
          <StatTile
            icon={Flame}
            label="Quizzes today"
            value={dashboard?.quizAttemptsToday ?? 0}
            color={colors.secondary}
          />
          <StatTile
            icon={CalendarClock}
            label="Deadlines"
            value={openTasks.length}
            color={colors.accentText}
          />
        </TileGrid>
      </Card>

      <Card>
        <CardHeader
          icon={CalendarClock}
          title="Deadlines"
          subtitle={
            openTasks.length > 0
              ? `${openTasks.length} open ${openTasks.length === 1 ? 'task' : 'tasks'}`
              : 'Nothing due'
          }
          color={colors.secondary}
        />
        {openTasks.length === 0 ? (
          <Text style={styles.body}>
            You're all caught up. Scan an assignment QR from your teacher to add tasks here.
          </Text>
        ) : (
          openTasks.map((task, index) => (
            <View key={task.taskId}>
              {index > 0 ? <Divider style={styles.rowDivider} /> : null}
              <View style={styles.taskRow}>
                <IconPlate
                  icon={task.type === 'module' ? BookOpen : Target}
                  color={task.type === 'module' ? colors.secondary : colors.accentText}
                  size={34}
                />
                <View style={styles.flex}>
                  <Text style={styles.focusValue}>
                    {task.type === 'module' ? 'Module to read' : 'Quiz to take'}
                  </Text>
                  <Text style={styles.taskDue}>{formatDeadline(task.dueDate)}</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </Card>

      <Card>
        <CardHeader
          icon={BookOpen}
          title="Module completion"
          subtitle={`${dashboard?.moduleCompletionPercentage ?? 0}% of the offline grade library completed`}
          color={colors.primary}
        />
        <View style={styles.spaceBetween}>
          <Text style={styles.focusLabel}>Course progress</Text>
          <Text style={styles.progressValue}>
            {completed} of {total}
          </Text>
        </View>
        {total > 0 ? (
          <ProgressBar value={completed / total} height={8} />
        ) : null}
      </Card>

      <SectionHeader title="Activity trends" caption="The last seven days on this device" />
      <Card>
        <CardHeader
          icon={Flame}
          title="Quiz attempts"
          subtitle={`${attempts} total attempts`}
          color={colors.accentText}
        />
        <MiniBarChart
          color={colors.accentText}
          emptyLabel="No quizzes in the last seven days"
          points={(dashboard?.quizAttemptsByDay ?? []).map((point) => ({
            label: shortWeekday(point.date),
            value: point.count,
          }))}
        />
      </Card>
      <Card>
        <CardHeader
          icon={TrendingUp}
          title="Average score trend"
          subtitle={`${Math.round(average)}% overall`}
          color={colors.success}
        />
        <MiniBarChart
          color={colors.success}
          emptyLabel="Complete a quiz to begin the score trend"
          suffix="%"
          points={(dashboard?.averageScoreTrend ?? []).map((point) => ({
            label: shortWeekday(point.date),
            value: point.averageScorePercentage,
          }))}
        />
      </Card>

      <SectionHeader title="Milestones" caption="Earned from work you've actually done" />
      <MilestoneStrip
        completedModules={completed}
        totalModules={total}
        averageScore={average}
        totalAttempts={attempts}
        dueFlashcards={due}
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
    <Screen scroll={false} padded={false} style={styles.flex}>
      <View style={styles.fixedHeader}>
        <ScreenHeader
          overline="Library"
          title="Modules"
          subtitle="Downloaded lessons stay available without internet."
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {(['ALL', 'SCIENCE', 'MATH', 'ENGLISH', 'ADDED_MATERIALS'] as const).map((subject) => (
            <Chip
              key={subject}
              label={subject === 'ADDED_MATERIALS' ? 'Teacher' : capitalize(subject.toLocaleLowerCase())}
              selected={filter === subject}
              color={subject === 'ALL' ? colors.primary : subjectColor[subject]}
              onPress={() => setFilter(subject)}
            />
          ))}
        </ScrollView>
      </View>
      <FlatList
        data={filtered}
        numColumns={1}
        keyExtractor={(module) => module.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <PressableScale
            style={styles.moduleCell}
            accessibilityLabel={`${item.title}. ${item.competencyCode}`}
            accessibilityHint="Opens the lesson"
            onPress={() => navigation.navigate('ModuleReader', { moduleId: item.id })}
          >
            <View style={styles.moduleCard}>
              <View
                style={[styles.moduleSpine, { backgroundColor: subjectColor[item.subject] }]}
              />
              <View style={styles.moduleBody}>
                <View style={styles.moduleTop}>
                  <View
                    style={[styles.subjectTag, { backgroundColor: subjectTint[item.subject] }]}
                  >
                    <Text style={[styles.subjectTagText, { color: subjectColor[item.subject] }]}>
                      {capitalize(item.subject.replace('_', ' ').toLocaleLowerCase())}
                    </Text>
                  </View>
                </View>
                <Text style={styles.moduleTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.moduleCode} numberOfLines={1}>
                  {item.competencyCode}
                </Text>
                <Text style={styles.moduleSummary} numberOfLines={3}>
                  {item.summary}
                </Text>
                <View style={styles.styleTags}>
                  {item.contentStyleTags.slice(0, 3).map((tag) => (
                    <Text key={tag} style={styles.styleTag}>
                      {capitalize(tag)}
                    </Text>
                  ))}
                </View>
                <View style={styles.cardAction}>
                  <Text style={styles.cardActionText}>Open lesson</Text>
                  <ChevronRight size={18} color={colors.primary} />
                </View>
              </View>
            </View>
          </PressableScale>
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
    return (
      <Screen>
        <ScreenHeader title="Opening module…" onBack={navigation.goBack} />
        <SkeletonCard />
        <SkeletonCard />
      </Screen>
    );
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
        overline={capitalize(module.subject.replace('_', ' ').toLocaleLowerCase())}
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
      <Card>
        <CardHeader
          icon={Brain}
          color={colors.accentText}
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
              placeholderTextColor={colors.inkSubtle}
              selectionColor={colors.primary}
            />
            <PrimaryButton
              label="Check answer"
              icon={CheckCircle2}
              disabled={!recallAnswer.trim()}
              onPress={checkRecallAnswer}
            />
            {recallResult ? (
              <Callout
                tone={recallResult === 'correct' ? 'success' : 'warning'}
                icon={recallResult === 'correct' ? CheckCircle2 : Target}
                title={recallResult === 'correct' ? 'Correct. Nice retrieval.' : 'Not quite — try again.'}
                body={
                  recallResult === 'correct'
                    ? 'Retrieving an answer from memory is what makes it stick.'
                    : 'The answer is in the sentence above.'
                }
              />
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
      <Card tone={colors.primaryTint}>
        <CardHeader icon={Sparkles} title="Try it your way" color={colors.primary} />
        <Text style={styles.body}>
          Explain one idea aloud, sketch it, write two sentences, or demonstrate it with nearby objects.
        </Text>
      </Card>
      <PrimaryButton label="Lesson read — start quiz" icon={Play} onPress={() => void finishLesson()} />
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
    return (
      <Screen>
        <ScreenHeader title="Preparing quiz…" onBack={navigation.goBack} />
        <SkeletonCard />
      </Screen>
    );
  }
  return (
    <Screen>
      <ScreenHeader
        overline={`Question ${index + 1} of ${questions.length}`}
        title={module.title}
        onBack={navigation.goBack}
      />
      <View style={styles.quizProgress}>
        <ProgressBar
          value={(index + 1) / questions.length}
          accessibilityLabel={`Question ${index + 1} of ${questions.length}`}
        />
        <View style={styles.stepDots}>
          {questions.map((item, dotIndex) => (
            <View
              key={item.id}
              style={[
                styles.stepDot,
                dotIndex < index && styles.stepDotDone,
                dotIndex === index && styles.stepDotActive,
              ]}
            />
          ))}
        </View>
      </View>

      <View>
        <Text style={styles.formatLabel}>Show me this as</Text>
        <View style={styles.chipRow}>
          {(['text', 'audio', 'visual', 'kinesthetic'] as const).map((format) => (
            <Chip
              key={format}
              label={capitalize(format)}
              size="sm"
              selected={learningFormat === format}
              onPress={() => setLearningFormat(format)}
            />
          ))}
        </View>
      </View>

      <Card accent={subjectColor[module.subject]}>
        <View style={styles.timerLine}>
          <Clock3 size={15} color={colors.inkSubtle} />
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
            placeholderTextColor={colors.inkSubtle}
            selectionColor={colors.primary}
          />
        ) : (
          question.choices.map((choice, choiceIndex) => {
            const isSelected = selected === choice;
            return (
              <Pressable
                key={choice}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                onPress={() => answer(choice)}
                style={({ pressed }) => [
                  styles.answerOption,
                  isSelected && styles.answerSelected,
                  pressed && !isSelected && styles.answerPressed,
                ]}
              >
                <View style={[styles.optionKey, isSelected && styles.optionKeySelected]}>
                  {isSelected ? (
                    <CheckCircle2 size={17} color={colors.white} />
                  ) : (
                    <Text style={styles.optionKeyText}>
                      {String.fromCharCode(65 + choiceIndex)}
                    </Text>
                  )}
                </View>
                <Text style={styles.answerText}>{choice}</Text>
              </Pressable>
            );
          })
        )}
      </View>

      <PrimaryButton
        label={index === questions.length - 1 ? 'Submit quiz' : 'Next question'}
        icon={index === questions.length - 1 ? CheckCircle2 : ChevronRight}
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
  const accent = great ? colors.success : good ? colors.accentText : colors.secondary;
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
              : 'Every attempt helps you learn. Take another look below.'
        }
      />

      <Card>
        <View style={styles.scoreRow}>
          <View style={styles.scoreBlock}>
            <Text style={[styles.score, { color: accent }]}>{percent}%</Text>
            <Text style={styles.scoreLabel}>
              {attempt.score} of {attempt.totalItems} correct
            </Text>
          </View>
          <View style={styles.masteryPill}>
            <Trophy size={15} color={colors.accentText} />
            <Text style={styles.masteryText}>
              {capitalize(attempt.masteryLevel.toLocaleLowerCase())}
            </Text>
          </View>
        </View>
        <ProgressBar value={percent / 100} height={12} accessibilityLabel={`Score ${percent} percent`} />
        <View style={styles.focusRow}>
          <View style={[styles.focusPanel, { backgroundColor: colors.successTint }]}>
            <Text style={styles.focusLabel}>Strong topic</Text>
            <Text style={styles.focusValue} numberOfLines={2}>
              {attempt.strongTopic}
            </Text>
          </View>
          <View style={[styles.focusPanel, { backgroundColor: colors.warningTint }]}>
            <Text style={styles.focusLabel}>Practice next</Text>
            <Text style={styles.focusValue} numberOfLines={2}>
              {attempt.weakTopic}
            </Text>
          </View>
        </View>
        <Divider />
        <View style={styles.metaRow}>
          <MetaItem label="Time" value={formatDuration(attempt.durationSeconds)} />
          <MetaItem label="Attempt" value={`#${attempt.attemptNumber}`} />
          <MetaItem label="Format" value={capitalize(attempt.learningFormatUsed)} />
        </View>
      </Card>
      <MascotNote
        message={quizMascotMessage({
          correct: attempt.score,
          total: attempt.totalItems,
          attemptNumber: attempt.attemptNumber,
        })}
      />

      <SectionHeader title="Question breakdown" caption="What to revisit before the next attempt" />
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
              <Text style={styles.correctAnswer}>
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

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.focusLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
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
        overline="Spaced repetition"
        title="Flashcard review"
        subtitle={card ? `${index + 1} of ${cards.length} due` : 'Cards return right when they help most'}
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
          <ProgressBar
            value={(index + 1) / Math.max(cards.length, 1)}
            accessibilityLabel={`Card ${index + 1} of ${cards.length}`}
          />
          <PressableScale onPress={() => setRevealed((value) => !value)}>
            <View style={[styles.flashcard, revealed && styles.flashcardBack]}>
              <View style={styles.flashcardTag}>
                <Text style={styles.flashcardLabel}>{revealed ? 'ANSWER' : 'PROMPT'}</Text>
              </View>
              <Text style={styles.flashcardText} numberOfLines={6} adjustsFontSizeToFit minimumFontScale={0.6}>
                {revealed ? card.back : card.front}
              </Text>
              <Text style={styles.flashcardHint}>
                {revealed ? 'How well did you remember?' : 'Tap to reveal'}
              </Text>
            </View>
          </PressableScale>
          {revealed ? (
            <View style={styles.ratingGrid}>
              {(
                [
                  [0, 'Again', colors.coral],
                  [2, 'Hard', colors.accent],
                  [4, 'Good', colors.secondary],
                  [5, 'Easy', colors.success],
                ] as const
              ).map(([rating, label, tint]) => (
                <Pressable
                  key={rating}
                  accessibilityRole="button"
                  accessibilityLabel={`Rate ${label}`}
                  style={({ pressed }) => [styles.rating, pressed && styles.answerPressed]}
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
  const [teacherQuizzes, setTeacherQuizzes] = useState<
    StoredLearningPackage[]
  >([]);

  useFocusEffect(
    useCallback(() => {
      if (!student) return;
      void Promise.all([
        getAttempts(student.id),
        listModules(student.id),
        listLearningPackages(`student:${student.id}`, 'teacherQuiz'),
      ]).then(([nextAttempts, nextModules, nextTeacherQuizzes]) => {
        setAttempts(nextAttempts);
        setModules(nextModules);
        setTeacherQuizzes(nextTeacherQuizzes);
      });
    }, [student]),
  );

  return (
    <Screen>
      <ScreenHeader
        overline="Progress"
        title="My Quiz History"
        subtitle="Review every attempt, your timing, and the answers to revisit."
      />
      {teacherQuizzes.length > 0 ? (
        <>
          <SectionHeader
            title="Teacher assigned quizzes"
            caption="Standalone quizzes received on this device"
          />
          <Card>
            {teacherQuizzes.map((item, index) => (
              <View key={item.packageId}>
                {index > 0 ? <Divider style={styles.rowDivider} /> : null}
                <ListRow
                  icon={PackageOpen}
                  title={item.title}
                  subtitle={`${item.manifest.quiz?.questions.length ?? 0} questions · Teacher issued`}
                  color={colors.secondary}
                  onPress={() =>
                    navigation.navigate('LearningPackage', {
                      packageId: item.packageId,
                    })
                  }
                />
              </View>
            ))}
          </Card>
        </>
      ) : null}
      {attempts.length === 0 ? (
        <EmptyState title="No attempts yet" body="Complete a quiz to create your first local attempt log." />
      ) : (
        attempts.map((attempt) => {
          const module = modules.find((item) => item.id === attempt.moduleId);
          const teacherQuiz = teacherQuizzes.find(
            (item) =>
              teacherQuizModuleId(item.packageId) === attempt.moduleId,
          );
          const percent =
            attempt.totalItems > 0 ? Math.round((attempt.score / attempt.totalItems) * 100) : 0;
          const subject = module?.subject;
          return (
            <Card key={attempt.id} accent={subject ? subjectColor[subject] : colors.primary}>
              <CardHeader
                icon={QrCode}
                title={module?.title ?? teacherQuiz?.title ?? attempt.moduleId}
                subtitle={`${attempt.score}/${attempt.totalItems} correct · ${formatDuration(attempt.durationSeconds)}`}
                color={subject ? subjectColor[subject] : colors.primary}
                action={
                  <StatusBadge
                    label={`${percent}%`}
                    status={percent >= 80 ? 'completed' : percent >= 50 ? 'inProgress' : 'notStarted'}
                  />
                }
              />
              <ProgressBar value={percent / 100} height={8} />
              <View style={styles.resultRow}>
                <View style={styles.flex}>
                  <PrimaryButton
                    label="Review attempt"
                    tone="secondary"
                    size="sm"
                    icon={Target}
                    onPress={() =>
                      navigation.navigate('QuizAttemptHistory', {
                        attemptLogId: attempt.id,
                      })
                    }
                  />
                </View>
                <View style={styles.flex}>
                  <PrimaryButton
                    label="Open QR"
                    tone="ghost"
                    size="sm"
                    icon={QrCode}
                    onPress={() =>
                      navigation.navigate('QuizReport', {
                        moduleId: attempt.moduleId,
                        attemptId: attempt.id,
                      })
                    }
                  />
                </View>
              </View>
            </Card>
          );
        })
      )}
    </Screen>
  );
}

export function QuizAttemptHistoryScreen({
  navigation,
  route,
}: StackProps<'QuizAttemptHistory'>) {
  const student = useSessionStore((state) => state.student);
  const [attempt, setAttempt] = useState<QuizAttemptLog | null>(null);
  const [module, setModule] = useState<LearningModule | null>(null);

  useEffect(() => {
    if (!student) return;
    void getQuizAttemptLogs(student.id).then(async (logs) => {
      const next = logs.find(
        (item) => item.attemptLogId === route.params.attemptLogId,
      );
      setAttempt(next ?? null);
      if (next) setModule(await getModule(next.moduleId));
    });
  }, [route.params.attemptLogId, student]);

  if (!attempt) {
    return (
      <Screen>
        <ScreenHeader title="Quiz attempt" onBack={navigation.goBack} />
        <EmptyState
          title="Attempt unavailable"
          body="This quiz log is not stored on this device."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        overline={`Attempt #${attempt.attemptNumber}`}
        title={module?.title ?? 'Quiz attempt'}
        subtitle={`${formatDate(attempt.completedAt)} · ${formatDuration(
          attempt.timing.totalTimeSeconds,
        )}`}
        onBack={navigation.goBack}
      />
      <Card accent={colors.primary}>
        <CardHeader
          icon={Trophy}
          title={`${attempt.score.percentage}%`}
          subtitle={`${attempt.score.correct} of ${attempt.score.total} correct`}
          color={colors.primary}
          action={
            <StatusBadge
              label={attempt.score.percentage >= 80 ? 'Strong' : 'Keep practising'}
              status={
                attempt.score.percentage >= 80
                  ? 'completed'
                  : 'inProgress'
              }
            />
          }
        />
        <ProgressBar value={attempt.score.percentage / 100} />
      </Card>

      <SectionHeader
        title="Questions to revisit"
        caption={
          attempt.missedQuestions.length
            ? `${attempt.missedQuestions.length} missed question${
                attempt.missedQuestions.length === 1 ? '' : 's'
              }`
            : 'A perfect attempt'
        }
      />
      {attempt.missedQuestions.length === 0 ? (
        <Callout
          icon={CheckCircle2}
          title="Everything was correct"
          body="You can still revisit the lesson before your next attempt."
          tone="success"
        />
      ) : (
        attempt.missedQuestions.map((question, index) => (
          <Card key={question.questionId} accent={colors.warning}>
            <CardHeader
              icon={Target}
              title={`${index + 1}. ${question.questionText}`}
              subtitle={`${question.timeSeconds}s on this question`}
              color={colors.warning}
            />
            <View style={styles.answerReview}>
              <Text style={styles.answerReviewLabel}>Your answer</Text>
              <Text style={styles.answerReviewWrong}>
                {question.chosenAnswer || 'No answer'}
              </Text>
            </View>
            <View style={styles.answerReview}>
              <Text style={styles.answerReviewLabel}>Correct answer</Text>
              <Text style={styles.correctAnswer}>{question.correctAnswer}</Text>
            </View>
          </Card>
        ))
      )}
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
      <ScreenHeader
        overline="Scan to submit"
        title="Offline quiz report"
        subtitle={module?.title ?? 'Preparing report'}
        onBack={navigation.goBack}
      />
      <Card style={styles.qrCard}>
        {payloads[partIndex] ? (
          <>
            <View style={styles.qrFrame}>
              <QRCode value={payloads[partIndex]} size={248} ecl="M" />
            </View>
            {payloads.length > 1 ? (
              <Text style={styles.qrCounter}>
                QR {partIndex + 1} of {payloads.length}
              </Text>
            ) : null}
          </>
        ) : (
          <Skeleton width="100%" height={248} />
        )}
      </Card>
      {payloads.length > 1 ? (
        <View style={styles.resultRow}>
          <View style={styles.flex}>
            <PrimaryButton
              label="Previous"
              icon={ChevronLeft}
              tone="secondary"
              disabled={partIndex === 0}
              onPress={() => setPartIndex((value) => Math.max(0, value - 1))}
            />
          </View>
          <View style={styles.flex}>
            <PrimaryButton
              label="Next"
              icon={ChevronRight}
              disabled={partIndex === payloads.length - 1}
              onPress={() => setPartIndex((value) => Math.min(payloads.length - 1, value + 1))}
            />
          </View>
        </View>
      ) : null}
      <Text style={styles.qrNote}>
        Scan every numbered QR. It lists which questions were missed and the time spent on each, never the answers.
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
  const [devicePublicKey, setDevicePublicKey] = useState<string | null>(null);

  useEffect(() => {
    if (!student) return;
    void getAdaptiveFormatProfile(student.id).then(setAdaptive);
    void ensureDeviceIdentity(`student:${student.id}`)
      .then((identity) => setDevicePublicKey(identity.publicKeyHex))
      .catch(() => setDevicePublicKey(null));
  }, [student]);

  if (!student) return null;
  const profilePayload = encodeProfileQr({
    student,
    currentLearningFormat:
      adaptive?.manualOverride ?? adaptive?.currentDefaultFormat ?? 'text',
    devicePublicKey,
  });

  return (
    <Screen>
      <ScreenHeader overline="Account" title="Profile" subtitle={student.studentNumber} />

      <Card>
        <View style={styles.profileHead}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(student.displayName)}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.profileName} numberOfLines={1}>
              {student.displayName}
            </Text>
            <Text style={styles.body}>
              {formatSectionLabel(student.gradeLevel, student.section)}
            </Text>
          </View>
        </View>
        <Divider />
        <ProfileLine label="Student number" value={student.studentNumber} />
        <ProfileLine label="Parent or guardian" value={student.parentName} />
        <ProfileLine label="Parent mobile" value={student.parentPhone} />
      </Card>

      <Card style={styles.qrCard}>
        <Text style={styles.cardTitle}>My profile QR</Text>
        <View style={styles.qrFrame}>
          <QRCode value={profilePayload} size={224} ecl="M" />
        </View>
        <Text style={styles.qrNote}>
          Show this once to your teacher while your class section is active.
        </Text>
      </Card>

      <Card>
        <CardHeader
          icon={Sparkles}
          title="Default learning format"
          subtitle={`Pavo recommends ${adaptive?.currentDefaultFormat ?? 'text'} from your recent work`}
          color={colors.primary}
        />
        <Text style={styles.body}>
          PAVO recommends {adaptive?.currentDefaultFormat ?? 'text'} from
          recent completed work. A parent PIN is required to change this visible
          default.
        </Text>
        <View style={styles.chipRow}>
          {(['text', 'audio', 'visual', 'kinesthetic'] as const).map((format) => (
            <Chip
              key={format}
              label={capitalize(format)}
              selected={
                (adaptive?.manualOverride ?? adaptive?.currentDefaultFormat) === format
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
        <CardHeader icon={Settings2} title="Device mode" subtitle={modeReason} color={colors.secondary} />
        <SegmentedControl
          value={mode}
          onChange={(next) => void setMode(next)}
          options={[
            { value: 'lightweight', label: 'Offline light' },
            { value: 'full', label: 'Full' },
          ]}
        />
      </Card>

      <SectionHeader title="More" />
      <Card>
        <ListRowLink
          label="Parent weekly digest"
          caption="A short summary to share at home"
          icon={Sparkles}
          onPress={() => navigation.navigate('ParentDigest')}
        />
        <Divider style={styles.rowDivider} />
        <ListRowLink
          label="Receive a module"
          caption="Accept a lesson from a nearby device"
          icon={Download}
          color={colors.secondary}
          onPress={() => navigation.navigate('ReceiveTransfer')}
        />
      </Card>

      <View style={styles.signOutRow}>
        <PrimaryButton
          label="Sign out"
          tone="danger"
          size="sm"
          icon={LogOut}
          onPress={() => void signOut().then(() => navigation.getParent()?.navigate('Role'))}
        />
      </View>
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

function ListRowLink({
  label,
  caption,
  icon,
  color = colors.primary,
  onPress,
}: {
  label: string;
  caption: string;
  icon: Parameters<typeof IconPlate>[0]['icon'];
  color?: string;
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label}>
      <View style={styles.taskRow}>
        <IconPlate icon={icon} color={color} size={38} />
        <View style={styles.flex}>
          <Text style={styles.focusValue}>{label}</Text>
          <Text style={styles.linkCaption}>{caption}</Text>
        </View>
        <ChevronRight size={18} color={colors.inkSubtle} />
      </View>
    </PressableScale>
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

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase() ?? '')
    .join('');
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
  flex: { flex: 1, minWidth: 0 },
  fixedHeader: { paddingHorizontal: layout.gutter, gap: spacing.md },
  listContent: {
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.md,
    gap: spacing.md,
    paddingBottom: layout.tabBarClearance,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingRight: spacing.xl },
  metricSkeleton: { borderRadius: radius.lg, flexGrow: 1 },
  spaceBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  body: { ...text.bodySm, color: colors.inkMuted },
  cardTitle: { ...text.title, color: colors.ink },
  focusRow: { flexDirection: 'row', gap: spacing.md },
  focusPanel: { flex: 1, borderRadius: radius.md, padding: spacing.md, gap: 2 },
  focusLabel: { ...text.overline, color: colors.inkMuted, letterSpacing: 0.4, fontSize: 11 },
  focusValue: { ...text.bodyStrong, color: colors.ink, marginTop: 2 },
  courseProgress: { gap: spacing.sm },
  progressValue: { ...text.label, color: colors.primary, fontWeight: '800' },
  linkCaption: { ...text.caption, color: colors.inkMuted, fontWeight: '500', marginTop: 1 },

  taskRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
  taskDue: { ...text.caption, color: colors.secondary, marginTop: 1 },
  rowDivider: { marginVertical: spacing.xs },

  // Module cards
  moduleCell: { width: '100%' },
  moduleCard: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outline,
    overflow: 'hidden',
    ...elevation.e1,
  },
  moduleSpine: { width: 5 },
  moduleBody: { flex: 1, padding: spacing.lg, gap: spacing.xs },
  moduleTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  subjectTag: {
    alignSelf: 'flex-start',
    borderRadius: radius.round,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
  },
  subjectTagText: { ...text.tiny, letterSpacing: 0.3 },
  moduleTitle: { ...text.title, color: colors.ink, fontSize: 17, lineHeight: 22, marginTop: 2 },
  moduleCode: { ...text.caption, color: colors.inkSubtle, fontSize: 12, fontWeight: '600' },
  moduleSummary: { ...text.caption, color: colors.inkMuted, fontWeight: '500', lineHeight: 19, marginTop: spacing.xs },
  styleTags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  styleTag: {
    ...text.tiny,
    color: colors.primary,
    backgroundColor: colors.primaryTint,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.xs,
    overflow: 'hidden',
  },
  cardAction: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  cardActionText: { ...text.label, color: colors.primary, fontWeight: '800' },

  // Inputs
  input: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.outline,
    backgroundColor: colors.surface,
    color: colors.ink,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
  },
  inputFocused: { borderColor: colors.primary },
  recallSource: {
    minHeight: 160,
    lineHeight: 24,
    backgroundColor: colors.surfaceMuted,
    paddingVertical: spacing.md,
  },

  // Quiz
  quizProgress: { gap: spacing.sm },
  stepDots: { flexDirection: 'row', gap: 4 },
  stepDot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.surfaceSunken },
  stepDotDone: { backgroundColor: colors.primaryTint },
  stepDotActive: { backgroundColor: colors.primary },
  formatLabel: { ...text.caption, color: colors.inkMuted, marginBottom: spacing.sm },
  timerLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  question: { ...text.h2, color: colors.ink, fontSize: 21, lineHeight: 29 },
  optionList: { gap: spacing.md },
  answerOption: {
    minHeight: 62,
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
  answerPressed: { backgroundColor: colors.surfaceMuted },
  optionKey: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.outlineStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionKeySelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  optionKeyText: { ...text.label, color: colors.inkMuted, fontWeight: '800' },
  answerText: { flex: 1, color: colors.ink, ...text.bodyStrong },

  // Results
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  scoreBlock: { flex: 1, minWidth: 0 },
  score: { ...text.numeral, color: colors.ink },
  scoreLabel: { color: colors.inkMuted, ...text.label },
  masteryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accentTint,
    borderRadius: radius.round,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  masteryText: { ...text.label, color: colors.accentText, fontWeight: '800' },
  metaRow: { flexDirection: 'row', gap: spacing.md },
  metaItem: { flex: 1, gap: 2 },
  metaValue: { ...text.bodyStrong, color: colors.ink },
  resultRow: { flexDirection: 'row', gap: spacing.md },
  breakdownTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  correctAnswer: { ...text.bodySm, color: colors.success, fontWeight: '700' },
  answerReview: { gap: spacing.xs },
  answerReviewLabel: { ...text.overline, color: colors.inkMuted },
  answerReviewWrong: { ...text.bodySm, color: colors.error, fontWeight: '700' },

  // Flashcards
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
  flashcardBack: { backgroundColor: colors.canopy },
  flashcardTag: {
    backgroundColor: colors.onBrandSurface,
    borderRadius: radius.round,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  flashcardLabel: { ...text.overline, color: colors.onBrand, fontSize: 11 },
  flashcardText: {
    color: colors.onBrand,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  flashcardHint: { color: colors.onBrandMuted, textAlign: 'center', ...text.caption },
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
  ratingDot: { width: 14, height: 14, borderRadius: radius.round },
  ratingLabel: { color: colors.ink, ...text.label, fontWeight: '800' },

  // QR & profile
  qrCard: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl, gap: spacing.lg },
  qrFrame: {
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  qrCounter: { ...text.label, color: colors.inkMuted, fontWeight: '800' },
  qrNote: { color: colors.inkMuted, ...text.caption, fontWeight: '500', textAlign: 'center' },
  profileHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.round,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...text.title, color: colors.primary, fontWeight: '800' },
  profileName: { ...text.h2, color: colors.ink },
  profileLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  profileValue: { color: colors.ink, ...text.bodyStrong },
  signOutRow: { marginTop: spacing.sm, alignItems: 'center' },
});
