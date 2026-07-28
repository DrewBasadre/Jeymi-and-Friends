import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  BarChart3,
  BookOpen,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Layers3,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Wifi,
  WifiOff,
} from 'lucide-react-native';
import { CompanionThinking } from '@/components/CompanionThinking';
import { PeacockPhase, peacockPhase } from '@/components/mascot/PeacockPhase';
import {
  Callout,
  Card,
  CardHeader,
  Chip,
  Divider,
  EmptyState,
  PrimaryButton,
  Screen,
  ScreenHeader,
  SegmentedControl,
  StatTile,
  TileGrid,
} from '@/components/ui';
import {
  getStudentDashboard,
  listModules,
  listStudentTasks,
} from '@/data/repository';
import {
  buildCompanionRequest,
  validateCompanionQuestion,
} from '@/domain/companion';
import type {
  CompanionActivity,
  CompanionIntent,
  CompanionResponse,
} from '@/domain/companion';
import type {
  LearningModule,
  StudentDashboard,
  StudentTask,
  Subject,
} from '@/domain/types';
import type { RootStackParamList } from '@/navigation/types';
import { askPavo, isCompanionConfigured } from '@/services/companion';
import { useConnectivity } from '@/services/connectivity';
import { useSessionStore } from '@/store/session';
import {
  colors,
  elevation,
  radius,
  spacing,
  subjectColor,
  text,
} from '@/theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'AiCompanion'>;

const intentOptions: Array<{ value: CompanionIntent; label: string }> = [
  { value: 'performance_report', label: 'Performance' },
  { value: 'review_lessons', label: 'Review' },
  { value: 'ask', label: 'Ask' },
];

const activityOptions: Array<{ value: CompanionActivity; label: string }> = [
  { value: 'lesson', label: 'Lesson' },
  { value: 'flashcards', label: 'Cards' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'mixed_practice', label: 'Mixed' },
];

