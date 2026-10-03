import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  AppState,
  Image,
  PixelRatio,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileDown,
  Lightbulb,
  ListChecks,
  QrCode,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Volume2,
  WifiOff,
  XCircle,
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { markdownToPlainText, ModuleMarkdown } from '@/components/ModuleMarkdown';
import {
  Callout,
  Card,
  CardHeader,
  Chip,
  Divider,
  EmptyState,
  ListRow,
  PrimaryButton,
  ProgressBar,
  Screen,
  ScreenHeader,
  SectionHeader,
  Skeleton,
  StatusBadge,
} from '@/components/ui';
import { Celebrate } from '@/components/mascot';
import {
  getLessonProgress,
  recentLearnerEvidence,
  recordRecommendation,
  saveLessonProgress,
  type LessonProgress,
} from '@/data/lessonRepository';
import { getAdaptiveFormatProfile } from '@/data/mvpRepository';
import { getLearningProfile, getStudentDashboard } from '@/data/repository';
import {
  getSession,
  getStudentQuiz,
  listStudentQuizzes,
  resultQrForAttempt,
  retakeMessage,
  saveAttemptProgress,
  startOrResumeAttempt,
  submitAttempt,
  type QuizSession,
  type StudentQuizSummary,
} from '@/data/studentQuizRepository';
import {
  LESSON_BLOCK_LABELS,
  checkAnswer,
  parseAdaptiveLesson,
  type AdaptiveLesson,
  type LessonBlock,
} from '@/domain/adaptiveLesson';
import {
  CHOICE_LABELS,
  gradeStudentAnswer,
  type StudentQuiz,
} from '@/domain/assessmentModel';
import { planLessonPresentation, type PresentationPlan } from '@/domain/lessonAdaptation';
import type { LearningFormat } from '@/domain/types';
import type { RootStackParamList } from '@/navigation/types';
import { useConnectivity } from '@/services/connectivity';
import { pickAndImportPackage } from '@/services/packageImport';
import {
  getInstalledPackage,
  installedFileUri,
  listInstalledPackages,
  readInstalledText,
  type InstalledV2Package,
} from '@/services/packagesV2';
import { readModuleAloud, stopReading } from '@/services/speech';
import { useSessionStore } from '@/store/session';
import { colors, radius, spacing, text } from '@/theme/tokens';

type StackProps<Route extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, Route>;

const FORMAT_LABELS: Record<LearningFormat, string> = {
  text: 'Read',
  audio: 'Listen',
  visual: 'See',
  kinesthetic: 'Try it',
};

/* ────────────────────────────────────────────────────────────────────────
   Teacher-shared lessons and mini-quizzes (Modules tab header)
   ──────────────────────────────────────────────────────────────────────── */

