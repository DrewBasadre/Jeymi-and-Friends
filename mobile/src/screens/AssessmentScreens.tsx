import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Crypto from 'expo-crypto';
import { strToU8 } from 'fflate';
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  BookCopy,
  CheckCircle2,
  ClipboardList,
  Copy,
  Eye,
  FileDown,
  FileText,
  Layers,
  ListChecks,
  PencilLine,
  Plus,
  Printer,
  ScanLine,
  Send,
  Share2,
  Smartphone,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react-native';
import {
  ActionTile,
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
  SegmentedControl,
  Skeleton,
  StatTile,
  StatusBadge,
  TileGrid,
} from '@/components/ui';
import {
  getAssessment,
  listAssessments,
  listGradedResults,
  listPaperScans,
  listQuestionBank,
  rosterWithClassNumbers,
  saveAuthoredAssessment,
  setAssessmentArchived,
  setBankQuestionStatus,
  type BankQuestion,
  type InstalledAssessment,
  type PaperScanRecord,
} from '@/data/assessmentRepository';
import { getActiveSection, getQuestions, getTeacherProfile, listModules, listStudents } from '@/data/repository';
import { analyzeAssessment, renderAssessmentReport, type AssessmentAnalytics } from '@/domain/assessmentAnalytics';
import {
  CHOICE_LABELS,
  DEFAULT_QUIZ_POLICY,
  buildStudentQuiz,
  type AssessmentQuestion,
  type QuestionKind,
  type QuizDefinition,
} from '@/domain/assessmentModel';
import { STANDARD_TEMPLATE_OPTIONS, buildAnswerSheetTemplate, standardTemplate, templateFitIssue, type AnswerSheetTemplate } from '@/domain/omr';
import { renderAnswerSheetPdf, renderQuizPaperPdf } from '@/domain/paperPdf';
import { KINDS_FOR_MODE, KIND_LABELS, buildMiniQuizPackage, buildQuizFromDraft, newQuestion, questionFromModule } from '@/domain/quizAuthoring';
import { formatSectionLabel } from '@/domain/section';
import type { LearningModule, TeacherProfile } from '@/domain/types';
import type { RootStackParamList, TeacherTabParamList } from '@/navigation/types';
import { ensureDeviceIdentity } from '@/services/deviceIdentity';
import { pickAndImportPackage } from '@/services/packageImport';
import { installAuthoredArchive } from '@/services/packagesV2';
import { printPdf, shareFile, sharePdf } from '@/services/printing';
import { emptyDraft, useQuizDraftStore, type QuizDraft } from '@/store/quizDraft';
import { colors, radius, spacing, text } from '@/theme/tokens';

type TabProps = CompositeScreenProps<
  BottomTabScreenProps<TeacherTabParamList, 'Assessments'>,
  NativeStackScreenProps<RootStackParamList>
>;
type StackProps<Route extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, Route>;

const MODE_LABEL = { paper_omr: 'Paper quiz', digital_mini_quiz: 'Digital mini-quiz' } as const;

/* ────────────────────────────────────────────────────────────────────────
   Assessments list
   ──────────────────────────────────────────────────────────────────────── */

