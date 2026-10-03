import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Camera, CheckCircle2, RefreshCw, ScanLine, ShieldAlert, ShieldCheck, ShieldQuestion, TriangleAlert, XCircle } from 'lucide-react-native';
import {
  Callout,
  Card,
  CardHeader,
  Divider,
  PrimaryButton,
  Screen,
  ScreenHeader,
  StatusBadge,
} from '@/components/ui';
import { resultImportContext, saveImportedResult } from '@/data/assessmentRepository';
import { getStudent, getTeacherProfile } from '@/data/repository';
import {
  RESULT_QR_PART_PREFIX,
  ResultQrError,
  decodeResultQr,
  mergeResultQrParts,
  parseResultQrPart,
  validateResultForImport,
  type ResultImportPreview,
  type ResultQrPart,
  type ResultRejection,
} from '@/domain/resultQr';
import type { RootStackParamList } from '@/navigation/types';
import { colors, radius, spacing, text } from '@/theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'ResultImport'>;

type Stage =
  | { kind: 'scanning' }
  | { kind: 'partial'; received: number; total: number }
  | { kind: 'invalid'; title: string; message: string }
  | { kind: 'rejected'; rejection: ResultRejection }
  | { kind: 'preview'; preview: ResultImportPreview; payloadText: string; learner: string }
  | { kind: 'saved'; learner: string; title: string };

const VERIFICATION = {
  signed: { label: 'Signed by enrolled device', icon: ShieldCheck, tone: 'success' as const, body: 'The signature matches the key enrolled from this learner’s profile QR.' },
  unsigned: {
    label: 'Unverified',
    icon: ShieldQuestion,
    tone: 'warning' as const,
    body: 'This result has a valid checksum but no signature. A checksum detects damage; it does not prove who made the code.',
  },
  unknown_device: {
    label: 'Unknown device',
    icon: ShieldAlert,
    tone: 'warning' as const,
    body: 'Signed, but not by the key enrolled for this learner. Rescan their profile QR if they changed phones.',
  },
};

const REJECTION_TITLES: Record<ResultRejection['code'], string> = {
  quiz_not_installed: 'Missing matching quiz',
  version_mismatch: 'Different quiz version',
  package_mismatch: 'Different quiz package',
  fingerprint_mismatch: 'Assessment fingerprint differs',
  count_mismatch: 'Question count differs',
  position_out_of_range: 'Invalid question numbers',
  score_mismatch: 'Score does not match the answer key',
  not_in_section: 'Learner not in this section',
  duplicate: 'Already imported',
  invalid_signature: 'Invalid signature',
};

