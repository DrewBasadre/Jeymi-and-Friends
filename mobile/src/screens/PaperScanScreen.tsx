import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Directory, File, Paths } from 'expo-file-system';
import { Camera, CheckCircle2, CircleDot, RefreshCw, Save, ScanLine, Trash2, TriangleAlert, UserRound, XCircle } from 'lucide-react-native';
import { Callout, Card, CardHeader, Chip, Divider, PrimaryButton, Screen, ScreenHeader, StatusBadge } from '@/components/ui';
import {
  createPaperScan,
  discardPaperScan,
  finalizePaperScan,
  findDuplicatePaper,
  getAssessment,
  recordCorrection,
  rosterWithClassNumbers,
  type InstalledAssessment,
  type PaperScanRecord,
  type RosterEntry,
} from '@/data/assessmentRepository';
import { getTeacherProfile } from '@/data/repository';
import { CHOICE_LABELS, type QuizDefinition } from '@/domain/assessmentModel';
import {
  FRAME_ISSUE_MESSAGES,
  analysisIssues,
  answerKeyFromMasterSheet,
  applyCorrection,
  classifyBubbles,
  gradePaperSheet,
  isStable,
  parseSheetCode,
  pendingReview,
  readClassId,
  sheetMismatch,
  shouldRetainScanImage,
  standardTemplate,
  type AnswerSheetTemplate,
  type FrameIssue,
  type OmrAnalysis,
  type Point,
  type QuestionDetection,
} from '@/domain/omr';
import { buildQuizFromDraft } from '@/domain/quizAuthoring';
import type { RootStackParamList } from '@/navigation/types';
import { discardScanImage, omrScanner } from '@/services/omrScanner';
import { useQuizDraftStore } from '@/store/quizDraft';
import { colors, radius, spacing, text } from '@/theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'PaperScan'>;

type Stage =
  | { kind: 'aiming'; issues: FrameIssue[]; stable: boolean }
  | { kind: 'capturing' }
  | { kind: 'processing' }
  | { kind: 'not_located'; issues: FrameIssue[] }
  | { kind: 'mismatch'; message: string }
  | { kind: 'review' }
  | { kind: 'saved'; summary: string };

interface ScanReview {
  analysis: OmrAnalysis;
  detections: QuestionDetection[];
  formCode: string;
  sheetCodeReadable: boolean;
  studentId: string | null;
  classNumber: number | null;
  warnings: string[];
  imageUri: string | null;
  retained: boolean;
  record: PaperScanRecord | null;
}

const QUICK_INTERVAL_MS = 700;
const scansDirectory = new Directory(Paths.document, 'paper-scans');