export function TeacherContentSection({
  navigation,
}: {
  navigation: Pick<NativeStackNavigationProp<RootStackParamList>, 'navigate'>;
}) {
  const student = useSessionStore((state) => state.student);
  const [lessons, setLessons] = useState<InstalledV2Package[]>([]);
  const [quizzes, setQuizzes] = useState<StudentQuizSummary[]>([]);
  const [importing, setImporting] = useState(false);

  const load = useCallback(() => {
    if (!student) return;
    void listInstalledPackages({ audience: 'student', packageType: 'lesson' }).then(setLessons);
    void listStudentQuizzes(student.id).then(setQuizzes);
  }, [student]);
  useFocusEffect(load);

  async function importFile() {
    if (!student) return;
    setImporting(true);
    try {
      const outcome = await pickAndImportPackage('student', `student:${student.id}`);
      if (outcome.state !== 'cancelled') Alert.alert(outcome.title, outcome.message);
      load();
    } finally {
      setImporting(false);
    }
  }

  return (
    <View style={styles.section}>
      <SectionHeader title="From your teacher" caption="Lessons and mini-quizzes that work offline" />
      {lessons.length === 0 && quizzes.length === 0 ? (
        <Callout
          icon={BookOpen}
          tone="info"
          title="Nothing shared yet"
          body="When your teacher sends a lesson or mini-quiz with Nearby, it appears here."
        />
      ) : (
        <Card>
          {lessons.map((lesson, index) => (
            <View key={`${lesson.manifest.packageId}@${lesson.manifest.version}`}>
              {index > 0 ? <Divider /> : null}
              <ListRow
                icon={BookOpen}
                title={lesson.manifest.title}
                subtitle={`Lesson · Grade ${lesson.manifest.gradeLevel} · ${lesson.manifest.subject}`}
                onPress={() =>
                  navigation.navigate('Lesson', { packageId: lesson.manifest.packageId, version: lesson.manifest.version })
                }
              />
            </View>
          ))}
          {quizzes.map((summary, index) => {
            const best = Math.max(0, ...summary.attempts.map((attempt) => attempt.scored?.percent ?? 0));
            const used = summary.attempts.filter((attempt) => attempt.status === 'submitted').length;
            const latest = [...summary.attempts].reverse().find((attempt) => attempt.status === 'submitted');
            return (
              <View key={`${summary.quiz.quizId}@${summary.quiz.version}`}>
                {index > 0 || lessons.length > 0 ? <Divider /> : null}
                <ListRow
                  icon={ListChecks}
                  color={colors.secondary}
                  title={summary.quiz.title}
                  subtitle={[
                    `${summary.quiz.questions.length} questions`,
                    summary.quiz.policy.dueDate ? `due ${summary.quiz.policy.dueDate}` : null,
                    summary.inProgress ? 'in progress' : used ? `best ${best}%` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  trailing={
                    <StatusBadge
                      label={summary.inProgress ? 'Resume' : used ? 'Done' : 'New'}
                      status={summary.inProgress ? 'inProgress' : used ? 'completed' : 'notStarted'}
                    />
                  }
                  onPress={() =>
                    summary.inProgress || summary.retake.allowed || !latest
                      ? navigation.navigate('MiniQuiz', { quizId: summary.quiz.quizId, version: summary.quiz.version })
                      : navigation.navigate('MiniQuizResult', { attemptId: latest.attemptId })
                  }
                />
              </View>
            );
          })}
        </Card>
      )}
      <PrimaryButton
        label={importing ? 'Checking package…' : 'Install a package file'}
        icon={FileDown}
        tone="ghost"
        loading={importing}
        onPress={() => void importFile()}
      />
    </View>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Adaptive lesson (mastery sequence)
   ──────────────────────────────────────────────────────────────────────── */

export function LessonScreen({ navigation, route }: StackProps<'Lesson'>) {
  const student = useSessionStore((state) => state.student);
  const connectivity = useConnectivity();
  const [installed, setInstalled] = useState<InstalledV2Package | null>(null);
  const [lesson, setLesson] = useState<AdaptiveLesson | null>(null);
  const [error, setError] = useState('');
  const [evidence, setEvidence] = useState<Omit<Parameters<typeof planLessonPresentation>[1], 'manualFormat' | 'online'> | null>(null);
  const [profileOverride, setProfileOverride] = useState<LearningFormat | null>(null);
  const [lessonFormat, setLessonFormat] = useState<LearningFormat | null>(null);
  const [progress, setProgress] = useState<LessonProgress | null>(null);
  const [step, setStep] = useState(0);
  const [showWhy, setShowWhy] = useState(false);
  const [celebrate, setCelebrate] = useState(0);
  const recorded = useRef(false);

  useEffect(() => {
    if (!student) return;
    void (async () => {
      try {
        const pkg = await getInstalledPackage(route.params.packageId, route.params.version);
        if (!pkg) throw new Error('This lesson is no longer on this device.');
        const parsed = parseAdaptiveLesson(readInstalledText(pkg, 'adaptive-lesson.md'));
        const [profile, adaptive, recent, dashboard, screenReader, saved] = await Promise.all([
          getLearningProfile(student.id),
          getAdaptiveFormatProfile(student.id),
          recentLearnerEvidence(student.id),
          getStudentDashboard(student.id),
          AccessibilityInfo.isScreenReaderEnabled(),
          getLessonProgress(student.id, parsed.lessonId),
        ]);
        setInstalled(pkg);
        setLesson(parsed);
        setProgress(saved);
        setProfileOverride(adaptive.manualOverride);
        setEvidence({
          preferredStyle: profile?.primaryStyle ?? null,
          adaptiveFormat: { current: adaptive.currentDefaultFormat, confidence: adaptive.confidence },
          recentPercent: recent.recentPercent,
          missedConcepts: recent.missedConcepts,
          timingPattern: recent.timingPattern,
          dueReviews: dashboard.dueReviews,
          accessibility: { screenReader, largeText: PixelRatio.getFontScale() > 1.15 },
        });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'The lesson could not be opened.');
      }
    })();
    return () => void stopReading();
  }, [route.params.packageId, route.params.version, student]);

  const plan: PresentationPlan | null = useMemo(
    () =>
      lesson && evidence
        ? planLessonPresentation(lesson, {
            ...evidence,
            manualFormat: lessonFormat ?? profileOverride,
            online: connectivity === 'online',
          })
        : null,
    [connectivity, evidence, lesson, lessonFormat, profileOverride],
  );

  useEffect(() => {
    if (!plan || !student || !lesson || recorded.current) return;
    recorded.current = true;
    void recordRecommendation({ studentId: student.id, lessonId: lesson.lessonId, plan });
  }, [lesson, plan, student]);

  const blocks = useMemo(() => {
    if (!lesson || !plan) return [];
    const byId = new Map(lesson.blocks.map((block) => [block.id, block]));
    return plan.blockOrder.map((id) => byId.get(id)!).filter(Boolean);
  }, [lesson, plan]);
  const block = blocks[step];

  useEffect(() => {
    if (plan?.format === 'audio' && block && block.markdown) {
      void readModuleAloud(markdownToPlainText(block.markdown)).catch(() => undefined);
    }
  }, [block, plan?.format]);

  if (error) {
    return (
      <Screen>
        <ScreenHeader title="Lesson unavailable" onBack={navigation.goBack} />
        <Callout icon={XCircle} tone="error" title="This lesson could not open" body={error} />
      </Screen>
    );
  }
  if (!lesson || !plan || !progress || !installed || !block || !student) {
    return (
      <Screen>
        <ScreenHeader title="Opening lesson…" onBack={navigation.goBack} />
        <Skeleton width="100%" height={180} />
      </Screen>
    );
  }

  const persist = (next: LessonProgress) => {
    setProgress(next);
    void saveLessonProgress(student.id, { lessonId: lesson.lessonId, version: installed.manifest.version }, next);
  };
  const completeStep = () => {
    const completedBlocks = progress.completedBlocks.includes(block.id) ? progress.completedBlocks : [...progress.completedBlocks, block.id];
    persist({ ...progress, completedBlocks });
    void stopReading();
    if (step < blocks.length - 1) setStep(step + 1);
  };
  const chooseFormat = (format: LearningFormat) => {
    setLessonFormat(format);
    void recordRecommendation({ studentId: student.id, lessonId: lesson.lessonId, plan, chosenFormat: format, chosenBy: 'student' });
  };
  const remediationFor = (concept: string | null) =>
    lesson.blocks.find((candidate) => candidate.type === 'remediation' && candidate.concept === concept) ?? null;

  return (
    <Screen>
      {celebrate ? <Celebrate trigger={celebrate} /> : null}
      <ScreenHeader
        overline={`Step ${step + 1} of ${blocks.length} · ${LESSON_BLOCK_LABELS[block.type]}`}
        title={lesson.title}
        onBack={navigation.goBack}
      />
      <ProgressBar value={(step + 1) / blocks.length} accessibilityLabel={`Step ${step + 1} of ${blocks.length}`} />

      <Card>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showWhy }}
          onPress={() => setShowWhy(!showWhy)}
          style={styles.whyRow}
        >
          <Sparkles size={18} color={colors.primary} />
          <Text style={styles.whyTitle}>Showing: {FORMAT_LABELS[plan.format]}</Text>
          <Text style={styles.whyLink}>{showWhy ? 'Hide why' : 'Why?'}</Text>
        </Pressable>
        {showWhy ? (
          <View style={styles.whyBody}>
            {plan.reasons.length ? (
              plan.reasons.map((reason, index) => (
                <Text key={index} style={styles.bodyText}>
                  • {reason.effect}
                </Text>
              ))
            ) : (
              <Text style={styles.bodyText}>• This lesson follows your teacher's order. Pick another format any time.</Text>
            )}
            <View style={styles.chipRow}>
              {(['text', 'audio', 'visual', 'kinesthetic'] as const).map((format) => (
                <Chip key={format} size="sm" label={FORMAT_LABELS[format]} selected={plan.format === format} onPress={() => chooseFormat(format)} />
              ))}
            </View>
            <Text style={styles.captionText}>Parents can set a lasting format from Profile with the parent PIN.</Text>
          </View>
        ) : null}
      </Card>

      <LessonBlockView
        key={block.id}
        block={block}
        plan={plan}
        installed={installed}
        progress={progress}
        remediation={remediationFor(block.concept)}
        onProgress={persist}
      />

      {block.type !== 'checkpoint' ? (
        <View style={styles.footerRow}>
          <View style={styles.flex}>
            <PrimaryButton label="Back" icon={ChevronLeft} tone="secondary" disabled={step === 0} onPress={() => setStep(step - 1)} />
          </View>
          <View style={styles.flex}>
            <PrimaryButton
              label="Continue"
              icon={ChevronRight}
              disabled={block.type === 'check' && progress.checkResults[block.id] === undefined}
              onPress={completeStep}
            />
          </View>
        </View>
      ) : (
        <PrimaryButton
          label={progress.completedAt ? 'Lesson complete' : 'Finish lesson'}
          icon={CheckCircle2}
          disabled={!block.items?.every((_, index) => progress.completedBlocks.includes(`${block.id}#${index}`))}
          onPress={() => {
            persist({ ...progress, completedBlocks: [...new Set([...progress.completedBlocks, block.id])], completedAt: Date.now() });
            setCelebrate((value) => value + 1);
            if (plan.suggestReview) {
              Alert.alert('Nice work', 'Some review cards are due. Open Study for a five-minute review?', [
                { text: 'Later', style: 'cancel', onPress: () => navigation.goBack() },
                { text: 'Review now', onPress: () => navigation.replace('StudentTabs', { screen: 'Study' }) },
              ]);
            }
          }}
        />
      )}
      {connectivity !== 'online' ? (
        <Callout icon={WifiOff} tone="info" title="Offline" body="This lesson, its images, hints, and checks all work without internet." />
      ) : null}
    </Screen>
  );
}

function LessonBlockView({
  block,
  plan,
  installed,
  progress,
  remediation,
  onProgress,
}: {
  block: LessonBlock;
  plan: PresentationPlan;
  installed: InstalledV2Package;
  progress: LessonProgress;
  remediation: LessonBlock | null;
  onProgress: (next: LessonProgress) => void;
}) {
  const [hintsShown, setHintsShown] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<boolean | null>(null);
  const [reading, setReading] = useState(false);
  const canListen = Boolean(block.markdown) && (plan.showReadAloud || block.type === 'read-aloud' || plan.format === 'audio');

  async function listen() {
    if (reading) {
      await stopReading();
      setReading(false);
      return;
    }
    setReading(true);
    await readModuleAloud(markdownToPlainText(block.markdown || block.check?.prompt || '')).catch(() => undefined);
    setReading(false);
  }

  return (
    <Card accent={block.type === 'remediation' ? colors.warning : block.type === 'check' ? colors.secondary : colors.primary}>
      <CardHeader
        icon={block.type === 'check' ? CircleHelp : block.type === 'hints' ? Lightbulb : BookOpen}
        title={LESSON_BLOCK_LABELS[block.type]}
        subtitle={
          block.type === 'worked-example' && plan.expandWorkedExamples
            ? 'Take this one slowly, step by step.'
            : block.type === 'guided-practice' && plan.format === 'kinesthetic'
              ? 'Do this with your hands before reading on.'
              : undefined
        }
      />
      {block.image ? (
        <View style={styles.visual}>
          <Image
            source={{ uri: installedFileUri(installed, block.image.path) }}
            style={styles.visualImage}
            resizeMode="contain"
            accessibilityLabel={block.image.alt}
          />
          {block.image.caption ? <Text style={styles.captionText}>{block.image.caption}</Text> : null}
        </View>
      ) : null}
      {block.markdown && !block.check && !block.hints && !block.items ? (
        <ModuleMarkdown markdown={block.markdown} moduleDirectoryUri={installed.directoryUri} />
      ) : null}
      {canListen ? (
        <PrimaryButton label={reading ? 'Stop reading' : 'Read aloud'} icon={Volume2} tone="ghost" size="sm" onPress={() => void listen()} />
      ) : null}

      {block.hints ? (
        <View style={styles.stack}>
          {block.hints.slice(0, hintsShown).map((hint, index) => (
            <Text key={index} style={styles.bodyText}>
              {index + 1}. {hint}
            </Text>
          ))}
          {hintsShown < block.hints.length ? (
            <PrimaryButton
              label={`Show hint ${hintsShown + 1} of ${block.hints.length}`}
              icon={Lightbulb}
              tone="secondary"
              size="sm"
              onPress={() => {
                setHintsShown(hintsShown + 1);
                onProgress({ ...progress, hintsUsed: progress.hintsUsed + 1 });
              }}
            />
          ) : null}
        </View>
      ) : null}

      {block.check ? (
        <View style={styles.stack}>
          {plan.pauseBeforeChecks ? (
            <Callout icon={Clock3} tone="info" title="Take a breath" body="Read the question twice before you answer." />
          ) : null}
          <Text style={styles.prompt}>{block.check.prompt}</Text>
          {block.check.choices.length ? (
            block.check.choices.map((option, index) => (
              <Pressable
                key={index}
                accessibilityRole="radio"
                accessibilityState={{ selected: choice === index }}
                onPress={() => {
                  setChoice(index);
                  setResult(null);
                }}
                style={[styles.option, choice === index && styles.optionSelected]}
              >
                <Text style={styles.optionKey}>{CHOICE_LABELS[index] ?? index + 1}</Text>
                <Text style={styles.optionText}>{option.text}</Text>
              </Pressable>
            ))
          ) : (
            <TextInput
              value={typed}
              onChangeText={(value) => {
                setTyped(value);
                setResult(null);
              }}
              placeholder="Type your answer"
              placeholderTextColor={colors.inkSubtle}
              style={styles.input}
            />
          )}
          <PrimaryButton
            label="Check"
            icon={CheckCircle2}
            size="sm"
            disabled={block.check.choices.length ? choice === null : !typed.trim()}
            onPress={() => {
              const correct = checkAnswer(block, block.check!.choices.length ? choice! : typed);
              setResult(correct);
              onProgress({ ...progress, checkResults: { ...progress.checkResults, [block.id]: correct } });
            }}
          />
          {result === true ? (
            <Callout icon={CheckCircle2} tone="success" title="That's right" body={block.check.explanation || 'Nice reasoning.'} />
          ) : null}
          {result === false ? (
            <Callout
              icon={RotateCcw}
              tone="warning"
              title="Not yet"
              body={remediation ? 'Try the review below, then check again.' : 'Look back at the explanation and try again.'}
            />
          ) : null}
          {result === false && remediation ? (
            <ModuleMarkdown markdown={remediation.markdown} moduleDirectoryUri={installed.directoryUri} />
          ) : null}
        </View>
      ) : null}

      {block.items ? (
        <View style={styles.stack}>
          {block.items.map((item, index) => {
            const key = `${block.id}#${index}`;
            const done = progress.completedBlocks.includes(key);
            return (
              <Pressable
                key={key}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: done }}
                onPress={() =>
                  onProgress({
                    ...progress,
                    completedBlocks: done ? progress.completedBlocks.filter((value) => value !== key) : [...progress.completedBlocks, key],
                  })
                }
                style={[styles.option, done && styles.optionSelected]}
              >
                <CheckCircle2 size={20} color={done ? colors.success : colors.outlineStrong} />
                <Text style={styles.optionText}>{item}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Digital mini-quiz
   ──────────────────────────────────────────────────────────────────────── */

export function MiniQuizScreen({ navigation, route }: StackProps<'MiniQuiz'>) {
  const student = useSessionStore((state) => state.student);
  const [quiz, setQuiz] = useState<StudentQuiz | null>(null);
  const [session, setSession] = useState<QuizSession | null>(null);
  const [index, setIndex] = useState(0);
  const [responses, setResponses] = useState<QuizSession['responses']>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(Date.now());
  const shownAt = useRef(Date.now());
  const resumed = useRef(false);

  useEffect(() => {
    if (!student) return;
    void (async () => {
      try {
        const installed = await getStudentQuiz(route.params.quizId, route.params.version);
        if (!installed) throw new Error('This quiz is not on this device.');
        const started = await startOrResumeAttempt(student.id, route.params.quizId, route.params.version);
        if (started.status === 'submitted') {
          navigation.replace('MiniQuizResult', { attemptId: started.attemptId });
          return;
        }
        resumed.current = Object.keys(started.responses).length > 0;
        setQuiz(installed.quiz);
        setSession(started);
        setResponses(started.responses);
        setIndex(Math.min(started.currentIndex, installed.quiz.questions.length - 1));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'The quiz could not start.');
      }
    })();
  }, [navigation, route.params.quizId, route.params.version, student]);

  const question = quiz?.questions[index];

  const recordTime = useCallback(
    (current: QuizSession['responses']) => {
      if (!question) return current;
      const elapsed = Date.now() - shownAt.current;
      shownAt.current = Date.now();
      const entry = current[question.id] ?? { answer: '', elapsedMs: 0 };
      return { ...current, [question.id]: { ...entry, elapsedMs: entry.elapsedMs + elapsed } };
    },
    [question],
  );

  useEffect(() => {
    if (!session?.deadlineAt) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [session?.deadlineAt]);

  const submit = useCallback(async () => {
    if (!session) return;
    setSubmitting(true);
    try {
      const timed = recordTime(responses);
      await saveAttemptProgress(session.attemptId, timed, index);
      const done = await submitAttempt(session.attemptId);
      navigation.replace('MiniQuizResult', { attemptId: done.attemptId });
    } catch (caught) {
      Alert.alert('Quiz not saved', caught instanceof Error ? caught.message : 'Please try again.');
      setSubmitting(false);
    }
  }, [index, navigation, recordTime, responses, session]);

  useEffect(() => {
    if (session?.deadlineAt && now >= session.deadlineAt && !submitting) void submit();
  }, [now, session?.deadlineAt, submit, submitting]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && session) void saveAttemptProgress(session.attemptId, recordTime(responses), index);
    });
    return () => subscription.remove();
  }, [index, recordTime, responses, session]);

  if (error) {
    return (
      <Screen>
        <ScreenHeader title="Mini-quiz" onBack={navigation.goBack} />
        <Callout icon={XCircle} tone="warning" title="This quiz cannot start" body={error} />
      </Screen>
    );
  }
  if (!quiz || !session || !question) {
    return (
      <Screen>
        <ScreenHeader title="Preparing quiz…" onBack={navigation.goBack} />
        <Skeleton width="100%" height={200} />
      </Screen>
    );
  }

  const answer = responses[question.id]?.answer ?? '';
  const locked = quiz.policy.feedback === 'immediate' && checked[question.id] !== undefined;
  const setAnswer = (value: string) => {
    if (locked) return;
    const next = { ...responses, [question.id]: { answer: value, elapsedMs: responses[question.id]?.elapsedMs ?? 0 } };
    setResponses(next);
    void saveAttemptProgress(session.attemptId, next, index);
  };
  const go = (target: number) => {
    const timed = recordTime(responses);
    setResponses(timed);
    void saveAttemptProgress(session.attemptId, timed, target);
    setIndex(target);
  };
  const unanswered = quiz.questions.filter((item) => !responses[item.id]?.answer.trim()).length;
  const remaining = session.deadlineAt ? Math.max(0, Math.ceil((session.deadlineAt - now) / 1000)) : null;
  const choices = question.kind === 'true_false' || question.kind === 'multiple_choice' ? question.choices : null;

  return (
    <Screen>
      <ScreenHeader
        overline={`Question ${index + 1} of ${quiz.questions.length} · attempt ${session.attemptNumber}`}
        title={quiz.title}
        onBack={navigation.goBack}
        action={
          remaining !== null ? (
            <StatusBadge label={`${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`} status={remaining < 60 ? 'notStarted' : 'inProgress'} />
          ) : undefined
        }
      />
      {resumed.current ? (
        <Callout icon={RotateCcw} tone="info" title="Picked up where you left off" body="Your earlier answers were saved on this device." />
      ) : null}
      <ProgressBar value={(index + 1) / quiz.questions.length} accessibilityLabel={`Question ${index + 1} of ${quiz.questions.length}`} />

      <Card accent={colors.secondary}>
        <Text style={styles.caption}>
          {question.points} point{question.points === 1 ? '' : 's'} · {question.topic}
        </Text>
        <Text style={styles.prompt}>{question.prompt}</Text>
      </Card>

      {choices ? (
        <View style={styles.stack}>
          {choices.map((choice, choiceIndex) => (
            <Pressable
              key={choice}
              accessibilityRole="radio"
              accessibilityState={{ selected: answer === choice, disabled: locked }}
              onPress={() => setAnswer(choice)}
              style={[styles.option, answer === choice && styles.optionSelected]}
            >
              <Text style={styles.optionKey}>{question.kind === 'true_false' ? (choiceIndex === 0 ? 'T' : 'F') : CHOICE_LABELS[choiceIndex]}</Text>
              <Text style={styles.optionText}>{choice}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <TextInput
          value={answer}
          editable={!locked}
          onChangeText={setAnswer}
          placeholder={question.kind === 'fill_in_the_blank' ? 'Fill in the blank' : 'Type your answer'}
          placeholderTextColor={colors.inkSubtle}
          style={styles.input}
          autoCapitalize="none"
        />
      )}

      {quiz.policy.feedback === 'immediate' ? (
        checked[question.id] === undefined ? (
          <PrimaryButton
            label="Check answer"
            icon={CheckCircle2}
            tone="secondary"
            disabled={!answer.trim()}
            onPress={() => setChecked({ ...checked, [question.id]: gradeStudentAnswer(quiz, question, answer) === 'correct' })}
          />
        ) : (
          <Callout
            icon={checked[question.id] ? CheckCircle2 : XCircle}
            tone={checked[question.id] ? 'success' : 'warning'}
            title={checked[question.id] ? 'Correct' : 'Not quite'}
            body={
              checked[question.id]
                ? 'Keep going.'
                : question.reveal
                  ? `Answer: ${question.reveal.answer}. ${question.reveal.rationale}`
                  : 'Your teacher will review this one with you.'
            }
          />
        )
      ) : null}

      <View style={styles.footerRow}>
        <View style={styles.flex}>
          <PrimaryButton label="Previous" icon={ChevronLeft} tone="secondary" disabled={index === 0} onPress={() => go(index - 1)} />
        </View>
        <View style={styles.flex}>
          {index < quiz.questions.length - 1 ? (
            <PrimaryButton label="Next" icon={ChevronRight} onPress={() => go(index + 1)} />
          ) : (
            <PrimaryButton
              label="Submit"
              icon={CheckCircle2}
              loading={submitting}
              onPress={() =>
                unanswered
                  ? Alert.alert('Submit now?', `${unanswered} question${unanswered === 1 ? ' is' : 's are'} still blank.`, [
                      { text: 'Keep working', style: 'cancel' },
                      { text: 'Submit', onPress: () => void submit() },
                    ])
                  : void submit()
              }
            />
          )}
        </View>
      </View>
      <Text style={styles.captionText}>Answers save on this device after every change. No internet is needed.</Text>
    </Screen>
  );
}

export function MiniQuizResultScreen({ navigation, route }: StackProps<'MiniQuizResult'>) {
  const student = useSessionStore((state) => state.student);
  const [session, setSession] = useState<QuizSession | null>(null);
  const [quiz, setQuiz] = useState<StudentQuiz | null>(null);
  const [retake, setRetake] = useState<StudentQuizSummary['retake'] | null>(null);

  useEffect(() => {
    void (async () => {
      const found = await getSession(route.params.attemptId);
      if (!found) return;
      const installed = await getStudentQuiz(found.quizId, found.quizVersion);
      setSession(found);
      setQuiz(installed?.quiz ?? null);
      if (student) {
        const summary = (await listStudentQuizzes(student.id)).find(
          (item) => item.quiz.quizId === found.quizId && item.quiz.version === found.quizVersion,
        );
        setRetake(summary?.retake ?? null);
      }
    })();
  }, [route.params.attemptId, student]);

  if (!session?.scored || !quiz) {
    return (
      <Screen>
        <ScreenHeader title="Result" onBack={navigation.goBack} />
        <Skeleton width="100%" height={160} />
      </Screen>
    );
  }
  const { scored } = session;
  const showItems = quiz.policy.feedback !== 'score_only';
  return (
    <Screen>
      {scored.percent >= quiz.policy.masteryPercent ? <Celebrate trigger={1} /> : null}
      <ScreenHeader overline={`Attempt ${session.attemptNumber}`} title={quiz.title} onBack={() => navigation.navigate('StudentTabs', { screen: 'Modules' })} />
      <Card>
        <Text style={styles.score}>{scored.percent}%</Text>
        <Text style={styles.bodyText}>
          {scored.score} of {scored.total} points · {scored.correctCount} of {scored.items.length} questions correct
        </Text>
        <ProgressBar value={scored.percent / 100} accessibilityLabel={`Score ${scored.percent} percent`} />
        <Text style={styles.captionText}>
          {scored.percent >= quiz.policy.masteryPercent ? 'Mastery reached.' : `Mastery is ${quiz.policy.masteryPercent}%. Review the questions below.`}
        </Text>
      </Card>

      <PrimaryButton label="Show result QR" icon={QrCode} onPress={() => navigation.navigate('ResultQr', { attemptId: session.attemptId })} />

      {showItems ? (
        <>
          <SectionHeader title="Question review" caption={quiz.policy.revealAnswers ? 'Answers shown as your teacher allowed' : 'Your teacher will go over missed items'} />
          {scored.items.map((item) => {
            const question = quiz.questions.find((candidate) => candidate.id === item.questionId);
            return (
              <Card key={item.questionId} accent={item.outcome === 'correct' ? colors.success : colors.coral}>
                <View style={styles.rowBetween}>
                  <Text style={styles.caption}>Question {item.position}</Text>
                  <StatusBadge
                    label={item.outcome === 'correct' ? 'Correct' : item.outcome === 'unanswered' ? 'Blank' : 'Review'}
                    status={item.outcome === 'correct' ? 'completed' : 'inProgress'}
                  />
                </View>
                <Text style={styles.bodyText}>{question?.prompt}</Text>
                {item.outcome !== 'correct' && question?.reveal ? (
                  <Text style={styles.reveal}>
                    Answer: {question.reveal.answer}
                    {question.reveal.rationale ? ` — ${question.reveal.rationale}` : ''}
                  </Text>
                ) : null}
              </Card>
            );
          })}
        </>
      ) : (
        <Callout icon={ShieldCheck} tone="info" title="Score only" body="Your teacher chose to review the questions in class." />
      )}

      {retake?.allowed ? (
        <PrimaryButton
          label="Try again"
          icon={RotateCcw}
          tone="secondary"
          onPress={() => navigation.replace('MiniQuiz', { quizId: quiz.quizId, version: quiz.version })}
        />
      ) : retake ? (
        <Text style={styles.captionText}>{retakeMessage(retake.reason)}</Text>
      ) : null}
    </Screen>
  );
}

export function ResultQrScreen({ navigation, route }: StackProps<'ResultQr'>) {
  const [codes, setCodes] = useState<string[]>([]);
  const [part, setPart] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    void resultQrForAttempt(route.params.attemptId)
      .then(setCodes)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'The result QR could not be made.'));
  }, [route.params.attemptId]);

  return (
    <Screen>
      <ScreenHeader overline="Show your teacher" title="Result QR" onBack={navigation.goBack} />
      {error ? <Callout icon={XCircle} tone="error" title="QR unavailable" body={error} /> : null}
      <Card style={styles.qrCard}>
        {codes[part] ? (
          <View style={styles.qrFrame}>
            <QRCode value={codes[part]} size={260} ecl="M" />
          </View>
        ) : !error ? (
          <Skeleton width="100%" height={260} />
        ) : null}
        {codes.length > 1 ? <Text style={styles.caption}>Code {part + 1} of {codes.length}</Text> : null}
      </Card>
      {codes.length > 1 ? (
        <View style={styles.footerRow}>
          <View style={styles.flex}>
            <PrimaryButton label="Previous" icon={ChevronLeft} tone="secondary" disabled={part === 0} onPress={() => setPart(part - 1)} />
          </View>
          <View style={styles.flex}>
            <PrimaryButton label="Next" icon={ChevronRight} disabled={part === codes.length - 1} onPress={() => setPart(part + 1)} />
          </View>
        </View>
      ) : null}
      <Callout
        icon={ShieldCheck}
        tone="info"
        title="What this code contains"
        body="Your class ID, the quiz version, your score, and which question numbers to review. It never contains answers, questions, or anything about your family. It is signed by this device."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  section: { gap: spacing.md, marginBottom: spacing.md },
  stack: { gap: spacing.sm },
  footerRow: { flexDirection: 'row', gap: spacing.md },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  whyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  whyTitle: { ...text.bodyStrong, color: colors.ink, flex: 1 },
  whyLink: { ...text.label, color: colors.primary, fontWeight: '800' },
  whyBody: { gap: spacing.sm },
  bodyText: { ...text.body, color: colors.ink },
  caption: { ...text.caption, color: colors.inkMuted, fontWeight: '700' },
  captionText: { ...text.caption, color: colors.inkMuted, fontWeight: '500' },
  prompt: { ...text.title, color: colors.ink },
  option: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.outline,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  optionKey: { ...text.label, color: colors.primary, fontWeight: '800', width: 22, textAlign: 'center' },
  optionText: { ...text.body, color: colors.ink, flex: 1 },
  input: {
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: colors.outline,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.ink,
    paddingHorizontal: spacing.md,
    fontSize: 17,
  },
  visual: { gap: spacing.xs },
  visualImage: { width: '100%', height: 220, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  score: { ...text.display, color: colors.primary },
  reveal: { ...text.bodySm, color: colors.success, fontWeight: '700' },
  qrCard: { alignItems: 'center', gap: spacing.md },
  qrFrame: { padding: spacing.md, backgroundColor: colors.white, borderRadius: radius.md },
});
