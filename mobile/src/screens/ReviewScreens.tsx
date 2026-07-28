import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  BookOpen,
  Brain,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Layers,
  Lightbulb,
  ListChecks,
  Minus,
  Pause,
  PencilLine,
  Play,
  Plus,
  Share2,
  Shuffle,
  Sparkles,
  Square,
  Target,
  Timer,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react-native';
import {
  Callout,
  Card,
  CardHeader,
  Chip,
  Divider,
  EmptyState,
  GradientView,
  HeroCard,
  IconPlate,
  ListRow,
  PrimaryButton,
  ProgressBar,
  RingProgress,
  Row,
  Screen,
  ScreenHeader,
  SectionHeader,
  StatTile,
  TileGrid,
  useCompactViewport,
} from '@/components/ui';
import { MascotPanel } from '@/components/mascot';
import {
  createPomodoroForStudent,
  generateParentDigest,
  listCustomReviewSets,
  listDueReviewItems,
  listReviewItems,
  reviewItem,
  saveCustomReviewSet,
  savePomodoroSession,
} from '@/data/mvpRepository';
import type {
  CustomReviewSet,
  DueReviewItem,
  ParentDigest,
  PomodoroSession,
  ReviewImportance,
  ReviewItem,
  StudyTechnique,
} from '@/domain/types';
import type { RootStackParamList } from '@/navigation/types';
import { useSessionStore } from '@/store/session';
import { deliverParentDigest, type DigestDelivery } from '@/services/parentDigest';
import {
  colors,
  elevation,
  gradients,
  radius,
  spacing,
  text,
} from '@/theme/tokens';
import { capitalize, formatDate, formatDateRange } from '@/utils/format';

type ReviewProps = NativeStackScreenProps<RootStackParamList, 'ReviewHub'>;
type CustomProps = NativeStackScreenProps<RootStackParamList, 'CustomReviewSets'>;
type DigestProps = NativeStackScreenProps<RootStackParamList, 'ParentDigest'>;

type TechniqueMeta = {
  key: StudyTechnique;
  label: string;
  icon: LucideIcon;
  color: string;
  /** One line on why the technique works — the evidence, not the marketing. */
  why: string;
  /** One line on how to run it inside this app, right now. */
  how: string;
  action: string;
};

const TECHNIQUES: TechniqueMeta[] = [
  {
    key: 'active-recall',
    label: 'Active recall',
    icon: Brain,
    color: colors.primary,
    why: 'Pulling an answer out of memory strengthens it far more than reading it again.',
    how: 'Read the prompt, answer it in your head, then reveal the reference and rate how well you knew it.',
    action: 'Practice recall',
  },
  {
    key: 'retrieval-quiz',
    label: 'Retrieval quiz',
    icon: ListChecks,
    color: colors.secondary,
    why: 'Writing an answer with no cues gives you an honest measure of what you actually know.',
    how: 'Type an answer for every due item, then submit the whole set for a scored breakdown.',
    action: 'Start a quiz',
  },
  {
    key: 'interleaved',
    label: 'Interleaved practice',
    icon: Shuffle,
    color: colors.accentText,
    why: 'Mixing topics forces you to choose the right method — the part a test really measures.',
    how: 'Work the queue in the mixed order it arrives; resist the urge to group by subject.',
    action: 'Mix the queue',
  },
  {
    key: 'blurting',
    label: 'Blurting',
    icon: PencilLine,
    color: colors.success,
    why: 'Emptying everything you remember onto the page exposes the gaps you would otherwise skip.',
    how: 'Write all you recall about the concept, then compare it line by line with the reference.',
    action: 'Start blurting',
  },
];

const IMPORTANCE_OPTIONS: Array<{ value: ReviewImportance; label: string }> = [
  { value: 'core', label: 'Core' },
  { value: 'supplementary', label: 'Supplementary' },
  { value: 'stretch', label: 'Stretch' },
];

const TIME_TREND: Record<
  ParentDigest['timeTrend'],
  { label: string; icon: LucideIcon; color: string; note: string }
> = {
  up: {
    label: 'Increasing',
    icon: TrendingUp,
    color: colors.success,
    note: 'More study time than last week',
  },
  steady: {
    label: 'Steady',
    icon: Minus,
    color: colors.secondary,
    note: 'About the same as last week',
  },
  down: {
    label: 'Decreasing',
    icon: TrendingDown,
    color: colors.warning,
    note: 'Less study time than last week',
  },
  'not-enough-data': {
    label: 'New',
    icon: Sparkles,
    color: colors.primary,
    note: 'Not enough history to compare yet',
  },
};

/* ────────────────────────────────────────────────────────────────────────
   Review hub — the study-techniques heart of the app
   ──────────────────────────────────────────────────────────────────────── */