export function PaperScanScreen({ navigation, route }: Props) {
  const { width } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [assessment, setAssessment] = useState<InstalledAssessment | null>(null);
  const [quiz, setQuiz] = useState<Pick<QuizDefinition, 'quizId' | 'version' | 'title' | 'forms' | 'questions' | 'paper'> | null>(null);
  const [template, setTemplate] = useState<AnswerSheetTemplate | null>(null);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [teacherId, setTeacherId] = useState('teacher:local');
  const [stage, setStage] = useState<Stage>({ kind: 'aiming', issues: [], stable: false });
  const [review, setReview] = useState<ScanReview | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [loadError, setLoadError] = useState('');
  const history = useRef<Array<{ ready: boolean; markers: Point[] }>>([]);
  const busy = useRef(false);
  const draft = useQuizDraftStore((state) => state.draft);
  const updateDraft = useQuizDraftStore((state) => state.update);
  const master = route.params.mode === 'master';

  useEffect(() => {
    void (async () => {
      try {
        const teacher = await getTeacherProfile();
        if (teacher) setTeacherId(teacher.teacherId);
        if (master) {
          if (!draft) throw new Error('Open the quiz draft first.');
          const built = buildQuizFromDraft({ ...draft, masterKey: null }, 'teacher:draft', new Date().toISOString());
          setQuiz(built);
          setTemplate(standardTemplate(draft.templateId));
          return;
        }
        const found = await getAssessment(route.params.quizId, route.params.version);
        if (!found) throw new Error('This quiz is not installed on this device.');
        const sheet = found.template ?? (found.definition?.paper ? standardTemplate(found.definition.paper.templateId) : null);
        if (!sheet) throw new Error('This quiz has no answer-sheet template on this device.');
        setAssessment(found);
        setQuiz({
          quizId: found.quizId,
          version: found.version,
          title: found.title,
          forms: found.guide.forms,
          questions: found.guide.questions,
          paper: found.definition?.paper ?? null,
        });
        setTemplate(sheet);
        setRoster(await rosterWithClassNumbers());
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'The scanner could not start.');
      }
    })();
  }, [draft, master, route.params.quizId, route.params.version]);

  const questionCount = quiz?.questions.length ?? 0;

  const process = useCallback(
    async (photoUri: string) => {
      if (!template || !quiz) return;
      setStage({ kind: 'processing' });
      try {
        const analysis = await omrScanner.analyze(photoUri, template, { saveWarped: true });
        discardScanImage(photoUri);
        if (!analysis.located) {
          discardScanImage(analysis.warpedImageUri);
          setStage({ kind: 'not_located', issues: analysisIssues(analysis) });
          return;
        }
        let formCode = quiz.forms[0]!.code;
        let studentId: string | null = null;
        let sheetCodeReadable = false;
        if (analysis.sheetCode) {
          try {
            const sheet = parseSheetCode(analysis.sheetCode);
            const mismatch = sheetMismatch(sheet, { quiz, template });
            if (mismatch) {
              discardScanImage(analysis.warpedImageUri);
              setStage({ kind: 'mismatch', message: mismatch.message });
              return;
            }
            formCode = sheet.formCode;
            studentId = sheet.studentId;
            sheetCodeReadable = true;
          } catch (error) {
            discardScanImage(analysis.warpedImageUri);
            setStage({ kind: 'mismatch', message: error instanceof Error ? error.message : 'This is not a PAVO answer sheet.' });
            return;
          }
        }
        const { detections, baseline, lowContrast } = classifyBubbles(analysis.bubbleFill);
        const classId = readClassId(analysis.classIdFill, baseline);
        if (!studentId && classId.classNumber) studentId = roster.find((entry) => entry.classNumber === classId.classNumber)?.studentId ?? null;
        const warnings: string[] = analysisIssues(analysis).map((issue) => FRAME_ISSUE_MESSAGES[issue]);
        if (analysis.inferredMarker) warnings.push('One corner marker was hidden; its position was estimated. Check the overlay carefully.');
        if (lowContrast) warnings.push('The paper looks dark or shaded, so every mark needs a quick review.');
        if (!sheetCodeReadable) warnings.push(`The sheet code could not be read. Confirm this is ${quiz.title}, Form ${formCode}.`);
        if (!classId.readable) warnings.push('The class number is unclear. Pick the learner below.');
        const outside = detections.filter((detection) => detection.number > questionCount && detection.state !== 'blank').map((detection) => detection.number);
        if (outside.length) warnings.push(`Marks were found on rows ${outside.join(', ')}, which are not part of this quiz.`);

        const retained = !master && shouldRetainScanImage(quiz.paper);
        let imageUri = analysis.warpedImageUri ?? null;
        if (retained && imageUri) {
          if (!scansDirectory.exists) scansDirectory.create({ intermediates: true, idempotent: true });
          const target = new File(scansDirectory, `${Date.now()}.jpg`);
          new File(imageUri).move(target);
          imageUri = target.uri;
        }
        const record = master
          ? null
          : await createPaperScan({
              quizId: quiz.quizId,
              quizVersion: quiz.version,
              formCode,
              templateId: template.templateId,
              studentId,
              classNumber: classId.classNumber,
              sheetCode: analysis.sheetCode,
              detections,
              metrics: analysis.metrics,
              warnings: analysisIssues(analysis),
              imageUri,
              imageRetained: retained,
              teacherId,
            });
        setReview({ analysis, detections, formCode, sheetCodeReadable, studentId, classNumber: classId.classNumber, warnings, imageUri, retained, record });
        setStage({ kind: 'review' });
      } catch (error) {
        discardScanImage(photoUri);
        setStage({ kind: 'mismatch', message: error instanceof Error ? error.message : 'The photo could not be processed.' });
      }
    },
    [master, questionCount, quiz, roster, teacherId, template],
  );

  const capture = useCallback(async () => {
    if (!camera.current) return;
    busy.current = true;
    setStage({ kind: 'capturing' });
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.92, shutterSound: false });
      await process(photo.uri);
    } catch (error) {
      setStage({ kind: 'not_located', issues: [] });
    } finally {
      busy.current = false;
      history.current = [];
    }
  }, [process]);

  useEffect(() => {
    if (stage.kind !== 'aiming' || !template || !omrScanner.isAvailable()) return undefined;
    const timer = setInterval(() => {
      if (busy.current || !camera.current) return;
      busy.current = true;
      void (async () => {
        try {
          const photo = await camera.current!.takePictureAsync({ quality: 0.35, skipProcessing: true, shutterSound: false });
          const analysis = await omrScanner.analyze(photo.uri, template, { quick: true });
          discardScanImage(photo.uri);
          const issues = analysisIssues(analysis);
          history.current = [...history.current.slice(-4), { ready: issues.length === 0, markers: analysis.corners }];
          const stable = isStable(history.current);
          setStage({ kind: 'aiming', issues, stable });
          if (stable) {
            busy.current = false;
            await capture();
            return;
          }
        } catch {
          // A dropped preview frame only delays auto-capture.
        }
        busy.current = false;
      })();
    }, QUICK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [capture, stage.kind, template]);

  const pending = review ? pendingReview(review.detections, questionCount) : [];
  const graded = useMemo(() => {
    if (!review || !quiz || pending.length) return null;
    try {
      return gradePaperSheet(quiz, review.formCode, review.detections);
    } catch {
      return null;
    }
  }, [pending.length, quiz, review]);

  async function correct(questionNumber: number, corrected: { state: 'marked' | 'blank' | 'multiple'; choice: number | null }) {
    if (!review) return;
    const scanId = review.record?.scanId ?? 'master-sheet';
    const { detections, event } = applyCorrection(review.detections, {
      scanId,
      questionNumber,
      corrected,
      teacherId,
      at: new Date().toISOString(),
    });
    if (review.record) await recordCorrection(event, detections);
    setReview({ ...review, detections });
    setEditing(null);
  }

  async function save() {
    if (!review || !quiz || !assessment || !review.record) return;
    if (!review.studentId) {
      Alert.alert('Pick the learner', 'Choose whose paper this is before saving.');
      return;
    }
    const duplicate = await findDuplicatePaper(quiz.quizId, quiz.version, review.studentId);
    const finish = async (replaceScanId: string | null) => {
      const result = await finalizePaperScan({
        scan: review.record!,
        assessment,
        studentId: review.studentId!,
        detections: review.detections,
        teacherId,
        replaceScanId,
      });
      if (!review.retained) discardScanImage(review.imageUri);
      const learner = roster.find((entry) => entry.studentId === review.studentId)?.name ?? 'Learner';
      setReview(null);
      setStage({ kind: 'saved', summary: `${learner}: ${result.score}/${result.total}. Saved to the record book.` });
    };
    if (duplicate) {
      Alert.alert('Duplicate paper', 'This learner already has a graded paper for this quiz version.', [
        { text: 'Keep the first', style: 'cancel' },
        { text: 'Replace it', style: 'destructive', onPress: () => void finish(duplicate) },
      ]);
      return;
    }
    await finish(null);
  }

  function saveMasterKey() {
    if (!review || !quiz) return;
    try {
      const key = answerKeyFromMasterSheet(quiz, review.formCode, review.detections);
      updateDraft({ masterKey: key });
      discardScanImage(review.imageUri);
      navigation.goBack();
    } catch (error) {
      Alert.alert('Master sheet incomplete', error instanceof Error ? error.message : 'Mark one answer per question.');
    }
  }

  async function discard() {
    if (review?.record) await discardPaperScan(review.record.scanId);
    discardScanImage(review?.imageUri);
    setReview(null);
    history.current = [];
    setStage({ kind: 'aiming', issues: [], stable: false });
  }

  const header = (
    <ScreenHeader
      overline={master ? 'Answer key' : 'Paper quiz'}
      title={master ? 'Scan master sheet' : 'Scan answer sheets'}
      subtitle={quiz ? `${quiz.title} · v${quiz.version}` : undefined}
      onBack={navigation.goBack}
    />
  );

  if (loadError) {
    return (
      <Screen>
        {header}
        <Callout icon={XCircle} tone="error" title="Scanner unavailable" body={loadError} />
      </Screen>
    );
  }
  if (!omrScanner.isAvailable()) {
    return (
      <Screen>
        {header}
        <Callout icon={XCircle} tone="warning" title="Development build required" body="The on-device paper scanner runs in the PAVO Android build, not in Expo Go." />
      </Screen>
    );
  }
  if (permission && !permission.granted) {
    return (
      <Screen>
        {header}
        <Callout icon={Camera} tone="warning" title="Camera permission denied" body="PAVO needs the camera to read answer sheets. Photos stay on this phone." />
        <PrimaryButton label="Allow camera" icon={Camera} onPress={() => void requestPermission()} />
      </Screen>
    );
  }
  if (!template || !quiz) {
    return <Screen>{header}</Screen>;
  }

  if (stage.kind === 'review' && review) {
    const displayWidth = width - spacing.xl * 2;
    const scale = displayWidth / template.page.width;
    const learner = roster.find((entry) => entry.studentId === review.studentId);
    return (
      <Screen>
        {header}
        {review.warnings.map((warning) => (
          <Callout key={warning} icon={TriangleAlert} tone="warning" title="Check this" body={warning} />
        ))}
        {pending.length ? (
          <Callout icon={CircleDot} tone="warning" title="Ambiguous marks need review" body={`Tap questions ${pending.join(', ')} to confirm what the learner meant.`} />
        ) : null}
        {review.imageUri ? (
          <View style={{ width: displayWidth, height: template.page.height * scale }}>
            <Image source={{ uri: review.imageUri }} style={StyleSheet.absoluteFill} resizeMode="stretch" accessibilityLabel="Corrected photo of the answer sheet" />
            {template.questions.slice(0, questionCount).map((question, index) => {
              const detection = review.detections[index]!;
              const offset = review.analysis.rowOffsets[index] ?? { x: 0, y: 0 };
              return question.bubbles.map((bubble, choice) => {
                const marked = detection.marked.includes(choice);
                if (!marked && !detection.needsReview) return null;
                const color = detection.needsReview ? colors.warning : detection.state === 'multiple' ? colors.error : colors.success;
                const size = template.bubbleRadius * 2.6 * scale;
                return (
                  <View
                    key={`${question.number}-${choice}`}
                    pointerEvents="none"
                    style={[
                      styles.overlayRing,
                      {
                        left: (bubble.x + offset.x) * scale - size / 2,
                        top: (bubble.y + offset.y) * scale - size / 2,
                        width: size,
                        height: size,
                        borderColor: color,
                        borderStyle: marked ? 'solid' : 'dashed',
                      },
                    ]}
                  />
                );
              });
            })}
          </View>
        ) : null}

        {!master ? (
          <Card>
            <CardHeader icon={UserRound} title={learner ? learner.name : 'Unknown learner'} subtitle={learner ? `Class no. ${learner.classNumber}` : 'Pick the learner who wrote this paper'} />
            <View style={styles.chipRow}>
              {roster.map((entry) => (
                <Chip key={entry.studentId} size="sm" label={`${entry.classNumber}. ${entry.name}`} selected={entry.studentId === review.studentId} onPress={() => setReview({ ...review, studentId: entry.studentId })} />
              ))}
            </View>
          </Card>
        ) : null}

        <Card>
          <CardHeader icon={ScanLine} title={`Form ${review.formCode} · detected answers`} subtitle="Tap a question to correct it. Every change is logged." />
          {review.detections.slice(0, questionCount).map((detection) => (
            <View key={detection.number}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setEditing(editing === detection.number ? null : detection.number)}
                style={[styles.detectionRow, detection.needsReview && styles.detectionReview]}
              >
                <Text style={styles.detectionNumber}>{detection.number}</Text>
                <Text style={styles.detectionValue}>
                  {detection.state === 'marked'
                    ? CHOICE_LABELS[detection.choice!]
                    : detection.state === 'multiple'
                      ? `Multiple (${detection.marked.map((choice) => CHOICE_LABELS[choice]).join(', ')})`
                      : detection.state === 'blank'
                        ? 'Blank'
                        : 'Unclear'}
                </Text>
                {detection.reasons.length ? <Text style={styles.reason}>{detection.reasons.join(', ').replace(/_/g, ' ')}</Text> : null}
                {detection.needsReview ? <StatusBadge label="Review" status="inProgress" /> : null}
              </Pressable>
              {editing === detection.number ? (
                <View style={styles.chipRow}>
                  {template.questions[detection.number - 1]!.bubbles.map((_, choice) => (
                    <Chip key={choice} size="sm" label={CHOICE_LABELS[choice]!} onPress={() => void correct(detection.number, { state: 'marked', choice })} />
                  ))}
                  <Chip size="sm" label="Blank" onPress={() => void correct(detection.number, { state: 'blank', choice: null })} />
                  <Chip size="sm" label="Multiple" onPress={() => void correct(detection.number, { state: 'multiple', choice: null })} />
                </View>
              ) : null}
            </View>
          ))}
        </Card>

        {graded && !master ? (
          <Card accent={colors.success}>
            <CardHeader icon={CheckCircle2} title={`Paper graded: ${graded.scored.score}/${graded.scored.total} (${graded.scored.percent}%)`} color={colors.success} />
            <Text style={styles.body}>
              Missed: {graded.items.filter((item) => item.outcome === 'incorrect').map((item) => item.position).join(', ') || 'none'}
            </Text>
            <Text style={styles.body}>
              Blank: {graded.items.filter((item) => item.outcome === 'unanswered').map((item) => item.position).join(', ') || 'none'}
            </Text>
          </Card>
        ) : null}

        {master ? (
          <PrimaryButton label="Use as answer key" icon={CheckCircle2} disabled={pending.length > 0} onPress={saveMasterKey} />
        ) : (
          <PrimaryButton label="Save to record book" icon={Save} disabled={pending.length > 0 || !review.studentId} onPress={() => void save()} />
        )}
        <PrimaryButton label="Discard and rescan" icon={Trash2} tone="ghost" onPress={() => void discard()} />
      </Screen>
    );
  }

  const aiming = stage.kind === 'aiming';
  return (
    <Screen scroll={false}>
      {header}
      <View style={styles.cameraFrame}>
        <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" animateShutter={false} />
        <View pointerEvents="none" style={styles.guides}>
          <View style={[styles.sheetGuide, { aspectRatio: template.page.width / template.page.height }]}>
            {(['topLeft', 'topRight', 'bottomRight', 'bottomLeft'] as const).map((corner) => (
              <View key={corner} style={[styles.markerGuide, styles[corner]]} />
            ))}
          </View>
        </View>
      </View>
      <View style={styles.status}>
        {aiming && stage.issues.length ? (
          <Callout icon={TriangleAlert} tone="warning" title={stage.stable ? 'Hold still' : 'Adjust the paper'} body={FRAME_ISSUE_MESSAGES[stage.issues[0]!]} />
        ) : null}
        {aiming && !stage.issues.length ? (
          <Callout icon={ScanLine} tone="info" title={stage.stable ? 'Capturing…' : 'Scan stabilizing'} body="Line up the four black squares with the guides. PAVO captures automatically." />
        ) : null}
        {stage.kind === 'capturing' ? <Callout icon={Camera} tone="info" title="Capturing paper" body="Keep the phone still." /> : null}
        {stage.kind === 'processing' ? <Callout icon={ScanLine} tone="info" title="Processing paper locally" body="Nothing leaves this phone." /> : null}
        {stage.kind === 'not_located' ? (
          <Callout
            icon={TriangleAlert}
            tone="error"
            title="Paper outside the scan frame"
            body={stage.issues.map((issue) => FRAME_ISSUE_MESSAGES[issue]).join(' ') || 'PAVO could not find all four corner squares.'}
          />
        ) : null}
        {stage.kind === 'mismatch' ? <Callout icon={XCircle} tone="error" title="Wrong paper form" body={stage.message} /> : null}
        {stage.kind === 'saved' ? <Callout icon={CheckCircle2} tone="success" title="Paper graded" body={stage.summary} /> : null}
        {aiming ? (
          <PrimaryButton label="Capture now" icon={Camera} tone="secondary" onPress={() => void capture()} />
        ) : stage.kind === 'capturing' || stage.kind === 'processing' ? null : (
          <PrimaryButton
            label={stage.kind === 'saved' ? 'Scan next paper' : 'Try again'}
            icon={RefreshCw}
            onPress={() => {
              history.current = [];
              setStage({ kind: 'aiming', issues: [], stable: false });
            }}
          />
        )}
      </View>
    </Screen>
  );
}

const GUIDE = 26;
const styles = StyleSheet.create({
  cameraFrame: { flex: 1, minHeight: 360, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.canopyDeep },
  guides: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  sheetGuide: { width: '86%', maxHeight: '96%' },
  markerGuide: { position: 'absolute', width: GUIDE, height: GUIDE, borderWidth: 3, borderColor: colors.onBrand, borderRadius: 4 },
  topLeft: { top: 0, left: 0 },
  topRight: { top: 0, right: 0 },
  bottomRight: { bottom: 0, right: 0 },
  bottomLeft: { bottom: 0, left: 0 },
  status: { gap: spacing.md, paddingTop: spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingVertical: spacing.xs },
  overlayRing: { position: 'absolute', borderWidth: 2.5, borderRadius: 999 },
  detectionRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.sm },
  detectionReview: { backgroundColor: colors.warningTint, paddingHorizontal: spacing.sm },
  detectionNumber: { ...text.bodyStrong, color: colors.inkMuted, width: 28 },
  detectionValue: { ...text.bodyStrong, color: colors.ink, flex: 1 },
  reason: { ...text.caption, color: colors.warning, fontWeight: '600' },
  body: { ...text.body, color: colors.ink },
});