export function AssessmentsScreen({ navigation }: TabProps) {
  const [assessments, setAssessments] = useState<InstalledAssessment[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [importing, setImporting] = useState(false);
  const loadDraft = useQuizDraftStore((state) => state.load);
  const [hasDraft, setHasDraft] = useState(false);

  const load = useCallback(() => {
    void listAssessments().then(async (items) => {
      setAssessments(items);
      const entries = await Promise.all(
        items.map(async (item) => [`${item.quizId}@${item.version}`, (await listGradedResults(item.quizId, item.version)).length] as const),
      );
      setCounts(Object.fromEntries(entries));
    });
    void loadDraft().then((draft) => setHasDraft(Boolean(draft)));
  }, [loadDraft]);
  useFocusEffect(load);

  async function importFile() {
    const teacher = await getTeacherProfile();
    setImporting(true);
    try {
      const outcome = await pickAndImportPackage('teacher', `teacher:${teacher?.teacherId ?? 'local'}`);
      if (outcome.state !== 'cancelled') Alert.alert(outcome.title, outcome.message);
      load();
    } finally {
      setImporting(false);
    }
  }

  return (
    <Screen bottomClearance>
      <ScreenHeader overline="Assess" title="Quizzes" subtitle="Paper quizzes and digital mini-quizzes, graded on this device." />
      <TileGrid columns={2}>
        <ActionTile icon={Plus} label={hasDraft ? 'Continue draft' : 'New quiz'} caption="Paper or digital" onPress={() => navigation.navigate('QuizBuilder')} />
        <ActionTile icon={ScanLine} label="Scan student result" caption="Mini-quiz QR" color={colors.secondary} onPress={() => navigation.navigate('ResultImport', {})} />
      </TileGrid>
      <PrimaryButton label={importing ? 'Checking package…' : 'Install a quiz or teacher bundle file'} icon={FileDown} tone="ghost" loading={importing} onPress={() => void importFile()} />
      <PrimaryButton label="Receive from a teacher nearby" icon={Send} tone="ghost" onPress={() => navigation.navigate('ReceiveTransfer')} />

      <SectionHeader title="Your assessments" caption="Each version is fixed once published" />
      {assessments === null ? (
        <Skeleton width="100%" height={120} />
      ) : assessments.length === 0 ? (
        <EmptyState title="No quizzes yet" body="Create a paper quiz or digital mini-quiz, or install a teacher bundle exported from PAVO web." />
      ) : (
        <Card>
          {assessments.map((assessment, index) => (
            <View key={`${assessment.quizId}@${assessment.version}`}>
              {index > 0 ? <Divider /> : null}
              <ListRow
                icon={assessment.mode === 'paper_omr' ? FileText : Smartphone}
                color={assessment.mode === 'paper_omr' ? colors.primary : colors.secondary}
                title={assessment.title}
                subtitle={`${MODE_LABEL[assessment.mode]} · v${assessment.version} · ${assessment.guide.questions.length} questions · ${counts[`${assessment.quizId}@${assessment.version}`] ?? 0} results`}
                onPress={() => navigation.navigate('AssessmentDetail', { quizId: assessment.quizId, version: assessment.version })}
              />
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Assessment detail and analytics
   ──────────────────────────────────────────────────────────────────────── */

export function AssessmentDetailScreen({ navigation, route }: StackProps<'AssessmentDetail'>) {
  const [assessment, setAssessment] = useState<InstalledAssessment | null>(null);
  const [analytics, setAnalytics] = useState<AssessmentAnalytics | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [scans, setScans] = useState<PaperScanRecord[]>([]);
  const [tab, setTab] = useState<'overview' | 'items' | 'learners'>('overview');
  const [busy, setBusy] = useState('');
  const setDraft = useQuizDraftStore((state) => state.set);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const found = await getAssessment(route.params.quizId, route.params.version);
        if (!found) return;
        const [results, roster, students, paperScans] = await Promise.all([
          listGradedResults(found.quizId, found.version),
          rosterWithClassNumbers(),
          listStudents(),
          listPaperScans(found.quizId, found.version),
        ]);
        setAssessment(found);
        setScans(paperScans);
        setNames(Object.fromEntries(students.map((student) => [student.id, student.displayName])));
        setAnalytics(
          analyzeAssessment(found.guide, results, {
            rosterSize: roster.length || undefined,
            masteryPercent: found.definition?.policy?.masteryPercent ?? 75,
          }),
        );
      })();
    }, [route.params.quizId, route.params.version]),
  );

  if (!assessment || !analytics) {
    return (
      <Screen>
        <ScreenHeader title="Loading quiz…" onBack={navigation.goBack} />
        <Skeleton width="100%" height={160} />
      </Screen>
    );
  }
  const { guide } = assessment;
  const template = assessment.template ?? (assessment.definition?.paper ? standardTemplate(assessment.definition.paper.templateId) : null);

  async function run(label: string, task: () => Promise<void>) {
    setBusy(label);
    try {
      await task();
    } catch (error) {
      Alert.alert('Could not finish', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setBusy('');
    }
  }

  const printables = async (kind: 'sheet' | 'paper' | 'pack', formCode: string) => {
    if (!assessment.definition || !template) throw new Error('This quiz has no printable definition on this device.');
    const section = await getActiveSection();
    const sectionLabel = section ? formatSectionLabel(section.gradeLevel, section.name) : 'Class';
    if (kind === 'paper') {
      await printPdf(await renderQuizPaperPdf(assessment.definition, formCode, { sectionLabel }), `${guide.quizId}-v${guide.version}-${formCode}-paper.pdf`);
      return;
    }
    const students = kind === 'pack' ? await rosterWithClassNumbers() : undefined;
    if (kind === 'pack' && !students?.length) throw new Error('Choose an active section with learners to print a class pack.');
    await printPdf(
      await renderAnswerSheetPdf(template, { quiz: assessment.definition, formCode, sectionLabel, students }),
      `${guide.quizId}-v${guide.version}-${formCode}-${kind === 'pack' ? 'class-pack' : 'answer-sheet'}.pdf`,
    );
  };

  return (
    <Screen>
      <ScreenHeader
        overline={`${MODE_LABEL[guide.mode]} · version ${guide.version}`}
        title={guide.title}
        subtitle={`${guide.questions.length} questions · Grade ${guide.gradeLevel} ${guide.subject}`}
        onBack={navigation.goBack}
      />
      <TileGrid columns={2}>
        <StatTile icon={BarChart3} label="Mean score" value={`${analytics.meanPercent}%`} />
        <StatTile
          icon={ClipboardList}
          label="Completion"
          value={analytics.completionRate === null ? `${analytics.resultCount}` : `${Math.round(analytics.completionRate * 100)}%`}
          footnote={analytics.rosterSize ? `${analytics.resultCount} of ${analytics.rosterSize}` : 'results'}
          color={colors.secondary}
        />
      </TileGrid>

      {guide.mode === 'paper_omr' ? (
        <Card>
          <CardHeader icon={Printer} title="Paper" subtitle={template ? `Answer sheet ${template.templateId}` : 'Answer sheet unavailable'} />
          <PrimaryButton label="Scan answer sheets" icon={ScanLine} onPress={() => navigation.navigate('PaperScan', { quizId: guide.quizId, version: guide.version, mode: 'grade' })} />
          {guide.forms.map((form) => (
            <View key={form.code}>
              <Text style={styles.formLabel}>Form {form.code}</Text>
              <View style={styles.row}>
                <Chip size="sm" label="Quiz paper" icon={FileText} onPress={() => void run('print', () => printables('paper', form.code))} />
                <Chip size="sm" label="Answer sheet" icon={Printer} onPress={() => void run('print', () => printables('sheet', form.code))} />
                <Chip size="sm" label="Class pack" icon={Layers} onPress={() => void run('print', () => printables('pack', form.code))} />
              </View>
            </View>
          ))}
          <Text style={styles.caption}>
            Scans are processed on this phone. Paper photos are {assessment.definition?.paper?.retainScanImages ? 'kept for review' : 'deleted after grading'}.
          </Text>
        </Card>
      ) : (
        <Card>
          <CardHeader icon={Send} title="Distribute" subtitle="Send the student package nearby, then scan each result QR." color={colors.secondary} />
          <PrimaryButton
            label="Send to students nearby"
            icon={Send}
            onPress={() => navigation.navigate('Transfer', { v2PackageId: assessment.studentPackageId, v2Version: guide.version })}
          />
          <PrimaryButton label="Scan student result" icon={ScanLine} tone="secondary" onPress={() => navigation.navigate('ResultImport', { quizId: guide.quizId })} />
        </Card>
      )}

      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          { value: 'overview', label: 'Overview' },
          { value: 'items', label: 'Items' },
          { value: 'learners', label: 'Learners' },
        ]}
      />

      {tab === 'overview' ? (
        <>
          <Card>
            <CardHeader icon={BarChart3} title="Score distribution" />
            {analytics.scoreDistribution.map((bucket) => (
              <View key={bucket.range} style={styles.barRow}>
                <Text style={styles.barLabel}>{bucket.range}</Text>
                <View style={styles.flex}>
                  <ProgressBar value={analytics.resultCount ? bucket.count / analytics.resultCount : 0} height={8} accessibilityLabel={`${bucket.count} learners scored ${bucket.range}`} />
                </View>
                <Text style={styles.barValue}>{bucket.count}</Text>
              </View>
            ))}
          </Card>
          <Card>
            <CardHeader icon={ListChecks} title="Competencies" subtitle="Correct rate across latest attempts" />
            {analytics.competencies.map((group) => (
              <View key={group.name} style={styles.barRow}>
                <Text style={styles.barLabel} numberOfLines={2}>{group.name}</Text>
                <View style={styles.flex}>
                  <ProgressBar value={group.correctRate} height={8} accessibilityLabel={`${group.name} ${Math.round(group.correctRate * 100)} percent`} />
                </View>
                <Text style={styles.barValue}>{Math.round(group.correctRate * 100)}%</Text>
              </View>
            ))}
            {analytics.strongTopics.length ? <Text style={styles.caption}>Strong: {analytics.strongTopics.join(', ')}</Text> : null}
            {analytics.weakTopics.length ? <Text style={styles.warn}>Needs work: {analytics.weakTopics.join(', ')}</Text> : null}
          </Card>
          {analytics.misconceptions.length ? (
            <Card accent={colors.warning}>
              <CardHeader icon={TriangleAlert} title="Likely misconceptions" subtitle="From the assessment guide" color={colors.warning} />
              {analytics.misconceptions.slice(0, 5).map((entry) => (
                <Text key={entry.questionId} style={styles.body}>
                  Q{entry.number} ({entry.missCount} missed): {entry.misconception}
                </Text>
              ))}
            </Card>
          ) : null}
          {analytics.forms.length > 1 ? (
            <Card>
              <CardHeader icon={Layers} title="Alternate forms" subtitle="Each form is graded with its own key" />
              {analytics.forms.map((form) => (
                <Text key={form.code} style={styles.body}>
                  Form {form.code}: {form.resultCount} results · mean {form.meanPercent}%
                </Text>
              ))}
            </Card>
          ) : null}
        </>
      ) : null}

      {tab === 'items' ? (
        <Card>
          {analytics.items.map((item, index) => (
            <View key={item.questionId}>
              {index > 0 ? <Divider /> : null}
              <View style={styles.rowBetween}>
                <Text style={styles.itemTitle}>
                  Q{item.number} · {item.topic}
                </Text>
                <StatusBadge
                  label={item.attempts ? `${Math.round(item.correctRate * 100)}% ${item.difficulty}` : 'No data'}
                  status={item.attempts === 0 ? 'notStarted' : item.difficulty === 'easy' ? 'completed' : 'inProgress'}
                />
              </View>
              <Text style={styles.caption}>
                {item.incorrect} incorrect · {item.unanswered} blank · {item.competency}
              </Text>
              {item.distractors ? (
                <Text style={styles.caption}>
                  Choices picked: {item.distractors.map((entry) => `${entry.label}${entry.isKey ? '✓' : ''} ${entry.count}`).join(' · ')}
                </Text>
              ) : null}
            </View>
          ))}
        </Card>
      ) : null}

      {tab === 'learners' ? (
        <Card>
          <CardHeader icon={TriangleAlert} title="Needs remediation" subtitle="Latest attempt below the mastery level" color={colors.warning} />
          {analytics.needsRemediation.length ? (
            analytics.needsRemediation.map((entry) => (
              <Text key={entry.studentId} style={styles.body}>
                {names[entry.studentId] ?? entry.studentId}: {entry.percent}% — {entry.missedCompetencies.join(', ') || 'review'}
              </Text>
            ))
          ) : (
            <Text style={styles.body}>No learner is below the mastery level.</Text>
          )}
          {scans.length ? <Text style={styles.caption}>{scans.length} paper scan{scans.length === 1 ? '' : 's'} on this device.</Text> : null}
        </Card>
      ) : null}

      <PrimaryButton
        label="Export teacher report"
        icon={Share2}
        tone="secondary"
        loading={busy === 'report'}
        onPress={() =>
          void run('report', () =>
            shareFile(strToU8(renderAssessmentReport(guide, analytics, names)), `${guide.quizId}-v${guide.version}-report.md`, 'text/markdown'),
          )
        }
      />
      <PrimaryButton
        label="Share assessment guide"
        icon={FileText}
        tone="ghost"
        onPress={() => void run('guide', () => shareFile(strToU8(assessment.guideMarkdown), 'assessment-guide.md', 'text/markdown'))}
      />
      {assessment.definition ? (
        <PrimaryButton
          label="Start a new version"
          icon={PencilLine}
          tone="ghost"
          onPress={() => {
            const definition = assessment.definition!;
            setDraft({
              ...emptyDraft(definition.quizId),
              version: definition.version + 1,
              mode: definition.mode,
              title: definition.title,
              gradeLevel: definition.gradeLevel,
              subject: definition.subject,
              questions: definition.questions,
              policy: definition.policy ?? DEFAULT_QUIZ_POLICY,
              templateId: definition.paper?.templateId ?? 'pavo-std-20x4',
              alternateForms: Math.max(0, definition.forms.length - 1),
              retainScanImages: definition.paper?.retainScanImages ?? false,
            });
            navigation.navigate('QuizBuilder');
          }}
        />
      ) : null}
      <PrimaryButton
        label="Archive this version"
        icon={Trash2}
        tone="ghost"
        onPress={() =>
          Alert.alert('Archive this quiz?', 'Results stay in the record book. You can still import late results.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Archive',
              style: 'destructive',
              onPress: () => void setAssessmentArchived(guide.quizId, guide.version, true).then(() => navigation.goBack()),
            },
          ])
        }
      />
    </Screen>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Quiz builder (paper or digital)
   ──────────────────────────────────────────────────────────────────────── */

export function QuizBuilderScreen({ navigation }: StackProps<'QuizBuilder'>) {
  const draft = useQuizDraftStore((state) => state.draft);
  const loadDraft = useQuizDraftStore((state) => state.load);
  const setDraft = useQuizDraftStore((state) => state.set);
  const update = useQuizDraftStore((state) => state.update);
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [bankOpen, setBankOpen] = useState(false);
  const [moduleOpen, setModuleOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [customSize, setCustomSize] = useState({ questions: '20', choices: '4' });

  useEffect(() => {
    void loadDraft().then((existing) => {
      if (!existing) setDraft(emptyDraft(`quiz-${Crypto.randomUUID().slice(0, 8)}`));
    });
    void getTeacherProfile().then(setTeacher);
  }, [loadDraft, setDraft]);

  const template: AnswerSheetTemplate | null = useMemo(() => {
    if (!draft || draft.mode !== 'paper_omr') return null;
    return standardTemplate(draft.templateId);
  }, [draft]);

  if (!draft) {
    return (
      <Screen>
        <ScreenHeader title="New quiz" onBack={navigation.goBack} />
        <Skeleton width="100%" height={140} />
      </Screen>
    );
  }
  const mode = draft.mode;
  const setQuestion = (index: number, question: AssessmentQuestion) =>
    update({ questions: draft.questions.map((item, position) => (position === index ? question : item)), masterKey: null });
  const move = (index: number, delta: number) => {
    const next = [...draft.questions];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item!);
    update({ questions: next, forms: null });
  };
  const addQuestion = (kind: QuestionKind) =>
    update({
      questions: [
        ...draft.questions,
        newQuestion(kind, `q${Date.now().toString(36)}`, {
          topic: draft.questions.at(-1)?.topic ?? '',
          competency: draft.questions.at(-1)?.competency ?? '',
        }),
      ],
      forms: null,
    });

  async function publish() {
    if (!draft) return;
    setError('');
    setPublishing(true);
    try {
      const author = teacher ? `teacher:${teacher.teacherId}` : 'teacher:local';
      const quiz = buildQuizFromDraft(draft, author, new Date().toISOString());
      if (quiz.mode === 'paper_omr') {
        if (!template) throw new Error('Choose an answer sheet.');
        const fit = templateFitIssue(quiz, template);
        if (fit) throw new Error(fit);
      }
      await saveAuthoredAssessment(quiz, template);
      if (quiz.mode === 'digital_mini_quiz') {
        const identity = teacher ? await ensureDeviceIdentity(`teacher:${teacher.teacherId}`) : null;
        const built = buildMiniQuizPackage({
          quiz,
          author: { id: teacher?.teacherId ?? 'local', name: teacher?.name ?? 'Teacher' },
          createdAt: quiz.createdAt,
          signerSecretKeyHex: identity?.secretKeyHex,
        });
        await installAuthoredArchive(built.archive, 'teacher');
      }
      setDraft(null);
      navigation.replace('AssessmentDetail', { quizId: quiz.quizId, version: quiz.version });
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setPublishing(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader overline={`Draft · version ${draft.version}`} title={draft.title || 'New quiz'} subtitle="Saved on this device as you type." onBack={navigation.goBack} />

      <Card>
        <CardHeader icon={ClipboardList} title="1. Choose the quiz type" subtitle="This decides which settings and question types appear." />
        <TileGrid columns={2}>
          <ActionTile
            icon={FileText}
            label="Paper quiz"
            caption="Printed bubble sheet, scanned by your phone"
            badge={mode === 'paper_omr' ? 'Selected' : undefined}
            onPress={() => update({ mode: 'paper_omr', questions: draft.questions.filter((question) => KINDS_FOR_MODE.paper_omr.includes(question.kind)), forms: null })}
          />
          <ActionTile
            icon={Smartphone}
            label="Digital mini-quiz"
            caption="Answered in PAVO, returned by result QR"
            color={colors.secondary}
            badge={mode === 'digital_mini_quiz' ? 'Selected' : undefined}
            onPress={() => update({ mode: 'digital_mini_quiz', forms: null, masterKey: null })}
          />
        </TileGrid>
      </Card>

      {mode ? (
        <>
          <Card>
            <CardHeader icon={PencilLine} title="2. Details" />
            <Field label="Title" value={draft.title} onChange={(title) => update({ title })} placeholder="Fractions check" />
            <Text style={styles.fieldLabel}>Grade</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {Array.from({ length: 12 }, (_, index) => index + 1).map((grade) => (
                <Chip key={grade} size="sm" label={`${grade}`} selected={draft.gradeLevel === grade} onPress={() => update({ gradeLevel: grade })} />
              ))}
            </ScrollView>
            <Field label="Subject" value={draft.subject} onChange={(subject) => update({ subject })} placeholder="Science" />
          </Card>

          <SectionHeader title="3. Questions" caption={`${draft.questions.length} added · ${mode === 'paper_omr' ? 'multiple choice and true or false' : 'any type'}`} />
          {draft.questions.map((question, index) => (
            <QuestionEditor
              key={question.id}
              index={index}
              question={question}
              count={draft.questions.length}
              onChange={(next) => setQuestion(index, next)}
              onMove={(delta) => move(index, delta)}
              onDuplicate={() =>
                update({ questions: [...draft.questions.slice(0, index + 1), { ...question, id: `q${Date.now().toString(36)}` }, ...draft.questions.slice(index + 1)], forms: null })
              }
              onRemove={() => update({ questions: draft.questions.filter((_, position) => position !== index), forms: null, masterKey: null })}
            />
          ))}
          <View style={styles.chipRow}>
            {KINDS_FOR_MODE[mode].map((kind) => (
              <Chip key={kind} label={`+ ${KIND_LABELS[kind]}`} onPress={() => addQuestion(kind)} />
            ))}
          </View>
          <View style={styles.row}>
            <View style={styles.flex}>
              <PrimaryButton label="From question bank" icon={BookCopy} tone="secondary" size="sm" onPress={() => setBankOpen(true)} />
            </View>
            <View style={styles.flex}>
              <PrimaryButton label="From a module" icon={Layers} tone="secondary" size="sm" onPress={() => setModuleOpen(true)} />
            </View>
          </View>

          {mode === 'digital_mini_quiz' ? (
            <DigitalSettings draft={draft} onChange={(policy) => update({ policy })} />
          ) : (
            <Card>
              <CardHeader icon={Printer} title="4. Answer sheet" subtitle="Reuse one sheet layout across quizzes that fit it." />
              {STANDARD_TEMPLATE_OPTIONS.map((option) => (
                <Chip key={option.templateId} label={option.title} selected={draft.templateId === option.templateId} onPress={() => update({ templateId: option.templateId })} />
              ))}
              <Text style={styles.fieldLabel}>Custom sheet</Text>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Field label="Questions" value={customSize.questions} keyboard="number-pad" onChange={(value) => setCustomSize({ ...customSize, questions: value })} />
                </View>
                <View style={styles.flex}>
                  <Field label="Choices (2–5)" value={customSize.choices} keyboard="number-pad" onChange={(value) => setCustomSize({ ...customSize, choices: value })} />
                </View>
              </View>
              <PrimaryButton
                label="Use custom sheet"
                tone="ghost"
                size="sm"
                onPress={() => {
                  try {
                    const custom = buildAnswerSheetTemplate({ questionCount: Number(customSize.questions), choiceCount: Number(customSize.choices) });
                    update({ templateId: custom.templateId });
                  } catch {
                    setError('A custom sheet needs 1–100 questions and 2–5 choices.');
                  }
                }}
              />
              <Text style={styles.caption}>Selected: {template?.title ?? draft.templateId}</Text>
              {template && draft.questions.length ? (
                <Text style={templateFitIssue({ questions: draft.questions }, template) ? styles.warn : styles.caption}>
                  {templateFitIssue({ questions: draft.questions }, template) ?? 'Every question fits this sheet.'}
                </Text>
              ) : null}
              <Text style={styles.fieldLabel}>Alternate versions</Text>
              <View style={styles.chipRow}>
                {[0, 1, 2, 3].map((count) => (
                  <Chip key={count} size="sm" label={count === 0 ? 'Form A only' : `A–${'ABCD'[count]}`} selected={draft.alternateForms === count} onPress={() => update({ alternateForms: count, forms: null })} />
                ))}
              </View>
              <Chip
                label={draft.retainScanImages ? 'Keep scan photos for review' : 'Delete scan photos after grading'}
                selected={draft.retainScanImages}
                onPress={() => update({ retainScanImages: !draft.retainScanImages })}
              />
              <PrimaryButton
                label={draft.masterKey ? 'Answer key from master sheet ✓' : 'Scan a completed master sheet'}
                icon={ScanLine}
                tone="secondary"
                disabled={!draft.questions.length}
                onPress={() => navigation.navigate('PaperScan', { quizId: draft.quizId, version: draft.version, mode: 'master' })}
              />
              <Text style={styles.caption}>Or set each correct answer above. A scanned master sheet overrides them.</Text>
            </Card>
          )}

          <PrimaryButton label="Preview" icon={Eye} tone="secondary" onPress={() => setPreviewOpen(true)} />
          {error ? <Callout icon={TriangleAlert} tone="error" title="Fix before publishing" body={error} /> : null}
          <PrimaryButton label={`Publish version ${draft.version}`} icon={CheckCircle2} loading={publishing} onPress={() => void publish()} />
          <PrimaryButton
            label="Discard draft"
            icon={X}
            tone="ghost"
            onPress={() =>
              Alert.alert('Discard this draft?', 'Questions you added stay in the question bank only if they were published before.', [
                { text: 'Keep editing', style: 'cancel' },
                { text: 'Discard', style: 'destructive', onPress: () => { setDraft(null); navigation.goBack(); } },
              ])
            }
          />
        </>
      ) : (
        <Callout icon={ClipboardList} tone="info" title="Pick a quiz type to continue" body="Paper quizzes need no student phone. Digital mini-quizzes are answered in PAVO and returned by QR." />
      )}

      <QuestionBankPicker
        visible={bankOpen}
        mode={mode}
        onClose={() => setBankOpen(false)}
        onAdd={(questions) => {
          const existing = new Set(draft.questions.map((question) => question.id));
          update({ questions: [...draft.questions, ...questions.filter((question) => !existing.has(question.id))], forms: null });
          setBankOpen(false);
        }}
      />
      <ModuleQuestionPicker
        visible={moduleOpen}
        mode={mode}
        gradeLevel={draft.gradeLevel}
        onClose={() => setModuleOpen(false)}
        onAdd={(questions) => {
          update({ questions: [...draft.questions, ...questions], forms: null });
          setModuleOpen(false);
        }}
      />
      <PreviewModal visible={previewOpen} draft={draft} template={template} onClose={() => setPreviewOpen(false)} />
    </Screen>
  );
}

function DigitalSettings({ draft, onChange }: { draft: QuizDraft; onChange: (policy: QuizDraft['policy']) => void }) {
  const policy = draft.policy;
  return (
    <Card>
      <CardHeader icon={Smartphone} title="4. Mini-quiz settings" color={colors.secondary} />
      <Text style={styles.fieldLabel}>Attempts</Text>
      <View style={styles.chipRow}>
        {[1, 2, 3, 5, null].map((limit) => (
          <Chip key={String(limit)} size="sm" label={limit === null ? 'Unlimited' : `${limit}`} selected={policy.attemptLimit === limit} onPress={() => onChange({ ...policy, attemptLimit: limit })} />
        ))}
      </View>
      <Text style={styles.fieldLabel}>Feedback</Text>
      <SegmentedControl
        value={policy.feedback}
        onChange={(feedback) => onChange({ ...policy, feedback })}
        options={[
          { value: 'immediate', label: 'Each answer' },
          { value: 'after_submit', label: 'After submit' },
          { value: 'score_only', label: 'Score only' },
        ]}
      />
      <Chip
        label={policy.revealAnswers ? 'Show correct answers after submitting' : 'Keep correct answers hidden'}
        selected={policy.revealAnswers}
        onPress={() => onChange({ ...policy, revealAnswers: !policy.revealAnswers })}
      />
      <Text style={styles.fieldLabel}>Retakes</Text>
      <SegmentedControl
        value={policy.retake}
        onChange={(retake) => onChange({ ...policy, retake })}
        options={[
          { value: 'not_allowed', label: 'None' },
          { value: 'below_mastery', label: 'Until mastery' },
          { value: 'allowed', label: 'Always' },
        ]}
      />
      <Text style={styles.fieldLabel}>Mastery level</Text>
      <View style={styles.chipRow}>
        {[60, 75, 80, 90].map((percent) => (
          <Chip key={percent} size="sm" label={`${percent}%`} selected={policy.masteryPercent === percent} onPress={() => onChange({ ...policy, masteryPercent: percent })} />
        ))}
      </View>
      <Text style={styles.fieldLabel}>Time limit</Text>
      <View style={styles.chipRow}>
        {[null, 5, 10, 15, 30].map((minutes) => (
          <Chip key={String(minutes)} size="sm" label={minutes === null ? 'None' : `${minutes} min`} selected={policy.timeLimitMinutes === minutes} onPress={() => onChange({ ...policy, timeLimitMinutes: minutes })} />
        ))}
      </View>
      <Field
        label="Due date (YYYY-MM-DD, optional)"
        value={policy.dueDate ?? ''}
        onChange={(value) => onChange({ ...policy, dueDate: /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : value ? policy.dueDate : null })}
        placeholder="2026-10-15"
      />
    </Card>
  );
}

function QuestionEditor({
  index,
  question,
  count,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
}: {
  index: number;
  question: AssessmentQuestion;
  count: number;
  onChange: (question: AssessmentQuestion) => void;
  onMove: (delta: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const [more, setMore] = useState(false);
  const set = (patch: Partial<AssessmentQuestion>) => onChange({ ...question, ...patch });
  return (
    <Card>
      <View style={styles.rowBetween}>
        <Text style={styles.itemTitle}>
          Q{index + 1} · {KIND_LABELS[question.kind]}
        </Text>
        <View style={styles.row}>
          <IconAction icon={ArrowUp} label="Move up" disabled={index === 0} onPress={() => onMove(-1)} />
          <IconAction icon={ArrowDown} label="Move down" disabled={index === count - 1} onPress={() => onMove(1)} />
          <IconAction icon={Copy} label="Duplicate" onPress={onDuplicate} />
          <IconAction icon={Trash2} label="Remove" onPress={onRemove} />
        </View>
      </View>
      <Field label="Question" value={question.prompt} multiline onChange={(prompt) => set({ prompt })} />
      {question.kind === 'multiple_choice' ? (
        <View style={styles.stack}>
          {question.choices.map((choice, choiceIndex) => (
            <View key={choiceIndex} style={styles.row}>
              <Chip size="sm" label={CHOICE_LABELS[choiceIndex]!} selected={choice !== '' && question.answer === choice} onPress={() => set({ answer: choice })} />
              <TextInput
                value={choice}
                onChangeText={(value) => {
                  const choices = question.choices.map((item, position) => (position === choiceIndex ? value : item));
                  set({
                    choices,
                    answer: question.answer !== '' && question.answer === choice ? value : question.answer,
                    acceptedAnswers: question.acceptedAnswers.map((accepted) => (accepted === choice ? value : accepted)),
                  });
                }}
                placeholder={`Choice ${CHOICE_LABELS[choiceIndex]}`}
                placeholderTextColor={colors.inkSubtle}
                style={[styles.input, styles.flex]}
              />
              <Chip
                size="sm"
                label="Also"
                selected={question.acceptedAnswers.includes(choice)}
                onPress={() =>
                  set({
                    acceptedAnswers: question.acceptedAnswers.includes(choice)
                      ? question.acceptedAnswers.filter((accepted) => accepted !== choice)
                      : [...question.acceptedAnswers, choice].filter((accepted) => accepted && accepted !== question.answer),
                  })
                }
              />
            </View>
          ))}
          <View style={styles.row}>
            {question.choices.length < 5 ? <Chip size="sm" label="+ Choice" onPress={() => set({ choices: [...question.choices, ''] })} /> : null}
            {question.choices.length > 2 ? (
              <Chip size="sm" label="− Choice" onPress={() => set({ choices: question.choices.slice(0, -1), acceptedAnswers: question.acceptedAnswers.filter((accepted) => accepted !== question.choices.at(-1)) })} />
            ) : null}
          </View>
          <Text style={styles.caption}>Tap a letter to mark the answer. “Also” accepts a second correct choice.</Text>
        </View>
      ) : question.kind === 'true_false' ? (
        <View style={styles.row}>
          {(['True', 'False'] as const).map((value) => (
            <Chip key={value} label={value} selected={question.answer === value} onPress={() => set({ answer: value })} />
          ))}
        </View>
      ) : (
        <>
          <Field label="Answer" value={question.answer} onChange={(answer) => set({ answer })} />
          <Field
            label="Also accept (comma separated)"
            value={question.acceptedAnswers.join(', ')}
            onChange={(value) => set({ acceptedAnswers: value.split(',').map((item) => item.trim()).filter(Boolean) })}
          />
        </>
      )}
      <View style={styles.row}>
        <View style={styles.flex}>
          <Field label="Topic" value={question.topic} onChange={(topic) => set({ topic })} />
        </View>
        <View style={styles.flex}>
          <Field label="Competency" value={question.competency} onChange={(competency) => set({ competency })} />
        </View>
      </View>
      <View style={styles.row}>
        {(['easy', 'medium', 'hard'] as const).map((difficulty) => (
          <Chip key={difficulty} size="sm" label={difficulty} selected={question.difficulty === difficulty} onPress={() => set({ difficulty })} />
        ))}
        <View style={styles.flex}>
          <Field label="Points" value={String(question.points)} keyboard="number-pad" onChange={(value) => set({ points: Math.max(1, Math.min(100, Number(value) || 1)) })} />
        </View>
      </View>
      <Chip size="sm" label={more ? 'Hide teaching notes' : 'Teaching notes'} selected={more} onPress={() => setMore(!more)} />
      {more ? (
        <>
          <Field label="Rationale" value={question.rationale} multiline onChange={(rationale) => set({ rationale })} />
          <Field label="Likely misconception" value={question.misconception} onChange={(misconception) => set({ misconception })} />
          <Field label="Recommended intervention" value={question.intervention} onChange={(intervention) => set({ intervention })} />
          <Field label="Remediation lesson or block" value={question.remediationRef} onChange={(remediationRef) => set({ remediationRef })} />
        </>
      ) : null}
    </Card>
  );
}

function QuestionBankPicker({
  visible,
  mode,
  onClose,
  onAdd,
}: {
  visible: boolean;
  mode: QuizDraft['mode'];
  onClose: () => void;
  onAdd: (questions: AssessmentQuestion[]) => void;
}) {
  const [bank, setBank] = useState<BankQuestion[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => {
    if (visible) void listQuestionBank().then(setBank);
  }, [visible]);
  const usable = bank.filter((entry) => !mode || KINDS_FOR_MODE[mode].includes(entry.question.kind));
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen>
        <ScreenHeader title="Question bank" subtitle="Questions from your published quizzes" onBack={onClose} />
        {usable.length === 0 ? <EmptyState title="Nothing here yet" body="Published questions are saved here for reuse." /> : null}
        {usable.map((entry) => (
          <Card key={entry.question.id}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected.includes(entry.question.id) }}
              onPress={() =>
                setSelected((current) => (current.includes(entry.question.id) ? current.filter((id) => id !== entry.question.id) : [...current, entry.question.id]))
              }
              style={styles.row}
            >
              <CheckCircle2 size={20} color={selected.includes(entry.question.id) ? colors.primary : colors.outlineStrong} />
              <View style={styles.flex}>
                <Text style={styles.body}>{entry.question.prompt}</Text>
                <Text style={styles.caption}>
                  {KIND_LABELS[entry.question.kind]} · {entry.question.topic} · {entry.source}
                </Text>
              </View>
            </Pressable>
            <Chip size="sm" label="Archive" onPress={() => void setBankQuestionStatus(entry.question.id, 'archived').then(() => listQuestionBank().then(setBank))} />
          </Card>
        ))}
        <PrimaryButton
          label={`Add ${selected.length} question${selected.length === 1 ? '' : 's'}`}
          disabled={!selected.length}
          onPress={() => {
            onAdd(usable.filter((entry) => selected.includes(entry.question.id)).map((entry) => entry.question));
            setSelected([]);
          }}
        />
      </Screen>
    </Modal>
  );
}

function ModuleQuestionPicker({
  visible,
  mode,
  gradeLevel,
  onClose,
  onAdd,
}: {
  visible: boolean;
  mode: QuizDraft['mode'];
  gradeLevel: number;
  onClose: () => void;
  onAdd: (questions: AssessmentQuestion[]) => void;
}) {
  const [modules, setModules] = useState<LearningModule[]>([]);
  useEffect(() => {
    if (!visible) return;
    void (async () => {
      const students = await listStudents();
      const sample = students.find((student) => student.gradeLevel === gradeLevel);
      setModules(sample ? await listModules(sample.id) : []);
    })();
  }, [gradeLevel, visible]);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen>
        <ScreenHeader title="Add from a module" subtitle={`Grade ${gradeLevel} modules on this device`} onBack={onClose} />
        {modules.length === 0 ? <EmptyState title="No modules for this grade" body="Modules appear once a learner in this grade uses this device or a module is installed." /> : null}
        {modules.map((module) => (
          <ListRow
            key={module.id}
            icon={Layers}
            title={module.title}
            subtitle={module.competencyCode}
            onPress={() =>
              void getQuestions(module.id).then((questions) =>
                onAdd(
                  questions
                    .map((question, index) => questionFromModule(question, `${module.id.slice(0, 40)}-${index + 1}`.replace(/[^A-Za-z0-9._-]/g, '-'), module.competencyCode))
                    .filter((question) => !mode || KINDS_FOR_MODE[mode].includes(question.kind)),
                ),
              )
            }
          />
        ))}
      </Screen>
    </Modal>
  );
}

function PreviewModal({
  visible,
  draft,
  template,
  onClose,
}: {
  visible: boolean;
  draft: QuizDraft;
  template: AnswerSheetTemplate | null;
  onClose: () => void;
}) {
  const [problem, setProblem] = useState('');
  const built = useMemo(() => {
    if (!visible) return null;
    try {
      setProblem('');
      return buildQuizFromDraft(draft, 'teacher:preview', new Date().toISOString());
    } catch (error) {
      setProblem(readableError(error));
      return null;
    }
  }, [draft, visible]);
  const studentView = built?.mode === 'digital_mini_quiz' ? buildStudentQuiz(built) : null;
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen>
        <ScreenHeader title="Student preview" subtitle="Exactly what learners will see" onBack={onClose} />
        {problem ? <Callout icon={TriangleAlert} tone="warning" title="Not ready to preview" body={problem} /> : null}
        {studentView?.questions.map((question) => (
          <Card key={question.id}>
            <Text style={styles.caption}>
              Question {question.position} · {question.points} point{question.points === 1 ? '' : 's'}
            </Text>
            <Text style={styles.body}>{question.prompt}</Text>
            {question.choices.map((choice, index) => (
              <Text key={choice} style={styles.body}>
                {question.kind === 'true_false' ? '○' : `${CHOICE_LABELS[index]}.`} {choice}
              </Text>
            ))}
            {!question.choices.length ? <Text style={styles.caption}>Learners type their answer.</Text> : null}
          </Card>
        ))}
        {built?.mode === 'paper_omr' && template ? (
          <>
            {built.forms.map((form) => (
              <View key={form.code} style={styles.row}>
                <View style={styles.flex}>
                  <PrimaryButton label={`Quiz paper ${form.code}`} icon={FileText} tone="secondary" size="sm" onPress={() => void renderQuizPaperPdf(built, form.code).then((pdf) => printPdf(pdf, `preview-${form.code}.pdf`))} />
                </View>
                <View style={styles.flex}>
                  <PrimaryButton
                    label={`Answer sheet ${form.code}`}
                    icon={Printer}
                    tone="secondary"
                    size="sm"
                    onPress={() => void renderAnswerSheetPdf(template, { quiz: built, formCode: form.code, sectionLabel: 'Preview' }).then((pdf) => sharePdf(pdf, `preview-sheet-${form.code}.pdf`))}
                  />
                </View>
              </View>
            ))}
          </>
        ) : null}
      </Screen>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  keyboard,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboard?: 'number-pad';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.inkSubtle}
        multiline={multiline}
        keyboardType={keyboard ?? 'default'}
        accessibilityLabel={label}
        style={[styles.input, multiline && styles.multiline]}
      />
    </View>
  );
}

