import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
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
  ArrowLeft,
  BookOpen,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleHelp,
  History,
  Layers,
  Plus,
  RotateCcw,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Wifi,
  WifiOff,
} from 'lucide-react-native';
import * as Crypto from 'expo-crypto';
import { CompanionThinking } from '@/components/CompanionThinking';
import { PeacockPhase, peacockPhase } from '@/components/mascot/PeacockPhase';
import {
  Callout,
  Chip,
  Divider,
  EmptyState,
  Screen,
  SegmentedControl,
} from '@/components/ui';
import {
  getStudentDashboard,
  listModules,
  listStudentTasks,
} from '@/data/repository';
import {
  appendChatMessage,
  createChatSession,
  listChatSessions,
  saveLearningPackage,
} from '@/data/learningRepository';
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
  ChatSession,
  StudyPackageManifest,
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
type LearnerCompanionIntent = Exclude<CompanionIntent, 'weekly_digest'>;

const intentOptions: Array<{ value: LearnerCompanionIntent; label: string }> = [
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
  const [intent, setIntent] = useState<LearnerCompanionIntent>('review_lessons');
  const [activity, setActivity] = useState<CompanionActivity>('mixed_practice');
  const [selectedSubjects, setSelectedSubjects] = useState<Subject[]>([]);
  const [selectedModuleIds, setSelectedModuleIds] = useState<string[]>([]);
  const [question, setQuestion] = useState('');
  const [contextCollapsed, setContextCollapsed] = useState(false);
  const [reviewSetupCollapsed, setReviewSetupCollapsed] = useState(false);
  const [turns, setTurns] = useState<
    Array<{
      id: number;
      prompt: string;
      result: CompanionResponse;
      producedPackageId?: string | null;
    }>
  >([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [submission, setSubmission] = useState<{ id: number; label: string } | null>(null);
  const [thinkingComplete, setThinkingComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const chatRef = useRef<ScrollView>(null);
  const connectivity = useConnectivity();
  const configured = isCompanionConfigured();

  const load = useCallback(async () => {
    if (!student) return;
    const ownerId = `student:${student.id}` as const;
    const [nextDashboard, nextTasks, nextModules, nextSessions] = await Promise.all([
      getStudentDashboard(student.id),
      listStudentTasks(student.id),
      listModules(student.id),
      listChatSessions(ownerId),
    ]);
    setDashboard(nextDashboard);
    setTasks(nextTasks);
    setModules(nextModules);
    setSessions(nextSessions);
    if (!activeSession) {
      const session =
        nextSessions[0] ?? (await createChatSession(ownerId));
      openSession(session);
      if (nextSessions.length === 0) setSessions([session]);
    }
  }, [activeSession, student]);

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
  useEffect(() => {
    const timer = setTimeout(() => chatRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timer);
  }, [submission, turns]);

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
  useEffect(() => {
    if (intent !== 'review_lessons') return;
    const firstAvailable = reviewModules[0];
    if (selectedModuleIds.length === 0 && firstAvailable) {
      setSelectedModuleIds([firstAvailable.id]);
    }
  }, [intent, reviewModules, selectedModuleIds.length]);
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

  function openSession(session: ChatSession) {
    setActiveSession(session);
    setTurns(turnsFromSession(session));
    setHistoryOpen(false);
  }

  async function startConversation() {
    if (!student) return;
    const session = await createChatSession(`student:${student.id}`);
    setSessions((current) => [session, ...current]);
    openSession(session);
  }

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
    if (selectedModuleIds.length === 0) {
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
    const submissionId = Date.now();
    setSubmission({ id: submissionId, label });
    setContextCollapsed(true);
    setReviewSetupCollapsed(true);
    setThinkingComplete(false);
    setLoading(true);
    try {
      let session =
        activeSession ??
        (await createChatSession(`student:${student.id}`));
      session = await appendChatMessage(session, {
        role: 'user',
        content: label,
        timestamp: new Date().toISOString(),
      });
      setActiveSession(session);
      const request = buildCompanionRequest({
        intent,
        activity,
        gradeLevel: student.gradeLevel,
        question,
        conversation: session.messages.slice(0, -1).map((message) => ({
          role: message.role,
          content: readableChatContent(message.content),
        })),
        selectedModuleIds,
        modules,
        dashboard,
        tasks,
      });
      const [nextResult] = await Promise.all([askPavo(request), delay(1700)]);
      const manifest = studyJamFromResponse({
        result: nextResult,
        studentId: student.id,
        moduleId: selectedModuleIds[0]!,
      });
      await saveLearningPackage({
        ownerId: `student:${student.id}`,
        manifest,
      });
      session = await appendChatMessage(session, {
        role: 'assistant',
        content: JSON.stringify(nextResult),
        timestamp: new Date().toISOString(),
        producedPackageId: manifest.packageId,
      });
      setActiveSession(session);
      setSessions((current) =>
        [session, ...current.filter((item) => item.sessionId !== session.sessionId)]
      );
      setThinkingComplete(true);
      await delay(280);
      setTurns((current) =>
        [
          ...current,
          {
            id: submissionId,
            prompt: label,
            result: nextResult,
            producedPackageId: manifest.packageId,
          },
        ].slice(-8),
      );
      setSubmission(null);
      setQuestion('');
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
    <Screen scroll={false} style={styles.chatScreen}>
      <View style={styles.chatHeader}>
        <Pressable
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <ArrowLeft size={22} color={colors.ink} />
        </Pressable>
        <View style={styles.flex}>
          <Text style={styles.headerEyebrow}>PAVO AI PARTNER</Text>
          <Text style={styles.chatTitle}>What can Pavo prepare</Text>
        </View>
        <View style={styles.mascotWrap}>
          <PeacockPhase phase={growth.phase} size={48} />
        </View>
      </View>

      <SegmentedControl
        options={intentOptions}
        value={intent}
        onChange={(next) => {
          setIntent(next);
          setReviewSetupCollapsed(next === 'ask');
          setError(null);
        }}
      />

      <View style={styles.connectionRow}>
        {online ? (
          <Wifi size={14} color={colors.success} />
        ) : (
          <WifiOff size={14} color={colors.inkSubtle} />
        )}
        <Text style={styles.statusText}>
          {online
            ? 'Online'
            : connectivity === 'checking'
              ? 'Checking connection'
              : connectivity === 'offline'
                ? 'Offline'
                : 'Setup required'}
        </Text>
        <View style={styles.connectionDivider} />
        <ShieldCheck size={14} color={colors.success} />
        <Text style={styles.statusText}>Child-safe</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: historyOpen }}
        onPress={() => setHistoryOpen((value) => !value)}
        style={({ pressed }) => [
          styles.historyToggle,
          pressed && styles.pressed,
        ]}
      >
        <History size={17} color={colors.primary} />
        <View style={styles.flex}>
          <Text style={styles.setupTitle}>Past conversations</Text>
          <Text style={styles.setupMeta} numberOfLines={1}>
            {activeSession?.title ?? 'New conversation'}
          </Text>
        </View>
        {historyOpen ? (
          <ChevronUp size={18} color={colors.inkMuted} />
        ) : (
          <ChevronDown size={18} color={colors.inkMuted} />
        )}
      </Pressable>
      {historyOpen ? (
        <View style={styles.historyPanel}>
          <Pressable
            accessibilityRole="button"
            onPress={() => void startConversation()}
            style={styles.historyRow}
          >
            <Plus size={17} color={colors.primary} />
            <Text style={styles.historyNew}>New conversation</Text>
          </Pressable>
          {sessions.slice(0, 8).map((session) => (
            <Pressable
              key={session.sessionId}
              accessibilityRole="button"
              onPress={() => openSession(session)}
              style={[
                styles.historyRow,
                session.sessionId === activeSession?.sessionId &&
                  styles.historyRowActive,
              ]}
            >
              <History size={16} color={colors.inkMuted} />
              <View style={styles.flex}>
                <Text style={styles.historyTitle} numberOfLines={1}>
                  {session.title}
                </Text>
                <Text style={styles.setupMeta}>
                  {session.messages.length} messages
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      {intent === 'review_lessons' ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: !reviewSetupCollapsed }}
            onPress={() => setReviewSetupCollapsed((collapsed) => !collapsed)}
            style={({ pressed }) => [
              styles.setupToggle,
              pressed && styles.pressed,
            ]}
          >
            <SlidersHorizontal size={17} color={colors.secondary} />
            <View style={styles.flex}>
              <Text style={styles.setupTitle}>Review context</Text>
              <Text style={styles.setupMeta} numberOfLines={1}>
                {selectedModules.length} lesson
                {selectedModules.length === 1 ? '' : 's'} ·{' '}
                {activityOptions.find((option) => option.value === activity)?.label}
              </Text>
            </View>
            {reviewSetupCollapsed ? (
              <ChevronDown size={18} color={colors.inkMuted} />
            ) : (
              <ChevronUp size={18} color={colors.inkMuted} />
            )}
          </Pressable>
          {!reviewSetupCollapsed ? (
            <View style={styles.reviewContext}>
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
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {reviewModules.map((module) => (
                  <Chip
                    key={module.id}
                    label={module.title}
                    selected={selectedModuleIds.includes(module.id)}
                    color={subjectColor[module.subject]}
                    onPress={() => toggleModule(module.id)}
                  />
                ))}
              </ScrollView>
              <SegmentedControl
                options={activityOptions}
                value={activity}
                onChange={setActivity}
              />
            </View>
          ) : null}
        </>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: !contextCollapsed }}
        onPress={() => setContextCollapsed((collapsed) => !collapsed)}
        style={({ pressed }) => [
          styles.contextToggle,
          pressed && styles.pressed,
        ]}
      >
        <BookOpen size={18} color={colors.primary} />
        <View style={styles.flex}>
          <Text style={styles.contextTitle}>Learning snapshot</Text>
          <Text style={styles.contextMeta}>
            {modules.length} lessons available · {openTasks.length} to-do
          </Text>
        </View>
        {contextCollapsed ? (
          <ChevronDown size={19} color={colors.inkMuted} />
        ) : (
          <ChevronUp size={19} color={colors.inkMuted} />
        )}
      </Pressable>

      {!contextCollapsed ? (
        <View style={styles.contextDetails}>
          <View style={styles.contextSectionHeader}>
            <CalendarClock size={16} color={colors.accentText} />
            <Text style={styles.contextSectionTitle}>To-do</Text>
          </View>
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
                        (task.type === 'module'
                          ? 'Read assigned module'
                          : 'Take assigned quiz')}
                    </Text>
                    <Text style={styles.todoDue}>
                      Due {friendlyDate(task.dueDate)}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      ) : null}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.conversation}
      >
        <ScrollView
          ref={chatRef}
          contentContainerStyle={styles.conversationContent}
          keyboardShouldPersistTaps="handled"
          onScroll={(event) => {
            if (event.nativeEvent.contentOffset.y > 24 && !contextCollapsed) {
              setContextCollapsed(true);
            }
          }}
          scrollEventThrottle={32}
          showsVerticalScrollIndicator={false}
        >
          {turns.length === 0 && !submission ? (
            <View style={styles.welcomeBubble}>
              <Sparkles size={18} color={colors.primary} />
              <Text style={styles.welcomeText}>
                {intent === 'review_lessons'
                  ? 'Choose a lesson, then tell me what kind of practice would help.'
                  : 'Ask me a question about what you are learning.'}
              </Text>
            </View>
          ) : null}

          {turns.map((turn) => (
            <View key={turn.id} style={styles.turn}>
              <View style={styles.userBubble}>
                <Text style={styles.userBubbleText}>{turn.prompt}</Text>
              </View>
              <CompanionResult
                result={turn.result}
                saved={Boolean(turn.producedPackageId)}
              />
            </View>
          ))}

          {submission ? (
            <View style={styles.turn}>
              <CompanionThinking
                key={submission.id}
                prompt={submission.label}
                complete={thinkingComplete}
              />
            </View>
          ) : null}
        </ScrollView>

        {error ? (
          <View style={styles.composerError}>
            <CircleHelp size={15} color={colors.error} />
            <Text style={styles.composerErrorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.composer}>
          <TextInput
            accessibilityLabel="Message Pavo"
            editable={!loading && online}
            maxLength={500}
            multiline
            onChangeText={setQuestion}
            onFocus={() => {
              setContextCollapsed(true);
              setReviewSetupCollapsed(true);
              setTimeout(
                () => chatRef.current?.scrollToEnd({ animated: true }),
                120,
              );
            }}
            placeholder={
              intent === 'ask'
                ? 'Ask Pavo anything about your lessons'
                : 'Tell Pavo what you want to practise'
            }
            placeholderTextColor={colors.inkSubtle}
            style={styles.chatInput}
            value={question}
          />
          <Pressable
            accessibilityLabel={intent === 'ask' ? 'Ask Pavo' : 'Prepare review'}
            disabled={!online || !dashboard || loading}
            onPress={() => void generate()}
            style={({ pressed }) => [
              styles.sendButton,
              (!online || !dashboard || loading) && styles.sendButtonDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Send size={20} color={colors.white} />
          </Pressable>
        </View>
        {!online ? (
          <Text style={styles.offlineHint}>
            Downloaded lessons still work. Reconnect to message Pavo.
          </Text>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}

export function CompanionResult({
  result,
  saved = false,
}: {
  result: CompanionResponse;
  saved?: boolean;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(18)).current;
  const expansion = useRef(new Animated.Value(0)).current;
  const [expanded, setExpanded] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});

  useEffect(() => {
    Animated.parallel([
      Animated.spring(expansion, {
        toValue: 1,
        damping: 17,
        stiffness: 145,
        mass: 0.9,
        useNativeDriver: false,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.spring(rise, {
        toValue: 0,
        damping: 15,
        stiffness: 150,
        mass: 0.9,
        useNativeDriver: false,
      }),
    ]).start(({ finished }) => {
      if (finished) setExpanded(true);
    });
  }, [expansion, opacity, rise]);

  const card = result.flashcards[cardIndex];

  return (
    <Animated.View
      style={[
        styles.result,
        {
          maxHeight: expanded
            ? undefined
            : expansion.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 6500],
              }),
          opacity,
          transform: [{ translateY: rise }],
        },
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
      {saved ? (
        <View style={styles.savedRow}>
          <Layers size={16} color={colors.success} />
          <Text style={styles.savedText}>Saved to Study Jams</Text>
        </View>
      ) : null}

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
  intent: LearnerCompanionIntent,
  activity: CompanionActivity,
  modules: LearningModule[],
  question: string,
): string {
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

function studyJamFromResponse(args: {
  result: CompanionResponse;
  studentId: string;
  moduleId: string;
}): StudyPackageManifest {
  const packageId = `jam_${Crypto.randomUUID()}`;
  const authoredBy = `student:${args.studentId}`;
  const reviewItems = [
    ...args.result.flashcards.map((card, index) => ({
      itemId: `${packageId}_card_${index + 1}`,
      moduleId: args.moduleId,
      moduleVersion: 1,
      conceptId: `pavo-card-${index + 1}`,
      type: 'flashcard' as const,
      importance: 'core' as const,
      prompt: card.front,
      answer: card.back,
      formats: { text: card.back },
      authoredBy,
      tags: ['pavo', 'study-jam'],
    })),
    ...args.result.sections.map((section, index) => ({
      itemId: `${packageId}_summary_${index + 1}`,
      moduleId: args.moduleId,
      moduleVersion: 1,
      conceptId: `pavo-summary-${index + 1}`,
      type: 'concept-summary' as const,
      importance: 'supplementary' as const,
      prompt: section.heading,
      answer: section.body,
      formats: { text: section.body },
      authoredBy,
      tags: ['pavo', 'study-jam'],
    })),
  ];
  return {
    packageId,
    version: 1,
    contentCategory: 'studentMaterial',
    title: args.result.title,
    reviewItems,
    ...(args.result.questions.length
      ? {
          quiz: {
            questions: args.result.questions.map((question, index) => ({
              questionId: `${packageId}_question_${index + 1}`,
              type: 'multiple-choice' as const,
              prompt: question.prompt,
              options: question.options,
              correctAnswer:
                question.options[question.correctOption] ??
                question.options[0] ??
                'No answer supplied',
              conceptId: `pavo-question-${index + 1}`,
            })),
          },
        }
      : {}),
    createdBy: authoredBy,
    sharedBy: [],
    createdAt: new Date().toISOString(),
  };
}

function turnsFromSession(
  session: ChatSession,
): Array<{
  id: number;
  prompt: string;
  result: CompanionResponse;
  producedPackageId?: string | null;
}> {
  const turns: Array<{
    id: number;
    prompt: string;
    result: CompanionResponse;
    producedPackageId?: string | null;
  }> = [];
  for (let index = 0; index < session.messages.length - 1; index += 1) {
    const user = session.messages[index];
    const assistant = session.messages[index + 1];
    if (user?.role !== 'user' || assistant?.role !== 'assistant') continue;
    try {
      turns.push({
        id: Date.parse(assistant.timestamp) || index,
        prompt: user.content,
        result: JSON.parse(assistant.content) as CompanionResponse,
        producedPackageId: assistant.producedPackageId,
      });
      index += 1;
    } catch {
      // Older plain-text assistant messages remain in history without a rich preview.
    }
  }
  return turns.slice(-8);
}

function readableChatContent(content: string): string {
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

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  chatScreen: {
    flex: 1,
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  headerEyebrow: { ...text.overline, color: colors.primary },
  chatTitle: { ...text.h2, color: colors.ink, marginTop: 2 },
  mascotWrap: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  connectionDivider: {
    width: 1,
    height: 14,
    marginHorizontal: spacing.xs,
    backgroundColor: colors.outline,
  },
  statusText: { ...text.caption, color: colors.inkMuted },
  historyToggle: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  historyPanel: {
    maxHeight: 240,
    gap: spacing.xs,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  historyRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  historyRowActive: { backgroundColor: colors.primaryTint },
  historyNew: { ...text.label, color: colors.primary },
  historyTitle: { ...text.bodyStrong, color: colors.ink },
  setupToggle: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  setupTitle: { ...text.label, color: colors.ink },
  setupMeta: { ...text.tiny, color: colors.inkMuted, marginTop: 1 },
  reviewContext: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  contextToggle: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.hairline,
  },
  contextTitle: { ...text.label, color: colors.ink },
  contextMeta: { ...text.caption, color: colors.inkMuted, marginTop: 1 },
  contextDetails: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  contextSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  contextSectionTitle: { ...text.label, color: colors.ink },
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
  chipRow: { gap: spacing.sm, paddingRight: spacing.md },
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
  conversation: { flex: 1, minHeight: 0 },
  conversationContent: {
    flexGrow: 1,
    gap: spacing.xl,
    paddingVertical: spacing.md,
  },
  welcomeBubble: {
    alignSelf: 'flex-start',
    maxWidth: '88%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderTopLeftRadius: radius.xs,
    backgroundColor: colors.primaryTint,
    padding: spacing.md,
  },
  welcomeText: { ...text.bodySm, color: colors.ink, flex: 1 },
  turn: { gap: spacing.md },
  userBubble: {
    alignSelf: 'flex-end',
    maxWidth: '88%',
    borderRadius: radius.md,
    borderTopRightRadius: radius.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  userBubbleText: { ...text.bodySm, color: colors.white },
  composerError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingBottom: spacing.xs,
  },
  composerErrorText: { ...text.caption, color: colors.error, flex: 1 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.outline,
    paddingTop: spacing.sm,
  },
  chatInput: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surface,
    color: colors.ink,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    textAlignVertical: 'top',
    fontSize: 16,
    lineHeight: 22,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    ...elevation.e1,
  },
  sendButtonDisabled: { opacity: 0.4 },
  offlineHint: {
    ...text.tiny,
    color: colors.inkSubtle,
    textAlign: 'center',
    paddingTop: spacing.xs,
  },
  pressed: { opacity: 0.82 },
  result: {
    gap: spacing.lg,
    overflow: 'hidden',
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
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  savedText: { ...text.caption, color: colors.success, fontWeight: '700' },
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