export function AiCompanionScreen({ navigation }: Props) {
  const student = useSessionStore((state) => state.student);
  const [dashboard, setDashboard] = useState<StudentDashboard | null>(null);
  const [tasks, setTasks] = useState<StudentTask[]>([]);
  const [modules, setModules] = useState<LearningModule[]>([]);
  const [intent, setIntent] = useState<CompanionIntent>('performance_report');
  const [activity, setActivity] = useState<CompanionActivity>('mixed_practice');
  const [selectedSubjects, setSelectedSubjects] = useState<Subject[]>([]);
  const [selectedModuleIds, setSelectedModuleIds] = useState<string[]>([]);
  const [question, setQuestion] = useState('');
  const [submission, setSubmission] = useState<{ id: number; label: string } | null>(null);
  const [thinkingComplete, setThinkingComplete] = useState(false);
  const [result, setResult] = useState<CompanionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const connectivity = useConnectivity();
  const configured = isCompanionConfigured();

  const load = useCallback(async () => {
    if (!student) return;
    const [nextDashboard, nextTasks, nextModules] = await Promise.all([
      getStudentDashboard(student.id),
      listStudentTasks(student.id),
      listModules(student.id),
    ]);
    setDashboard(nextDashboard);
    setTasks(nextTasks);
    setModules(nextModules);
  }, [student]);

  useFocusEffect(useCallback(() => void load(), [load]));

  const subjects = useMemo(
    () => Array.from(new Set(modules.map((module) => module.subject))),
    [modules],
  );
  useEffect(() => {
    if (selectedSubjects.length === 0 && subjects[0]) {
      setSelectedSubjects([subjects[0]]);
    }
  }, [selectedSubjects.length, subjects]);

  const reviewModules = useMemo(
    () =>
      modules.filter((module) =>
        selectedSubjects.includes(module.subject),
      ),
    [modules, selectedSubjects],
  );
  const selectedModules = useMemo(
    () => modules.filter((module) => selectedModuleIds.includes(module.id)),
    [modules, selectedModuleIds],
  );
  const openTasks = useMemo(
    () =>
      tasks
        .filter((task) => !task.completedAt)
        .sort((left, right) => left.dueDate.localeCompare(right.dueDate))
        .slice(0, 4),
    [tasks],
  );
  const growth = peacockPhase({
    completedModules: dashboard?.completedModules,
    totalModules: dashboard?.totalModules,
    averageScore: dashboard?.averageScore,
  });
  const online = connectivity === 'online' && configured;

  function toggleSubject(subject: Subject) {
    setSelectedSubjects((current) =>
      current.includes(subject)
        ? current.filter((item) => item !== subject)
        : [...current, subject],
    );
  }

  function toggleModule(moduleId: string) {
    setSelectedModuleIds((current) => {
      if (current.includes(moduleId)) {
        return current.filter((item) => item !== moduleId);
      }
      if (current.length >= 4) {
        setError('Choose up to four lessons for one focused activity.');
        return current;
      }
      setError(null);
      return [...current, moduleId];
    });
  }

  async function generate() {
    setError(null);
    if (!online) {
      setError(
        connectivity === 'offline'
          ? 'Pavo review needs an internet connection.'
          : 'Pavo online review is not configured on this build.',
      );
      return;
    }
    if (!student || !dashboard) {
      setError('Your progress is still loading.');
      return;
    }
    if (intent === 'review_lessons' && selectedModuleIds.length === 0) {
      setError('Choose at least one installed lesson to review.');
      return;
    }
    if (intent === 'ask') {
      const validationError = validateCompanionQuestion(question);
      if (validationError) {
        setError(validationError);
        return;
      }
    } else if (question.trim()) {
      const validationError = validateCompanionQuestion(question);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    const label = submissionLabel(intent, activity, selectedModules, question);
    setSubmission({ id: Date.now(), label });
    setThinkingComplete(false);
    setResult(null);
    setLoading(true);
    try {
      const request = buildCompanionRequest({
        intent,
        activity,
        gradeLevel: student.gradeLevel,
        question,
        selectedModuleIds,
        modules,
        dashboard,
        tasks,
      });
      const [nextResult] = await Promise.all([askPavo(request), delay(1700)]);
      setThinkingComplete(true);
      await delay(280);
      setResult(nextResult);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Pavo could not finish that activity.',
      );
    } finally {
      setLoading(false);
    }
  }

  if (!student) {
    return (
      <EmptyState
        title="No student profile"
        body="Sign in again to use Pavo."
      />
    );
  }

  return (
    <Screen bottomClearance>
      <ScreenHeader
        overline="Online learning companion"
        title="Pavo"
        subtitle={`${growth.name} companion · Grade ${student.gradeLevel}`}
        onBack={() => navigation.goBack()}
        action={
          <View style={styles.mascotWrap}>
            <PeacockPhase phase={growth.phase} size={58} />
          </View>
        }
      />

      <View style={styles.statusRow}>
        <View style={[styles.statusDot, online ? styles.onlineDot : styles.offlineDot]} />
        {online ? (
          <Wifi size={16} color={colors.success} />
        ) : (
          <WifiOff size={16} color={colors.inkSubtle} />
        )}
        <Text style={styles.statusText}>
          {online
            ? 'Online and ready'
            : connectivity === 'checking'
              ? 'Checking connection'
              : connectivity === 'offline'
                ? 'Offline'
                : 'Setup required'}
        </Text>
      </View>

      {!online ? (
        <Callout
          icon={WifiOff}
          title="Online review unavailable"
          body={
            connectivity === 'offline'
              ? 'Your downloaded lessons still work. Reconnect to ask Pavo for new reports and practice.'
              : 'This build needs its secure Pavo server URL before AI review can run.'
          }
          tone="warning"
        />
      ) : null}

      <Card>
        <CardHeader
          icon={BarChart3}
          title="Learning snapshot"
          subtitle="Local stats shared without your name or student number"
          color={colors.secondary}
        />
        <TileGrid columns={2}>
          <StatTile
            icon={Check}
            label="Modules done"
            value={`${dashboard?.completedModules ?? 0}/${dashboard?.totalModules ?? 0}`}
            color={colors.success}
          />
          <StatTile
            icon={Target}
            label="Average"
            value={`${Math.round(dashboard?.averageScore ?? 0)}%`}
            color={colors.secondary}
          />
          <StatTile
            icon={Layers3}
            label="Reviews due"
            value={dashboard?.dueReviews ?? 0}
            color={colors.primary}
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
          title="To-do"
          subtitle={openTasks.length > 0 ? 'Nearest deadlines' : 'Nothing waiting'}
          color={colors.accentText}
        />
        {openTasks.length === 0 ? (
          <Text style={styles.body}>You are caught up.</Text>
        ) : (
          openTasks.map((task, index) => (
            <View key={task.taskId}>
              {index > 0 ? <Divider style={styles.divider} /> : null}
              <View style={styles.todoRow}>
                <View style={styles.todoCheck} />
                <View style={styles.flex}>
                  <Text style={styles.todoTitle}>
                    {modules.find((module) => module.id === task.targetId)?.title ??
                      (task.type === 'module' ? 'Read assigned module' : 'Take assigned quiz')}
                  </Text>
                  <Text style={styles.todoDue}>Due {friendlyDate(task.dueDate)}</Text>
                </View>
              </View>
            </View>
          ))
        )}
      </Card>

      <View style={styles.builder}>
        <Text style={styles.sectionTitle}>What should Pavo prepare?</Text>
        <SegmentedControl
          options={intentOptions}
          value={intent}
          onChange={(next) => {
            setIntent(next);
            setError(null);
          }}
        />

        {intent === 'performance_report' ? (
          <Callout
            icon={BarChart3}
            title="Performance report"
            body="Pavo will explain strengths, practice priorities, deadlines, and useful next steps from the stats above."
          />
        ) : null}

        {intent === 'review_lessons' ? (
          <View style={styles.reviewBuilder}>
            <Text style={styles.stepLabel}>1. Select subjects</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {subjects.map((subject) => (
                <Chip
                  key={subject}
                  label={friendlySubject(subject)}
                  selected={selectedSubjects.includes(subject)}
                  color={subjectColor[subject]}
                  onPress={() => toggleSubject(subject)}
                />
              ))}
            </ScrollView>

            <Text style={styles.stepLabel}>2. Select lessons</Text>
            <View style={styles.lessonList}>
              {reviewModules.map((module) => {
                const selected = selectedModuleIds.includes(module.id);
                return (
                  <Pressable
                    key={module.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    onPress={() => toggleModule(module.id)}
                    style={({ pressed }) => [
                      styles.lessonRow,
                      selected && styles.lessonRowSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                      {selected ? <Check size={14} color={colors.white} strokeWidth={3} /> : null}
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.lessonTitle}>{module.title}</Text>
                      <Text style={styles.lessonMeta}>
                        {friendlySubject(module.subject)} · {module.competencyCode}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.stepLabel}>3. Choose an activity</Text>
            <SegmentedControl
              options={activityOptions}
              value={activity}
              onChange={setActivity}
            />
          </View>
        ) : null}

        <View style={styles.promptBlock}>
          <View style={styles.promptHeader}>
            <Text style={styles.stepLabel}>
              {intent === 'ask' ? 'Your lesson question' : 'Extra instructions (optional)'}
            </Text>
            <View style={styles.guardrail}>
              <ShieldCheck size={14} color={colors.success} />
              <Text style={styles.guardrailText}>Child-safe</Text>
            </View>
          </View>
          <TextInput
            accessibilityLabel="Question for Pavo"
            editable={!loading && online}
            maxLength={500}
            multiline
            onChangeText={setQuestion}
            placeholder={
              intent === 'ask'
                ? 'Ask about an installed lesson...'
                : 'Example: Give me more examples before the quiz.'
            }
            placeholderTextColor={colors.inkSubtle}
            style={styles.input}
            value={question}
          />
          <Text style={styles.counter}>{question.length}/500</Text>
        </View>

        {error ? (
          <Callout
            icon={CircleHelp}
            title="Pavo could not continue"
            body={error}
            tone="error"
          />
        ) : null}

        <PrimaryButton
          icon={intent === 'performance_report' ? BarChart3 : intent === 'ask' ? Send : Sparkles}
          label={
            intent === 'performance_report'
              ? 'Create performance report'
              : intent === 'ask'
                ? 'Ask Pavo'
                : 'Create review activity'
          }
          disabled={!online || !dashboard}
          loading={loading}
          onPress={() => void generate()}
        />
      </View>

      {submission ? (
        <CompanionThinking
          key={submission.id}
          prompt={submission.label}
          complete={thinkingComplete}
        />
      ) : null}

      {result ? <CompanionResult result={result} /> : null}

      <View style={styles.poweredRow}>
        <ShieldCheck size={14} color={colors.inkSubtle} />
        <Text style={styles.poweredText}>
          Built with ChatGPT Codex · AI responses by OpenAI
        </Text>
      </View>
    </Screen>
  );
}

function CompanionResult({ result }: { result: CompanionResponse }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(18)).current;
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(rise, {
        toValue: 0,
        damping: 15,
        stiffness: 150,
        mass: 0.9,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, rise]);

  const card = result.flashcards[cardIndex];

  return (
    <Animated.View
      style={[
        styles.result,
        { opacity, transform: [{ translateY: rise }] },
      ]}
    >
      <View style={styles.resultHeader}>
        <View style={styles.resultIcon}>
          <Sparkles size={21} color={colors.white} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.resultEyebrow}>PAVO'S RESPONSE</Text>
          <Text style={styles.resultTitle}>{result.title}</Text>
        </View>
      </View>
      <Text style={styles.resultSummary}>{result.summary}</Text>

      {result.sections.map((section, index) => (
        <View key={`${section.heading}-${index}`} style={styles.resultSection}>
          <Text style={styles.resultSectionTitle}>{section.heading}</Text>
          <Text style={styles.resultBody}>{section.body}</Text>
        </View>
      ))}

      {card ? (
        <View style={styles.activityBlock}>
          <View style={styles.activityHeader}>
            <Text style={styles.activityTitle}>Flashcards</Text>
            <Text style={styles.activityCount}>
              {cardIndex + 1} of {result.flashcards.length}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={flipped ? card.back : card.front}
            accessibilityHint="Flips the flashcard"
            onPress={() => setFlipped((value) => !value)}
            style={({ pressed }) => [
              styles.flashcard,
              flipped && styles.flashcardBack,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.flashcardSide}>{flipped ? 'ANSWER' : 'PROMPT'}</Text>
            <Text style={styles.flashcardText}>{flipped ? card.back : card.front}</Text>
            <View style={styles.flipHint}>
              <RotateCcw size={15} color={colors.onBrandMuted} />
              <Text style={styles.flipHintText}>Tap to flip</Text>
            </View>
          </Pressable>
          <View style={styles.cardNavigation}>
            <Pressable
              accessibilityLabel="Previous flashcard"
              disabled={cardIndex === 0}
              onPress={() => {
                setCardIndex((index) => Math.max(0, index - 1));
                setFlipped(false);
              }}
              style={[styles.navButton, cardIndex === 0 && styles.navButtonDisabled]}
            >
              <ChevronLeft size={20} color={colors.primary} />
            </Pressable>
            <Pressable
              accessibilityLabel="Next flashcard"
              disabled={cardIndex === result.flashcards.length - 1}
              onPress={() => {
                setCardIndex((index) =>
                  Math.min(result.flashcards.length - 1, index + 1),
                );
                setFlipped(false);
              }}
              style={[
                styles.navButton,
                cardIndex === result.flashcards.length - 1 && styles.navButtonDisabled,
              ]}
            >
              <ChevronRight size={20} color={colors.primary} />
            </Pressable>
          </View>
        </View>
      ) : null}

      {result.questions.length > 0 ? (
        <View style={styles.activityBlock}>
          <Text style={styles.activityTitle}>Practice questions</Text>
          {result.questions.map((question, questionIndex) => {
            const chosen = answers[questionIndex];
            return (
              <View key={`${question.prompt}-${questionIndex}`} style={styles.questionBlock}>
                <Text style={styles.questionText}>
                  {questionIndex + 1}. {question.prompt}
                </Text>
                <View style={styles.optionList}>
                  {question.options.map((option, optionIndex) => {
                    const selected = chosen === optionIndex;
                    const answered = chosen !== undefined;
                    const correct = optionIndex === question.correctOption;
                    return (
                      <Pressable
                        key={`${option}-${optionIndex}`}
                        disabled={answered}
                        onPress={() =>
                          setAnswers((current) => ({
                            ...current,
                            [questionIndex]: optionIndex,
                          }))
                        }
                        style={[
                          styles.option,
                          selected && !correct && styles.optionWrong,
                          answered && correct && styles.optionCorrect,
                        ]}
                      >
                        <Text style={styles.optionLetter}>
                          {String.fromCharCode(65 + optionIndex)}
                        </Text>
                        <Text style={styles.optionText}>{option}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {chosen !== undefined ? (
                  <Callout
                    title={
                      chosen === question.correctOption ? 'Correct' : 'Keep learning'
                    }
                    body={question.explanation}
                    tone={chosen === question.correctOption ? 'success' : 'info'}
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

      <Callout
        icon={BookOpen}
        title="Next step"
        body={result.nextStep}
        tone="success"
      />
    </Animated.View>
  );
}

function submissionLabel(
  intent: CompanionIntent,
  activity: CompanionActivity,
  modules: LearningModule[],
  question: string,
): string {
  if (intent === 'performance_report') {
    return 'Create a clear report from my learning progress.';
  }
  if (intent === 'ask') return question.trim();
  const activityLabel = {
    lesson: 'a review lesson',
    flashcards: 'flashcards',
    quiz: 'a practice quiz',
    mixed_practice: 'a mixed practice set',
  }[activity];
  const titles = modules.map((module) => module.title).join(', ');
  return `Create ${activityLabel} for ${titles}.`;
}

function friendlySubject(subject: Subject): string {
  return subject
    .replace('_', ' ')
    .toLocaleLowerCase()
    .replace(/\b\w/g, (letter) => letter.toLocaleUpperCase());
}

function friendlyDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  mascotWrap: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusRow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusDot: { width: 8, height: 8, borderRadius: radius.round },
  onlineDot: { backgroundColor: colors.success },
  offlineDot: { backgroundColor: colors.inkSubtle },
  statusText: { ...text.caption, color: colors.inkMuted },
  body: { ...text.bodySm, color: colors.inkMuted },
  divider: { marginVertical: spacing.sm },
  todoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  todoCheck: {
    width: 20,
    height: 20,
    borderRadius: radius.xs,
    borderWidth: 2,
    borderColor: colors.outlineStrong,
    backgroundColor: colors.surface,
  },
  todoTitle: { ...text.bodyStrong, color: colors.ink, fontSize: 15 },
  todoDue: { ...text.caption, color: colors.accentText },
  builder: { gap: spacing.lg },
  sectionTitle: { ...text.h2, color: colors.ink },
  reviewBuilder: { gap: spacing.md },
  stepLabel: { ...text.label, color: colors.ink, fontWeight: '800' },
  chipRow: { gap: spacing.sm, paddingRight: spacing.lg },
  lessonList: { gap: spacing.sm },
  lessonRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  lessonRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.xs,
    borderWidth: 2,
    borderColor: colors.outlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkboxSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  lessonTitle: { ...text.bodyStrong, color: colors.ink },
  lessonMeta: { ...text.caption, color: colors.inkMuted, marginTop: 2 },
  promptBlock: { gap: spacing.sm },
  promptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  guardrail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  guardrailText: { ...text.tiny, color: colors.success },
  input: {
    minHeight: 112,
    maxHeight: 190,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.outline,
    backgroundColor: colors.surface,
    color: colors.ink,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    textAlignVertical: 'top',
    fontSize: 16,
    lineHeight: 23,
  },
  counter: { ...text.tiny, color: colors.inkSubtle, alignSelf: 'flex-end' },
  pressed: { opacity: 0.82 },
  result: {
    gap: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.outline,
    paddingTop: spacing.xxl,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  resultIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  resultEyebrow: { ...text.overline, color: colors.primary, letterSpacing: 0.6 },
  resultTitle: { ...text.h2, color: colors.ink },
  resultSummary: { ...text.body, color: colors.inkMuted },
  resultSection: {
    gap: spacing.xs,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  resultSectionTitle: { ...text.title, color: colors.ink },
  resultBody: { ...text.body, color: colors.inkMuted },
  activityBlock: { gap: spacing.md },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityTitle: { ...text.title, color: colors.ink },
  activityCount: { ...text.caption, color: colors.inkMuted },
  flashcard: {
    minHeight: 250,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    backgroundColor: colors.canopy,
    padding: spacing.xxl,
    ...elevation.e2,
  },
  flashcardBack: { backgroundColor: colors.secondaryPressed },
  flashcardSide: { ...text.overline, color: colors.onBrandMuted, letterSpacing: 0.8 },
  flashcardText: { ...text.h2, color: colors.white, textAlign: 'center' },
  flipHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  flipHintText: { ...text.caption, color: colors.onBrandMuted },
  cardNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surface,
  },
  navButtonDisabled: { opacity: 0.35 },
  questionBlock: { gap: spacing.md },
  questionText: { ...text.bodyStrong, color: colors.ink },
  optionList: { gap: spacing.sm },
  option: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  optionCorrect: {
    borderColor: colors.success,
    backgroundColor: colors.successTint,
  },
  optionWrong: {
    borderColor: colors.error,
    backgroundColor: colors.errorTint,
  },
  optionLetter: {
    ...text.label,
    color: colors.primary,
    width: 22,
    textAlign: 'center',
  },
  optionText: { ...text.bodySm, color: colors.ink, flex: 1 },
  poweredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.lg,
  },
  poweredText: { ...text.tiny, color: colors.inkSubtle },
});