export function ResultImportScreen({ navigation, route }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [stage, setStage] = useState<Stage>({ kind: 'scanning' });
  const [saving, setSaving] = useState(false);
  const parts = useRef<ResultQrPart[]>([]);
  const busy = useRef(false);

  const handle = useCallback(async (raw: string) => {
    if (busy.current) return;
    busy.current = true;
    try {
      let full = raw;
      if (raw.startsWith(RESULT_QR_PART_PREFIX)) {
        const part = parseResultQrPart(raw);
        if (parts.current[0] && parts.current[0].groupId !== part.groupId) parts.current = [];
        if (!parts.current.some((existing) => existing.sequence === part.sequence)) parts.current.push(part);
        const merged = mergeResultQrParts(parts.current);
        if (!merged) {
          setStage({ kind: 'partial', received: parts.current.length, total: part.total });
          return;
        }
        full = merged;
        parts.current = [];
      }
      const decoded = decodeResultQr(full);
      const outcome = validateResultForImport(decoded, await resultImportContext());
      if (!outcome.ok) {
        setStage({ kind: 'rejected', rejection: outcome });
        return;
      }
      const student = await getStudent(outcome.payload.studentId);
      setStage({ kind: 'preview', preview: outcome, payloadText: full, learner: student?.displayName ?? outcome.payload.studentId });
    } catch (error) {
      setStage({
        kind: 'invalid',
        title: error instanceof ResultQrError && error.code === 'bad_checksum' ? 'Damaged result QR' : 'Invalid result QR',
        message: error instanceof Error ? error.message : 'This code could not be read.',
      });
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    if (route.params?.initial) void handle(route.params.initial);
  }, [handle, route.params?.initial]);

  async function confirm(preview: ResultImportPreview, payloadText: string, learner: string) {
    setSaving(true);
    try {
      const teacher = await getTeacherProfile();
      await saveImportedResult({ preview, payloadText, teacherId: teacher?.teacherId ?? 'teacher:local' });
      setStage({ kind: 'saved', learner, title: preview.guide.title });
    } catch (error) {
      setStage({ kind: 'invalid', title: 'Not saved', message: error instanceof Error ? error.message : 'Try scanning again.' });
    } finally {
      setSaving(false);
    }
  }

  const scanAgain = () => setStage(parts.current.length ? { kind: 'partial', received: parts.current.length, total: parts.current[0]!.total } : { kind: 'scanning' });
  const scanning = stage.kind === 'scanning' || stage.kind === 'partial';

  if (permission && !permission.granted) {
    return (
      <Screen>
        <ScreenHeader overline="Assess" title="Scan student result" onBack={navigation.goBack} />
        <Callout icon={Camera} tone="warning" title="Camera permission needed" body="The camera reads result QR codes on this device. Nothing is uploaded." />
        <PrimaryButton label="Allow camera" icon={Camera} onPress={() => void requestPermission()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader overline="Assess" title="Scan student result" subtitle="Works offline. The QR never contains answers." onBack={navigation.goBack} />
      {scanning ? (
        <View style={styles.camera}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => void handle(data)}
          />
        </View>
      ) : null}
      {stage.kind === 'scanning' ? (
        <Callout icon={ScanLine} tone="info" title="Point at the learner's result QR" body="PAVO checks the quiz version and fingerprint against the quizzes installed here." />
      ) : null}
      {stage.kind === 'partial' ? (
        <Callout icon={ScanLine} tone="info" title={`Scanned ${stage.received} of ${stage.total}`} body="Show the next code in the sequence." />
      ) : null}
      {stage.kind === 'invalid' ? (
        <>
          <Callout icon={XCircle} tone="error" title={stage.title} body={stage.message} />
          <PrimaryButton label="Scan again" icon={RefreshCw} onPress={scanAgain} />
        </>
      ) : null}
      {stage.kind === 'rejected' ? (
        <>
          <Callout icon={TriangleAlert} tone={stage.rejection.code === 'duplicate' ? 'info' : 'error'} title={REJECTION_TITLES[stage.rejection.code]} body={stage.rejection.message} />
          <PrimaryButton label="Scan another" icon={RefreshCw} onPress={() => setStage({ kind: 'scanning' })} />
        </>
      ) : null}
      {stage.kind === 'preview' ? (
        <ResultPreview
          preview={stage.preview}
          learner={stage.learner}
          saving={saving}
          onConfirm={() => void confirm(stage.preview, stage.payloadText, stage.learner)}
          onCancel={() => setStage({ kind: 'scanning' })}
        />
      ) : null}
      {stage.kind === 'saved' ? (
        <>
          <Callout icon={CheckCircle2} tone="success" title="Result imported" body={`${stage.learner}'s ${stage.title} result is in the record book.`} />
          <PrimaryButton label="Scan next learner" icon={ScanLine} onPress={() => setStage({ kind: 'scanning' })} />
        </>
      ) : null}
    </Screen>
  );
}

function ResultPreview({
  preview,
  learner,
  saving,
  onConfirm,
  onCancel,
}: {
  preview: ResultImportPreview;
  learner: string;
  saving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const verification = VERIFICATION[preview.verification];
  const percent = preview.payload.totalPoints ? Math.round((preview.payload.score / preview.payload.totalPoints) * 100) : 0;
  return (
    <>
      <Card>
        <CardHeader icon={CheckCircle2} title={learner} subtitle={`${preview.guide.title} · v${preview.guide.version} · attempt ${preview.payload.attemptNumber}`} />
        <Text style={styles.score}>
          {percent}% · {preview.payload.score}/{preview.payload.totalPoints} points
        </Text>
        <Text style={styles.body}>
          Missed: {preview.incorrect.length ? preview.incorrect.map((question) => question.position).join(', ') : 'none'}
        </Text>
        <Text style={styles.body}>
          Left blank: {preview.unanswered.length ? preview.unanswered.map((question) => question.position).join(', ') : 'none'}
        </Text>
        <Divider />
        <View style={styles.row}>
          <verification.icon size={18} color={verification.tone === 'success' ? colors.success : colors.warning} />
          <StatusBadge label={verification.label} status={verification.tone === 'success' ? 'completed' : 'inProgress'} />
        </View>
        <Text style={styles.caption}>{verification.body}</Text>
      </Card>
      {preview.plan.competencies.length ? (
        <Card accent={colors.warning}>
          <CardHeader icon={TriangleAlert} title="Suggested learner plan" subtitle={preview.plan.summary} color={colors.warning} />
          {preview.plan.competencies.map((group) => (
            <View key={group.competency} style={styles.group}>
              <Text style={styles.groupTitle}>
                {group.competency} · Q{group.questionNumbers.join(', Q')}
              </Text>
              {group.misconceptions.map((note) => (
                <Text key={note} style={styles.body}>
                  Likely misconception: {note}
                </Text>
              ))}
              {group.interventions.map((note) => (
                <Text key={note} style={styles.body}>
                  Try: {note}
                </Text>
              ))}
              {group.remediation.length ? <Text style={styles.caption}>Remediation: {group.remediation.join(', ')}</Text> : null}
            </View>
          ))}
        </Card>
      ) : (
        <Callout icon={CheckCircle2} tone="success" title="Every question correct" body={preview.plan.summary} />
      )}
      <PrimaryButton label="Confirm import" icon={CheckCircle2} loading={saving} onPress={onConfirm} />
      <PrimaryButton label="Cancel" tone="ghost" onPress={onCancel} />
    </>
  );
}

const styles = StyleSheet.create({
  camera: {
    height: 320,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.canopyDeep,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  score: { ...text.h2, color: colors.primary },
  body: { ...text.body, color: colors.ink },
  caption: { ...text.caption, color: colors.inkMuted, fontWeight: '500' },
  group: { gap: 2, paddingVertical: spacing.xs },
  groupTitle: { ...text.bodyStrong, color: colors.ink },
});