function IconAction({
  icon: Icon,
  label,
  onPress,
  disabled,
}: {
  icon: typeof Plus;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.iconAction, (pressed || disabled) && styles.iconActionMuted]}
    >
      <Icon size={18} color={colors.inkMuted} />
    </Pressable>
  );
}

function readableError(error: unknown): string {
  if (error && typeof error === 'object' && 'issues' in error && Array.isArray((error as { issues: unknown[] }).issues)) {
    const issue = (error as { issues: Array<{ path: Array<string | number>; message: string }> }).issues[0];
    if (issue) {
      const questionIndex = issue.path[0] === 'questions' && typeof issue.path[1] === 'number' ? ` (question ${issue.path[1] + 1})` : '';
      return `${issue.message}${questionIndex}`;
    }
  }
  return error instanceof Error ? error.message : 'Something is incomplete.';
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  stack: { gap: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  field: { gap: 4 },
  fieldLabel: { ...text.caption, color: colors.inkMuted, fontWeight: '700' },
  input: {
    minHeight: 46,
    borderWidth: 1.5,
    borderColor: colors.outline,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    color: colors.ink,
    paddingHorizontal: spacing.md,
    fontSize: 16,
  },
  multiline: { minHeight: 88, paddingTop: spacing.sm, textAlignVertical: 'top' },
  body: { ...text.body, color: colors.ink },
  caption: { ...text.caption, color: colors.inkMuted, fontWeight: '500' },
  warn: { ...text.caption, color: colors.warning, fontWeight: '700' },
  itemTitle: { ...text.bodyStrong, color: colors.ink, flexShrink: 1 },
  formLabel: { ...text.label, color: colors.ink, fontWeight: '800', marginTop: spacing.sm, marginBottom: spacing.xs },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  barLabel: { ...text.caption, color: colors.inkMuted, width: 96 },
  barValue: { ...text.caption, color: colors.ink, fontWeight: '800', width: 40, textAlign: 'right' },
  iconAction: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.round },
  iconActionMuted: { opacity: 0.4 },
});