export function ReviewHubScreen({ navigation }: ReviewProps) {
  const student = useSessionStore((state) => state.student);
  const compact = useCompactViewport();
  const [technique, setTechnique] = useState<StudyTechnique>('active-recall');
  const [items, setItems] = useState<DueReviewItem[]>([]);
  const [sets, setSets] = useState<CustomReviewSet[]>([]);
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [writtenAnswer, setWrittenAnswer] = useState('');
  const [retrievalAnswers, setRetrievalAnswers] = useState<Record<string, string>>({});
  const [retrievalResult, setRetrievalResult] = useState<number | null>(null);
  const [pomodoro, setPomodoro] = useState<PomodoroSession | null>(null);
  const [workMinutes, setWorkMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [cyclesPlanned, setCyclesPlanned] = useState(4);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [timerPhase, setTimerPhase] = useState<'work' | 'break'>('work');
  const [timerRunning, setTimerRunning] = useState(false);
  const itemStartedAt = useRef(Date.now());

  const load = useCallback(async () => {
    if (!student) return;
    const [nextItems, nextSets] = await Promise.all([
      listDueReviewItems(student.id),
      listCustomReviewSets(`student:${student.id}`),
    ]);
    setItems(nextItems);
    setSets(nextSets);
    setIndex(0);
    setRevealed(false);
    setWrittenAnswer('');
    itemStartedAt.current = Date.now();
  }, [student]);

  useEffect(() => void load(), [load]);
  useEffect(() => {
    if (!pomodoro || !timerRunning || secondsLeft <= 0) return;
    const timer = setInterval(
      () => setSecondsLeft((value) => Math.max(0, value - 1)),
      1_000,
    );
    return () => clearInterval(timer);
  }, [pomodoro, secondsLeft, timerRunning]);

  useEffect(() => {
    if (!pomodoro || !timerRunning || secondsLeft !== 0) return;
    if (timerPhase === 'work') {
      setTimerPhase('break');
      setSecondsLeft(pomodoro.breakMinutes * 60);
      return;
    }

    const completedCycles = Math.min(
      pomodoro.cyclesPlanned,
      pomodoro.completedCycles + 1,
    );
    const nextSession = { ...pomodoro, completedCycles };
    setPomodoro(nextSession);
    void savePomodoroSession(nextSession);
    if (completedCycles >= pomodoro.cyclesPlanned) {
      setTimerRunning(false);
      return;
    }
    setTimerPhase('work');
    setSecondsLeft(pomodoro.workMinutes * 60);
  }, [pomodoro, secondsLeft, timerPhase, timerRunning]);

  const queue = useMemo(() => {
    const selectedSet = sets.find((set) => set.setId === activeSetId);
    const allowed = selectedSet
      ? new Set([
          ...selectedSet.itemIds,
          ...selectedSet.createdItems.map((item) => item.itemId),
        ])
      : null;
    const available = allowed
      ? items.filter((item) => allowed.has(item.itemId))
      : items;
    if (!pomodoro) return available;
    const byId = new Map(available.map((item) => [item.itemId, item]));
    return pomodoro.queueSnapshot.flatMap((id) => {
      const item = byId.get(id);
      return item ? [item] : [];
    });
  }, [activeSetId, items, pomodoro, sets]);
  const current = queue[index];

  function changeTechnique(next: StudyTechnique) {
    setTechnique(next);
    setIndex(0);
    setRevealed(false);
    setWrittenAnswer('');
    setRetrievalAnswers({});
    setRetrievalResult(null);
    itemStartedAt.current = Date.now();
  }

  async function grade(quality: 0 | 1 | 2 | 3 | 4 | 5) {
    if (!student || !current) return;
    const elapsedSeconds = Math.max(1, Math.round((Date.now() - itemStartedAt.current) / 1_000));
    await reviewItem({
      studentId: student.id,
      itemId: current.itemId,
      quality,
      elapsedSeconds,
      technique,
    });
    if (pomodoro) {
      const nextSession: PomodoroSession = {
        ...pomodoro,
        itemLog: [
          ...pomodoro.itemLog,
          {
            itemId: current.itemId,
            result: quality >= 3 ? 'recalled' : 'forgot',
            timeSeconds: elapsedSeconds,
          },
        ],
      };
      setPomodoro(nextSession);
      await savePomodoroSession(nextSession);
    }
    setIndex((value) => value + 1);
    setRevealed(false);
    setWrittenAnswer('');
    itemStartedAt.current = Date.now();
  }

  async function nextRetrieval() {
    if (!current || !writtenAnswer.trim()) return;
    const nextAnswers = { ...retrievalAnswers, [current.itemId]: writtenAnswer.trim() };
    setRetrievalAnswers(nextAnswers);
    setWrittenAnswer('');
    if (index < queue.length - 1) {
      setIndex((value) => value + 1);
      itemStartedAt.current = Date.now();
      return;
    }
    if (!student) return;
    let correct = 0;
    for (const item of queue) {
      const matches =
        (nextAnswers[item.itemId] ?? '').trim().toLocaleLowerCase() ===
        item.answer.trim().toLocaleLowerCase();
      if (matches) correct += 1;
      await reviewItem({
        studentId: student.id,
        itemId: item.itemId,
        quality: matches ? 4 : 1,
        elapsedSeconds: 1,
        technique: 'retrieval-quiz',
      });
    }
    setRetrievalResult(correct);
  }

  async function startPomodoro() {
    if (!student) return;
    const session = await createPomodoroForStudent({
      studentId: student.id,
      workMinutes,
      breakMinutes,
      cyclesPlanned,
    });
    setPomodoro(session);
    setSecondsLeft(session.workMinutes * 60);
    setTimerPhase('work');
    setTimerRunning(true);
    setIndex(0);
    itemStartedAt.current = Date.now();
  }

  function stopPomodoro() {
    setPomodoro(null);
    setTimerRunning(false);
    setTimerPhase('work');
    setSecondsLeft(workMinutes * 60);
  }

  if (!student) {
    return <EmptyState title="Student sign-in required" body="Sign in to open the review queue." />;
  }

  const activeTechnique =
    TECHNIQUES.find((option) => option.key === technique) ?? TECHNIQUES[0]!;
  const activeSet = sets.find((set) => set.setId === activeSetId) ?? null;
  const reviewed = Math.min(index, queue.length);
  const sessionProgress = queue.length > 0 ? reviewed / queue.length : 0;
  const phaseSeconds = pomodoro
    ? (timerPhase === 'work' ? pomodoro.workMinutes : pomodoro.breakMinutes) * 60
    : 0;
  const phaseProgress =
    phaseSeconds > 0 ? (phaseSeconds - secondsLeft) / phaseSeconds : 0;

  return (
    <Screen>
      <ScreenHeader
        overline="Study techniques"
        title="Review hub"
        subtitle="Evidence-based practice, built around what you are due to revisit."
        onBack={navigation.goBack}
      />

      <HeroCard>
        <Row align="flex-start" gap={spacing.lg}>
          <View style={styles.flex}>
            <Text style={styles.heroEyebrow}>DUE TODAY</Text>
            <Text style={[styles.heroNumber, compact && styles.heroNumberCompact]}>
              {items.length}
            </Text>
            <Text style={styles.heroBody}>
              {items.length === 0
                ? 'Nothing is scheduled right now — finish a lesson and new items will appear here.'
                : `${items.length === 1 ? 'Item' : 'Items'} scheduled to return just before you would forget them.`}
            </Text>
          </View>
          <RingProgress
            value={sessionProgress}
            size={compact ? 78 : 92}
            color={colors.accent}
            accessibilityLabel={`Session progress: ${reviewed} of ${queue.length} reviewed`}
          >
            <Text style={styles.ringValue}>{reviewed}</Text>
            <Text style={styles.ringLabel}>of {queue.length}</Text>
          </RingProgress>
        </Row>
        <View style={styles.heroRule} />
        <Row wrap gap={spacing.sm}>
          <HeroPill icon={activeTechnique.icon} label={activeTechnique.label} />
          <HeroPill icon={Layers} label={activeSet ? activeSet.title : 'All due items'} />
        </Row>
      </HeroCard>

      <SectionHeader
        title="Study techniques"
        caption="Pick the one that fits this session — each changes how the queue is presented."
      />
      {TECHNIQUES.map((option) => (
        <TechniqueCard
          key={option.key}
          option={option}
          selected={technique === option.key}
          onPress={() => changeTechnique(option.key)}
        />
      ))}

      <SectionHeader
        title="Review sets"
        caption="Group the items you keep forgetting."
        actionLabel="Manage"
        onAction={() => navigation.navigate('CustomReviewSets')}
      />
      <Card>
        <CardHeader
          icon={Layers}
          title="Custom review sets"
          subtitle="Narrow the queue to one topic"
          color={colors.accentText}
        />
        <Text style={styles.rationale}>
          Practicing a single tricky topic in one block is how you close a specific gap — the
          mixed queue is better once the gap is closed.
        </Text>
        <View style={styles.howBlock}>
          <Text style={styles.howLabel}>How to use it here</Text>
          <Text style={styles.howBody}>
            Choose a set below to filter today's queue, or build a new one from your own prompts.
          </Text>
        </View>
        {sets.length > 0 ? (
          <View style={styles.chipRow}>
            <Chip
              label="All due"
              selected={activeSetId === null}
              onPress={() => {
                setActiveSetId(null);
                setIndex(0);
              }}
            />
            {sets.map((set) => (
              <Chip
                key={set.setId}
                label={set.title}
                selected={activeSetId === set.setId}
                onPress={() => {
                  setActiveSetId(set.setId);
                  setIndex(0);
                }}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.helper}>
            You have no sets yet — the queue is showing everything that is due.
          </Text>
        )}
        <PrimaryButton
          label="Custom review sets"
          icon={PencilLine}
          tone="secondary"
          onPress={() => navigation.navigate('CustomReviewSets')}
        />
      </Card>

      <SectionHeader
        title="Focus timer"
        caption="Short timed blocks with real breaks between them."
      />
      {!pomodoro ? (
        <Card>
          <CardHeader
            icon={Timer}
            title="Study timer"
            subtitle="Work and break cycles, paired with any technique"
            color={colors.coral}
          />
          <Text style={styles.rationale}>
            Attention fades long before motivation does — a fixed block, then a real break, keeps
            the second half of a session as sharp as the first.
          </Text>
          <View style={styles.howBlock}>
            <Text style={styles.howLabel}>How to use it here</Text>
            <Text style={styles.howBody}>
              Set the block length, then review as normal — each graded item is logged against
              the session.
            </Text>
          </View>
          <Divider />
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Work</Text>
            <View style={styles.chipRow}>
              {[15, 25, 35].map((minutes) => (
                <Chip
                  key={minutes}
                  label={`${minutes} min`}
                  selected={workMinutes === minutes}
                  onPress={() => setWorkMinutes(minutes)}
                />
              ))}
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Break</Text>
            <View style={styles.chipRow}>
              {[5, 10, 15].map((minutes) => (
                <Chip
                  key={minutes}
                  label={`${minutes} min`}
                  selected={breakMinutes === minutes}
                  onPress={() => setBreakMinutes(minutes)}
                />
              ))}
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Cycles</Text>
            <View style={styles.chipRow}>
              {[1, 2, 4].map((cycles) => (
                <Chip
                  key={cycles}
                  label={`${cycles} ${cycles === 1 ? 'cycle' : 'cycles'}`}
                  selected={cyclesPlanned === cycles}
                  onPress={() => setCyclesPlanned(cycles)}
                />
              ))}
            </View>
          </View>
          <PrimaryButton label="Start timer" icon={Timer} onPress={() => void startPomodoro()} />
        </Card>
      ) : (
        <GradientView ramp={gradients.night} style={styles.timerCard}>
          <Row align="center" gap={spacing.lg}>
            <RingProgress
              value={phaseProgress}
              size={compact ? 84 : 96}
              color={timerPhase === 'work' ? colors.accent : colors.gradientStart}
              accessibilityLabel={`${timerPhase === 'work' ? 'Work' : 'Break'} phase progress`}
            >
              <Clock3 size={22} color={colors.onBrandMuted} />
            </RingProgress>
            <View style={styles.flex}>
              <Text style={styles.heroEyebrow}>
                {timerPhase === 'work' ? 'WORK TIME' : 'BREAK TIME'}
              </Text>
              <Text style={styles.timerClock}>{formatClock(secondsLeft)}</Text>
              <Text style={styles.heroBody}>
                Cycle {Math.min(pomodoro.cyclesPlanned, pomodoro.completedCycles + 1)} of{' '}
                {pomodoro.cyclesPlanned}
                {timerRunning ? '' : ' — paused'}
              </Text>
            </View>
          </Row>
          <View style={styles.heroRule} />
          <View style={styles.timerActions}>
            <View style={styles.flex}>
              <PrimaryButton
                label={timerRunning ? 'Pause' : 'Resume'}
                icon={timerRunning ? Pause : Play}
                tone="secondary"
                onPress={() => setTimerRunning((value) => !value)}
              />
            </View>
            <View style={styles.flex}>
              <PrimaryButton
                label="End timer"
                icon={Square}
                tone="danger"
                onPress={stopPomodoro}
              />
            </View>
          </View>
        </GradientView>
      )}

      <SectionHeader
        title="Your queue"
        caption={
          queue.length > 0
            ? `${activeTechnique.label} · ${queue.length} ${queue.length === 1 ? 'item' : 'items'} in this session`
            : 'Nothing waiting in this session'
        }
      />
      {retrievalResult !== null ? (
        <Card accent={colors.success}>
          <CardHeader
            icon={CheckCircle2}
            title="Retrieval complete"
            subtitle="Every answer has been graded and rescheduled"
            color={colors.success}
          />
          <Row align="center" gap={spacing.md}>
            <Text style={styles.scoreText}>
              {retrievalResult}
              <Text style={styles.scoreTotal}>/{queue.length}</Text>
            </Text>
            <View style={styles.flex}>
              <ProgressBar
                value={queue.length > 0 ? retrievalResult / queue.length : 0}
                height={10}
                accessibilityLabel={`Scored ${retrievalResult} of ${queue.length}`}
              />
              <Text style={styles.helper}>Correct on the first attempt</Text>
            </View>
          </Row>
          {queue.map((item, position) => {
            const given = retrievalAnswers[item.itemId] ?? '';
            const matched =
              given.trim().toLocaleLowerCase() === item.answer.trim().toLocaleLowerCase();
            return (
              <View key={item.itemId} style={styles.answerReview}>
                {position > 0 ? <Divider style={styles.reviewDivider} /> : null}
                <Text style={styles.reviewPrompt}>{item.prompt}</Text>
                <Text style={styles.reviewGiven}>Your answer: {given || '—'}</Text>
                <Text style={[styles.reviewReference, matched && styles.reviewReferenceOk]}>
                  Reference: {item.answer}
                </Text>
              </View>
            );
          })}
        </Card>
      ) : !current ? (
        <EmptyState
          expression="happy"
          title="Review complete"
          body="The next due items will appear here automatically — spacing them out is what makes them stick."
        />
      ) : (
        <Card accent={activeTechnique.color}>
          <View style={styles.rowBetween}>
            <Chip label={friendlyConcept(current)} size="sm" />
            <Text style={styles.counter}>
              {index + 1} / {queue.length}
            </Text>
          </View>
          <ProgressBar
            value={queue.length > 0 ? (index + 1) / queue.length : 0}
            height={6}
            accessibilityLabel={`Item ${index + 1} of ${queue.length}`}
          />
          {technique === 'blurting' ? (
            <>
              <Text style={styles.promptEyebrow}>WRITE EVERYTHING YOU RECALL</Text>
              <Text style={styles.prompt}>{friendlyConcept(current)}</Text>
              <Field
                label="Your explanation"
                value={writtenAnswer}
                onChangeText={setWrittenAnswer}
                placeholder="Everything you remember about this concept"
                multiline
              />
              {revealed ? (
                <Callout
                  icon={BookOpen}
                  tone="success"
                  title="Reference answer"
                  body={current.answer}
                />
              ) : null}
              {!revealed ? (
                <PrimaryButton
                  label="Compare with reference"
                  icon={BookOpen}
                  onPress={() => setRevealed(true)}
                />
              ) : (
                <RatingRow onGrade={(quality) => void grade(quality)} />
              )}
            </>
          ) : technique === 'retrieval-quiz' ? (
            <>
              <Text style={styles.promptEyebrow}>ANSWER FROM MEMORY</Text>
              <Text style={styles.prompt}>{current.prompt}</Text>
              <Field
                label="Your answer"
                value={writtenAnswer}
                onChangeText={setWrittenAnswer}
                placeholder="Type your answer"
                hint="Answers are scored once the whole set is submitted."
              />
              <PrimaryButton
                label={index === queue.length - 1 ? 'Submit full set' : 'Next item'}
                icon={index === queue.length - 1 ? CheckCircle2 : ChevronRight}
                disabled={!writtenAnswer.trim()}
                onPress={() => void nextRetrieval()}
              />
            </>
          ) : (
            <>
              <Text style={styles.promptEyebrow}>
                {technique === 'interleaved' ? 'MIXED QUEUE' : 'RECALL THIS'}
              </Text>
              <Text style={styles.prompt}>{current.prompt}</Text>
              {revealed ? (
                <Callout
                  icon={BookOpen}
                  tone="success"
                  title="Reference answer"
                  body={current.answer}
                />
              ) : null}
              {!revealed ? (
                <PrimaryButton
                  label="Reveal answer"
                  icon={Sparkles}
                  onPress={() => setRevealed(true)}
                />
              ) : (
                <RatingRow onGrade={(quality) => void grade(quality)} />
              )}
            </>
          )}
        </Card>
      )}
    </Screen>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Custom review sets
   ──────────────────────────────────────────────────────────────────────── */

export function CustomReviewSetsScreen({ navigation }: CustomProps) {
  const student = useSessionStore((state) => state.student);
  const role = useSessionStore((state) => state.role);
  const [sets, setSets] = useState<CustomReviewSet[]>([]);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState('');
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [conceptId, setConceptId] = useState('');
  const [importance, setImportance] = useState<ReviewImportance>('core');
  const authorId = student
    ? `student:${student.id}`
    : role === 'teacher'
      ? 'teacher:local-teacher'
      : null;

  const load = useCallback(async () => {
    if (!authorId) return;
    const [nextSets, nextItems] = await Promise.all([
      listCustomReviewSets(authorId),
      listReviewItems(),
    ]);
    setSets(nextSets);
    setItems(nextItems);
  }, [authorId]);

  useEffect(() => void load(), [load]);

  function toggleItem(itemId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  async function save() {
    if (!authorId || !title.trim()) {
      Alert.alert('Title required', 'Name this review set before saving.');
      return;
    }
    const hasCreatedItem = prompt.trim() && answer.trim() && conceptId.trim();
    if (selected.size === 0 && !hasCreatedItem) {
      Alert.alert('Add review content', 'Pick an item or complete the new-item fields.');
      return;
    }
    await saveCustomReviewSet({
      createdBy: authorId,
      title,
      itemIds: [...selected],
      createdItem: hasCreatedItem
        ? { prompt, answer, conceptId, importance }
        : undefined,
    });
    setTitle('');
    setPrompt('');
    setAnswer('');
    setConceptId('');
    setSelected(new Set());
    await load();
  }

  const visibleItems = items.slice(0, 12);

  return (
    <Screen>
      <ScreenHeader
        overline="Review sets"
        title="Custom review sets"
        subtitle="Build a focused queue from the prompts you keep getting wrong."
        onBack={navigation.goBack}
      />

      <Callout
        icon={Lightbulb}
        tone="info"
        title="A good set is small and specific"
        body="Six to ten prompts on one topic beats a long mixed list — you can finish it in a sitting, and the queue stays honest."
      />

      <SectionHeader
        title="Your sets"
        caption={
          sets.length > 0
            ? `${sets.length} ${sets.length === 1 ? 'set' : 'sets'} saved on this device`
            : 'Nothing saved yet'
        }
      />
      {sets.length === 0 ? (
        <EmptyState
          title="No sets yet"
          body="Name a set below, tick the prompts you want in it, and it will appear here."
        />
      ) : (
        <Card>
          {sets.map((set, position) => {
            const count = set.itemIds.length + set.createdItems.length;
            return (
              <View key={set.setId}>
                {position > 0 ? <Divider style={styles.reviewDivider} /> : null}
                <ListRow
                  icon={ListChecks}
                  color={colors.success}
                  title={set.title}
                  subtitle={`${count} ${count === 1 ? 'item' : 'items'} · ${
                    set.visibility === 'private' ? 'Private' : 'Shared to class'
                  } · Created ${formatDate(set.createdAt)}`}
                  trailing={
                    <PrimaryButton
                      label="Share"
                      icon={Share2}
                      tone="ghost"
                      size="sm"
                      onPress={() => navigation.navigate('Transfer', { setId: set.setId })}
                    />
                  }
                />
              </View>
            );
          })}
        </Card>
      )}

      <SectionHeader
        title="New set"
        caption="Name it, choose existing prompts, and optionally write one of your own."
      />
      <Card>
        <CardHeader
          icon={PencilLine}
          title="Set details"
          subtitle="Step 1 of 3"
          color={colors.primary}
        />
        <Field
          label="Set title"
          value={title}
          onChangeText={setTitle}
          placeholder="Photosynthesis — tricky terms"
          hint="Required. Shown as a filter chip in the review hub."
        />
      </Card>

      <Card>
        <CardHeader
          icon={ListChecks}
          title="Pick existing prompts"
          subtitle="Step 2 of 3"
          color={colors.secondary}
        />
        {visibleItems.length === 0 ? (
          <Text style={styles.helper}>
            No review items are stored on this device yet — write one below instead.
          </Text>
        ) : (
          <View style={styles.selectionList}>
            {visibleItems.map((item, position) => {
              const checked = selected.has(item.itemId);
              return (
                <Pressable
                  key={item.itemId}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  accessibilityLabel={item.prompt}
                  onPress={() => toggleItem(item.itemId)}
                  style={({ pressed }) => [
                    styles.selectionRow,
                    position === visibleItems.length - 1 && styles.selectionRowLast,
                    checked && styles.selectionRowActive,
                    pressed && styles.pressedSoft,
                  ]}
                >
                  <View style={[styles.checkbox, checked && styles.checkboxActive]}>
                    {checked ? <Check size={14} color={colors.onBrand} /> : null}
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.selectionTitle} numberOfLines={2}>
                      {item.prompt}
                    </Text>
                    <Text style={styles.helper} numberOfLines={1}>
                      {friendlyConcept(item)}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
        <Row gap={spacing.sm} wrap>
          <Text style={styles.helper}>
            {selected.size} selected
            {items.length > visibleItems.length
              ? ` · Showing the first ${visibleItems.length} of ${items.length}`
              : ''}
          </Text>
        </Row>
      </Card>

      <Card>
        <CardHeader
          icon={Plus}
          title="Write your own prompt"
          subtitle="Step 3 of 3 — optional"
          color={colors.accentText}
        />
        <Text style={styles.helper}>
          Fill in all three fields to add one authored item to this set.
        </Text>
        <Field
          label="Prompt"
          value={prompt}
          onChangeText={setPrompt}
          placeholder="What does chlorophyll absorb?"
        />
        <Field
          label="Answer"
          value={answer}
          onChangeText={setAnswer}
          placeholder="Light energy, mostly red and blue"
        />
        <Field
          label="Concept ID"
          value={conceptId}
          onChangeText={setConceptId}
          placeholder="photosynthesis-basics"
          autoCapitalize="none"
          hint="Lowercase with hyphens — it groups related prompts together."
        />
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Importance</Text>
          <View style={styles.chipRow}>
            {IMPORTANCE_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={importance === option.value}
                onPress={() => setImportance(option.value)}
              />
            ))}
          </View>
        </View>
      </Card>

      <PrimaryButton label="Save review set" icon={Plus} onPress={() => void save()} />
    </Screen>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Parent weekly digest — reads like a printed report
   ──────────────────────────────────────────────────────────────────────── */

export function ParentDigestScreen({ navigation }: DigestProps) {
  const student = useSessionStore((state) => state.student);
  const [digest, setDigest] = useState<ParentDigest | null>(null);
  const [delivery, setDelivery] = useState<DigestDelivery>('in-app');

  useEffect(() => {
    if (student) {
      void generateParentDigest(student.id).then(async (next) => {
        setDigest(next);
        setDelivery(await deliverParentDigest(next));
      });
    }
  }, [student]);

  const trend = digest ? TIME_TREND[digest.timeTrend] : null;

  return (
    <Screen>
      <ScreenHeader
        overline="Weekly report"
        title="Parent digest"
        subtitle="A plain-language summary of the week, prepared on this device."
        onBack={navigation.goBack}
      />

      {digest && trend ? (
        <>
          <Card style={styles.reportHead}>
            <GradientView ramp={gradients.brand} style={styles.reportRule} />
            <Text style={styles.reportEyebrow}>PAVO WEEKLY LEARNING REPORT</Text>
            <Text style={styles.reportTitle}>
              {formatDateRange(digest.weekStart, digest.weekEnd)}
            </Text>
            <Text style={styles.reportFor}>
              Prepared for the parent or guardian of{' '}
              {student?.displayName ?? 'this learner'}
            </Text>
            <Divider />
            <Row wrap gap={spacing.sm}>
              <Chip
                size="sm"
                label={
                  delivery === 'notification'
                    ? 'Notification delivered'
                    : 'Saved for in-app viewing'
                }
              />
              <Chip size="sm" label={`Generated ${formatDate(digest.generatedAt)}`} />
            </Row>
          </Card>

          <SectionHeader
            title="The week at a glance"
            caption="Drawn from work completed on this device."
          />
          <TileGrid>
            <StatTile
              icon={BookOpen}
              label="Modules completed"
              value={digest.modulesCompleted.length}
              footnote={
                digest.modulesCompleted.length === 0 ? 'None this week' : 'Finished this week'
              }
              color={colors.primary}
            />
            <StatTile
              icon={trend.icon}
              label="Study time"
              value={trend.label}
              footnote={trend.note}
              color={trend.color}
            />
            <StatTile
              icon={Sparkles}
              label="Preferred format"
              value={capitalize(digest.currentFormatPreference)}
              footnote="Works best right now"
              color={colors.secondary}
            />
          </TileGrid>

          <SectionHeader title="Summary" />
          <Card>
            <Text style={styles.reportBody}>{digest.summary}</Text>
          </Card>

          <SectionHeader
            title="Modules completed"
            caption={
              digest.modulesCompleted.length > 0
                ? 'Lessons finished between the dates above'
                : 'Nothing finished in this window'
            }
          />
          <Card>
            {digest.modulesCompleted.length === 0 ? (
              <Text style={styles.reportBody}>
                No modules were completed this week — short, regular practice still counts, and
                the review queue keeps earlier lessons fresh.
              </Text>
            ) : (
              digest.modulesCompleted.map((moduleTitle, position) => (
                <View key={`${moduleTitle}-${position}`}>
                  {position > 0 ? <Divider style={styles.reviewDivider} /> : null}
                  <ListRow icon={CheckCircle2} color={colors.success} title={moduleTitle} />
                </View>
              ))
            )}
          </Card>

          <SectionHeader title="Support at home" />
          <Card accent={colors.accent}>
            <CardHeader
              icon={Target}
              title="One thing to try this week"
              subtitle="Ten minutes is enough"
              color={colors.accentText}
            />
            <Text style={styles.reportBody}>{digest.homeSuggestion}</Text>
          </Card>

          <Text style={styles.reportFooter}>
            This report was generated on this device from the past week of activity — no account
            or internet connection is required to read it.
          </Text>
        </>
      ) : (
        <MascotPanel
          title="Preparing digest"
          body="Weekly activity is being summarized locally."
          expression="encouraging"
        />
      )}
    </Screen>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Local building blocks
   ──────────────────────────────────────────────────────────────────────── */

function HeroPill({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <View style={styles.heroPill}>
      <Icon size={13} color={colors.onBrand} />
      <Text style={styles.heroPillText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function TechniqueCard({
  option,
  selected,
  onPress,
}: {
  option: TechniqueMeta;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${option.label}. ${option.why}`}
      accessibilityHint="Switches this review session to the technique"
      onPress={onPress}
      style={({ pressed }) => [
        styles.techniqueCard,
        selected && { borderColor: option.color, borderWidth: 1.5 },
        pressed && styles.pressedSoft,
      ]}
    >
      <View style={styles.techniqueTop}>
        <IconPlate icon={option.icon} color={option.color} size={44} />
        <View style={styles.flex}>
          <Text style={styles.techniqueTitle}>{option.label}</Text>
          <Text style={styles.rationale}>{option.why}</Text>
        </View>
        {selected ? <CheckCircle2 size={20} color={option.color} /> : null}
      </View>
      <View style={styles.howBlock}>
        <Text style={styles.howLabel}>How to use it here</Text>
        <Text style={styles.howBody}>{option.how}</Text>
      </View>
      <View style={styles.cardAction}>
        <Text style={[styles.cardActionText, { color: option.color }]}>
          {selected ? 'Active in this session' : option.action}
        </Text>
        <ChevronRight size={18} color={option.color} />
      </View>
    </Pressable>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  multiline,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
  autoCapitalize?: TextInputProps['autoCapitalize'];
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkSubtle}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          multiline && styles.multiline,
          focused && styles.inputFocused,
        ]}
      />
      {hint ? <Text style={styles.helper}>{hint}</Text> : null}
    </View>
  );
}

function RatingRow({
  onGrade,
}: {
  onGrade(quality: 0 | 1 | 2 | 3 | 4 | 5): void;
}) {
  return (
    <View style={styles.ratingBlock}>
      <Text style={styles.fieldLabel}>How well did you recall it?</Text>
      <View style={styles.ratingGrid}>
        {(
          [
            [0, 'Again', colors.coral],
            [2, 'Hard', colors.accent],
            [4, 'Good', colors.secondary],
            [5, 'Easy', colors.success],
          ] as const
        ).map(([quality, label, tint]) => (
          <Pressable
            key={quality}
            accessibilityRole="button"
            accessibilityLabel={`Rate ${label}`}
            accessibilityHint="Schedules when this item returns"
            style={({ pressed }) => [styles.rating, pressed && styles.ratingPressed]}
            onPress={() => onGrade(quality)}
          >
            <View style={[styles.ratingDot, { backgroundColor: tint }]} />
            <Text style={styles.ratingLabel}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function formatClock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function friendlyConcept(item: ReviewItem): string {
  if (item.authoredBy === 'curriculum' && item.conceptId.includes(':')) {
    return item.prompt;
  }
  return capitalize(item.conceptId.replaceAll('-', ' '));
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  pressedSoft: { opacity: 0.75 },

  // Hero
  heroEyebrow: { ...text.overline, color: colors.onBrandMuted },
  heroNumber: { ...text.hero, color: colors.onBrand, marginTop: 2 },
  heroNumberCompact: { fontSize: 34, lineHeight: 40 },
  heroBody: { ...text.bodySm, color: colors.onBrandMuted, marginTop: spacing.xs },
  heroRule: { height: 1, backgroundColor: colors.onBrandLine },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    maxWidth: '100%',
    backgroundColor: colors.onBrandSurface,
    borderRadius: radius.round,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  heroPillText: { ...text.caption, color: colors.onBrand, flexShrink: 1 },
  ringValue: { ...text.title, color: colors.onBrand },
  ringLabel: { ...text.tiny, color: colors.onBrandMuted },

  // Technique cards
  techniqueCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outline,
    padding: spacing.lg,
    gap: spacing.md,
    ...elevation.e1,
  },
  techniqueTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  techniqueTitle: { ...text.title, color: colors.ink },
  rationale: { ...text.bodySm, color: colors.inkMuted, marginTop: 2 },
  howBlock: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  howLabel: { ...text.overline, color: colors.inkSubtle, fontSize: 11 },
  howBody: { ...text.caption, color: colors.inkMuted, fontWeight: '500', lineHeight: 19 },
  cardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  cardActionText: { ...text.label, fontWeight: '800' },

  // Focus timer
  timerCard: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.lg,
    ...elevation.e2,
  },
  timerClock: {
    ...text.hero,
    color: colors.onBrand,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  timerActions: { flexDirection: 'row', gap: spacing.md },

  // Queue
  counter: { ...text.caption, color: colors.inkMuted, fontWeight: '800' },
  promptEyebrow: { ...text.overline, color: colors.inkSubtle, marginTop: spacing.xs },
  prompt: { ...text.h2, color: colors.ink },
  scoreText: { ...text.display, color: colors.ink },
  scoreTotal: { ...text.title, color: colors.inkMuted },
  answerReview: { gap: 2 },
  reviewDivider: { marginVertical: spacing.sm },
  reviewPrompt: { ...text.bodyStrong, color: colors.ink },
  reviewGiven: { ...text.bodySm, color: colors.inkMuted },
  reviewReference: { ...text.bodySm, color: colors.inkMuted, fontWeight: '700' },
  reviewReferenceOk: { color: colors.success },

  // Ratings
  ratingBlock: { gap: spacing.sm },
  ratingGrid: { flexDirection: 'row', gap: spacing.sm },
  rating: {
    flex: 1,
    minHeight: 74,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingPressed: { backgroundColor: colors.surfaceMuted },
  ratingDot: { width: 14, height: 14, borderRadius: radius.round },
  ratingLabel: { ...text.label, color: colors.ink, fontWeight: '800' },

  // Forms
  field: { gap: spacing.sm },
  fieldLabel: { ...text.label, color: colors.ink, fontWeight: '700' },
  helper: { ...text.caption, color: colors.inkMuted, fontWeight: '500' },
  input: {
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: colors.outline,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.ink,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
  },
  inputFocused: {
    borderColor: colors.primary,
  },
  multiline: { minHeight: 132, textAlignVertical: 'top' },

  // Item picker
  selectionList: {
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  selectionRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  selectionRowLast: { borderBottomWidth: 0 },
  selectionRowActive: { backgroundColor: colors.primaryTint },
  selectionTitle: { ...text.label, color: colors.ink, fontWeight: '700' },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.xs,
    borderWidth: 2,
    borderColor: colors.outlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },

  // Parent digest
  reportHead: { gap: spacing.md, paddingVertical: spacing.xl },
  reportRule: { width: 56, height: 5, borderRadius: radius.round },
  reportEyebrow: { ...text.overline, color: colors.inkSubtle },
  reportTitle: { ...text.h1, color: colors.ink },
  reportFor: { ...text.bodySm, color: colors.inkMuted },
  reportBody: { ...text.body, color: colors.inkMuted, lineHeight: 26 },
  reportFooter: {
    ...text.caption,
    color: colors.inkSubtle,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
});
