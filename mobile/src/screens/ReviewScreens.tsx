import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Brain,
  CalendarDays,
  CheckCircle2,
  ListChecks,
  PencilLine,
  Plus,
  Timer,
} from 'lucide-react-native';
import {
  Card,
  Chip,
  EmptyState,
  Metric,
  PrimaryButton,
  Screen,
  ScreenHeader,
} from '@/components/ui';
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
import { colors, radius, spacing } from '@/theme/tokens';

type ReviewProps = NativeStackScreenProps<RootStackParamList, 'ReviewHub'>;
type CustomProps = NativeStackScreenProps<RootStackParamList, 'CustomReviewSets'>;
type DigestProps = NativeStackScreenProps<RootStackParamList, 'ParentDigest'>;

const TECHNIQUES: Array<{ key: StudyTechnique; label: string }> = [
  { key: 'active-recall', label: 'Recall' },
  { key: 'retrieval-quiz', label: 'Retrieval quiz' },
  { key: 'interleaved', label: 'Interleaved' },
  { key: 'pomodoro', label: 'Pomodoro' },
  { key: 'blurting', label: 'Blurting' },
];

export function ReviewHubScreen({ navigation }: ReviewProps) {
  const student = useSessionStore((state) => state.student);
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
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
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
    if (!pomodoro || secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1_000);
    return () => clearInterval(timer);
  }, [pomodoro, secondsLeft]);

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
    setPomodoro(null);
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
      const finishingCycle = index === queue.length - 1;
      const nextSession: PomodoroSession = {
        ...pomodoro,
        completedCycles: finishingCycle
          ? Math.min(pomodoro.cyclesPlanned, pomodoro.completedCycles + 1)
          : pomodoro.completedCycles,
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
      cyclesPlanned: 4,
    });
    setPomodoro(session);
    setSecondsLeft(session.workMinutes * 60);
    setIndex(0);
    itemStartedAt.current = Date.now();
  }

  if (!student) {
    return <EmptyState title="Student sign-in required" body="Sign in to open the review queue." />;
  }

  return (
    <Screen>
      <ScreenHeader
        title="Study techniques"
        subtitle={`${items.length} review item${items.length === 1 ? '' : 's'} due`}
        onBack={navigation.goBack}
      />
      <View style={styles.chipRow}>
        {TECHNIQUES.map((option) => (
          <Chip
            key={option.key}
            label={option.label}
            selected={technique === option.key}
            onPress={() => changeTechnique(option.key)}
          />
        ))}
      </View>
      <PrimaryButton
        label="Custom review sets"
        icon={PencilLine}
        tone="secondary"
        onPress={() => navigation.navigate('CustomReviewSets')}
      />
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
      ) : null}

      {technique === 'pomodoro' && !pomodoro ? (
        <Card accent={colors.coral}>
          <View style={styles.headingRow}>
            <Timer size={24} color={colors.coral} />
            <Text style={styles.cardTitle}>Work block</Text>
          </View>
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
          <View style={styles.chipRow}>
            {[5, 10, 15].map((minutes) => (
              <Chip
                key={minutes}
                label={`${minutes} min break`}
                selected={breakMinutes === minutes}
                onPress={() => setBreakMinutes(minutes)}
              />
            ))}
          </View>
          <PrimaryButton label="Start timer" icon={Timer} onPress={() => void startPomodoro()} />
        </Card>
      ) : null}

      {pomodoro ? (
        <View style={styles.metricRow}>
          <Metric label="Work time" value={formatClock(secondsLeft)} tint={colors.coralTint} />
          <Metric label="Next break" value={`${pomodoro.breakMinutes} min`} tint={colors.emeraldTint} />
        </View>
      ) : null}

      {retrievalResult !== null ? (
        <Card accent={colors.emerald}>
          <CheckCircle2 size={30} color={colors.emerald} />
          <Text style={styles.cardTitle}>Retrieval complete</Text>
          <Text style={styles.scoreText}>{retrievalResult}/{queue.length}</Text>
          {queue.map((item) => (
            <View key={item.itemId} style={styles.answerReview}>
              <Text style={styles.prompt}>{item.prompt}</Text>
              <Text style={styles.body}>Your answer: {retrievalAnswers[item.itemId]}</Text>
              <Text style={styles.answer}>Reference: {item.answer}</Text>
            </View>
          ))}
        </Card>
      ) : !current && technique !== 'pomodoro' ? (
        <EmptyState title="Review complete" body="The next due items will appear here automatically." />
      ) : current ? (
        <Card accent={technique === 'blurting' ? colors.amber : colors.indigo}>
          <View style={styles.rowBetween}>
            <Chip label={friendlyConcept(current)} />
            <Text style={styles.counter}>{index + 1}/{queue.length}</Text>
          </View>
          {technique === 'blurting' ? (
            <>
              <Text style={styles.cardTitle}>Write everything you recall</Text>
              <Text style={styles.prompt}>{friendlyConcept(current)}</Text>
              <TextInput
                value={writtenAnswer}
                onChangeText={setWrittenAnswer}
                style={[styles.input, styles.multiline]}
                multiline
                placeholder="Your explanation"
                placeholderTextColor={colors.inkMuted}
              />
              {revealed ? <Text style={styles.answer}>{current.answer}</Text> : null}
              {!revealed ? (
                <PrimaryButton
                  label="Compare with reference"
                  onPress={() => setRevealed(true)}
                />
              ) : (
                <RatingRow onGrade={(quality) => void grade(quality)} />
              )}
            </>
          ) : technique === 'retrieval-quiz' ? (
            <>
              <ListChecks size={28} color={colors.indigo} />
              <Text style={styles.prompt}>{current.prompt}</Text>
              <TextInput
                value={writtenAnswer}
                onChangeText={setWrittenAnswer}
                style={styles.input}
                placeholder="Type your answer"
                placeholderTextColor={colors.inkMuted}
              />
              <PrimaryButton
                label={index === queue.length - 1 ? 'Submit full set' : 'Next item'}
                disabled={!writtenAnswer.trim()}
                onPress={() => void nextRetrieval()}
              />
            </>
          ) : (
            <>
              <Brain size={28} color={colors.indigo} />
              <Text style={styles.prompt}>{current.prompt}</Text>
              {revealed ? <Text style={styles.answer}>{current.answer}</Text> : null}
              {!revealed ? (
                <PrimaryButton label="Reveal answer" onPress={() => setRevealed(true)} />
              ) : (
                <RatingRow onGrade={(quality) => void grade(quality)} />
              )}
            </>
          )}
        </Card>
      ) : null}
    </Screen>
  );
}

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

  return (
    <Screen>
      <ScreenHeader title="Custom review sets" onBack={navigation.goBack} />
      <Card>
        <Text style={styles.cardTitle}>New set</Text>
        <TextInput value={title} onChangeText={setTitle} style={styles.input} placeholder="Set title" placeholderTextColor={colors.inkMuted} />
        <Text style={styles.label}>Pick local items</Text>
        <View style={styles.selectionList}>
          {items.slice(0, 12).map((item) => (
            <Pressable key={item.itemId} style={styles.selectionRow} onPress={() => toggleItem(item.itemId)}>
              <View style={[styles.checkbox, selected.has(item.itemId) && styles.checkboxActive]} />
              <View style={styles.flex}>
                <Text style={styles.smallTitle}>{item.prompt}</Text>
                <Text style={styles.meta}>{friendlyConcept(item)}</Text>
              </View>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Author one item</Text>
        <TextInput value={prompt} onChangeText={setPrompt} style={styles.input} placeholder="Prompt" placeholderTextColor={colors.inkMuted} />
        <TextInput value={answer} onChangeText={setAnswer} style={styles.input} placeholder="Answer" placeholderTextColor={colors.inkMuted} />
        <TextInput value={conceptId} onChangeText={setConceptId} style={styles.input} placeholder="Concept ID" placeholderTextColor={colors.inkMuted} autoCapitalize="none" />
        <View style={styles.chipRow}>
          {(['core', 'supplementary', 'stretch'] as const).map((value) => (
            <Chip key={value} label={capitalize(value)} selected={importance === value} onPress={() => setImportance(value)} />
          ))}
        </View>
        <PrimaryButton label="Save review set" icon={Plus} onPress={() => void save()} />
      </Card>
      {sets.map((set) => (
        <Card key={set.setId} accent={colors.emerald}>
          <Text style={styles.cardTitle}>{set.title}</Text>
          <Text style={styles.body}>
            {set.itemIds.length + set.createdItems.length} item{set.itemIds.length + set.createdItems.length === 1 ? '' : 's'}
          </Text>
          <Chip label={set.visibility === 'private' ? 'Private' : 'Shared to class'} />
          <PrimaryButton
            label="Share nearby"
            tone="secondary"
            onPress={() => navigation.navigate('Transfer', { setId: set.setId })}
          />
        </Card>
      ))}
    </Screen>
  );
}

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

  return (
    <Screen>
      <ScreenHeader title="Parent weekly digest" onBack={navigation.goBack} />
      {digest ? (
        <>
          <Card accent={colors.emerald}>
            <View style={styles.headingRow}>
              <CalendarDays size={25} color={colors.emerald} />
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>{digest.weekStart} to {digest.weekEnd}</Text>
                <Text style={styles.body}>{digest.summary}</Text>
                <Text style={styles.meta}>
                  {delivery === 'notification'
                    ? 'Parent notification delivered'
                    : 'Saved for in-app viewing'}
                </Text>
              </View>
            </View>
          </Card>
          <View style={styles.metricRow}>
            <Metric label="Modules" value={digest.modulesCompleted.length} tint={colors.indigoTint} />
            <Metric label="Time trend" value={capitalize(digest.timeTrend.replaceAll('-', ' '))} tint={colors.amberTint} />
          </View>
          <Card>
            <Text style={styles.label}>Home reinforcement</Text>
            <Text style={styles.answer}>{digest.homeSuggestion}</Text>
          </Card>
        </>
      ) : (
        <EmptyState title="Preparing digest" body="Weekly activity is being summarized locally." />
      )}
    </Screen>
  );
}

function RatingRow({
  onGrade,
}: {
  onGrade(quality: 0 | 1 | 2 | 3 | 4 | 5): void;
}) {
  return (
    <View style={styles.ratingRow}>
      {([
        [0, 'Forgot'],
        [2, 'Hard'],
        [4, 'Recalled'],
        [5, 'Easy'],
      ] as const).map(([quality, label]) => (
        <Pressable key={quality} style={styles.rating} onPress={() => onGrade(quality)}>
          <Text style={styles.ratingValue}>{quality}</Text>
          <Text style={styles.ratingLabel}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function formatClock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function capitalize(value: string): string {
  return value ? `${value[0]?.toLocaleUpperCase()}${value.slice(1)}` : value;
}

function friendlyConcept(item: ReviewItem): string {
  if (item.authoredBy === 'curriculum' && item.conceptId.includes(':')) {
    return item.prompt;
  }
  return capitalize(item.conceptId.replaceAll('-', ' '));
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  headingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  metricRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cardTitle: { color: colors.ink, fontSize: 19, lineHeight: 25, fontWeight: '800' },
  prompt: { color: colors.ink, fontSize: 22, lineHeight: 30, fontWeight: '800' },
  answer: { color: colors.emerald, fontSize: 17, lineHeight: 25, fontWeight: '800' },
  body: { color: colors.inkMuted, fontSize: 15, lineHeight: 22 },
  counter: { color: colors.inkMuted, fontSize: 14, fontWeight: '800' },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.ink,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
  },
  multiline: { minHeight: 130, textAlignVertical: 'top' },
  ratingRow: { flexDirection: 'row', gap: spacing.sm },
  rating: {
    flex: 1,
    minHeight: 70,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingValue: { color: colors.indigo, fontSize: 19, fontWeight: '900' },
  ratingLabel: { color: colors.inkMuted, fontSize: 10, fontWeight: '800' },
  scoreText: { color: colors.ink, fontSize: 42, fontWeight: '900' },
  answerReview: { borderTopWidth: 1, borderTopColor: colors.outline, paddingTop: spacing.md, gap: spacing.xs },
  label: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  selectionList: { borderWidth: 1, borderColor: colors.outline, borderRadius: radius.md, overflow: 'hidden' },
  selectionRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.outline },
  checkbox: { width: 20, height: 20, borderRadius: radius.sm, borderWidth: 2, borderColor: colors.outline },
  checkboxActive: { borderWidth: 6, borderColor: colors.indigo },
  smallTitle: { color: colors.ink, fontSize: 14, lineHeight: 19, fontWeight: '800' },
  meta: { color: colors.inkMuted, fontSize: 12, lineHeight: 17 },
});
