import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  BookOpen,
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  Plus,
  ScanLine,
  Target,
  Users,
} from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import {
  Callout,
  Card,
  CardHeader,
  Divider,
  EmptyState,
  IconPlate,
  ListRow,
  PrimaryButton,
  Screen,
  ScreenHeader,
  SectionHeader,
  SegmentedControl,
  StatusBadge,
} from '@/components/ui';
import {
  createSection,
  getActiveSection,
  getTeacherProfile,
  listSections,
  setActiveSection,
} from '@/data/repository';
import { encodeAssignmentQr } from '@/domain/qr';
import type { AssignmentTask, Section, TeacherProfile } from '@/domain/types';
import type { RootStackParamList } from '@/navigation/types';
import { colors, radius, spacing, text } from '@/theme/tokens';
import { formatDate, formatDeadline } from '@/utils/format';

type SectionsProps = NativeStackScreenProps<RootStackParamList, 'Sections'>;
type AssignmentProps = NativeStackScreenProps<
  RootStackParamList,
  'AssignmentBuilder'
>;

/**
 * Labelled input with a visible focus ring — the smallest change that makes a
 * form feel deliberate rather than assembled.
 */
function Field({
  label,
  hint,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  accessibilityLabel,
}: {
  label: string;
  hint?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  accessibilityLabel?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, focused && styles.inputFocused]}
        placeholder={placeholder}
        placeholderTextColor={colors.inkSubtle}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        accessibilityLabel={accessibilityLabel ?? label}
      />
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

/** Read-back block shown immediately above a form's primary action. */
function SummaryBlock({
  title,
  rows,
  footer,
}: {
  title: string;
  rows: { label: string; value: string }[];
  footer?: ReactNode;
}) {
  return (
    <View style={styles.summary}>
      <Text style={styles.summaryTitle}>{title}</Text>
      {rows.map((row) => (
        <View key={row.label} style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{row.label}</Text>
          <Text style={styles.summaryValue} numberOfLines={2}>
            {row.value}
          </Text>
        </View>
      ))}
      {footer}
    </View>
  );
}

export function SectionsScreen({ navigation }: SectionsProps) {
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [name, setName] = useState('');
  const [gradeLevel, setGradeLevel] = useState('4');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [nextTeacher, nextSections] = await Promise.all([
      getTeacherProfile(),
      listSections(),
    ]);
    setTeacher(nextTeacher);
    setSections(nextSections);
  }, []);
  useFocusEffect(useCallback(() => void load(), [load]));

  async function addSection() {
    if (!teacher) {
      Alert.alert('Teacher profile missing', 'Open the teacher profile again.');
      return;
    }
    setSaving(true);
    try {
      await createSection({
        teacherId: teacher.teacherId,
        name,
        gradeLevel: Number(gradeLevel),
      });
      setName('');
      await load();
    } catch (error) {
      Alert.alert(
        'Section not saved',
        error instanceof Error ? error.message : 'Check the section details.',
      );
    } finally {
      setSaving(false);
    }
  }

  const gradeValid =
    Number.isInteger(Number(gradeLevel)) && Number(gradeLevel) >= 1;
  const ready = Boolean(name.trim()) && gradeValid;
  const active = sections.find((section) => section.isActive) ?? null;

  return (
    <Screen>
      <ScreenHeader
        overline="Classes"
        title="Sections"
        subtitle="The active section decides where scanned learners are placed."
        onBack={navigation.goBack}
      />

      <Callout
        icon={Users}
        tone={active ? 'success' : 'warning'}
        title={active ? `Active section — ${active.name}` : 'No active section yet'}
        body={
          active
            ? `Grade ${active.gradeLevel} · ${active.roster.length} ${
                active.roster.length === 1 ? 'learner' : 'learners'
              } on the roster.`
            : 'Add a section and tap it to make it active before scanning learner QR codes.'
        }
      />

      <SectionHeader title="New section" caption="Stored locally on this device" />
      <Card>
        <CardHeader
          icon={Plus}
          title="Add a section"
          subtitle="Give it the name your learners already recognize."
          color={colors.primary}
        />
        <Field
          label="Section name"
          value={name}
          onChangeText={setName}
          placeholder="Grade 4 — sampaguita"
          autoCapitalize="words"
          hint="Shown on the dashboard and on every assignment QR."
        />
        <Field
          label="Grade level"
          value={gradeLevel}
          onChangeText={setGradeLevel}
          placeholder="4"
          keyboardType="number-pad"
          hint={gradeValid ? undefined : 'Enter a whole number of 1 or higher.'}
        />
        <SummaryBlock
          title="Ready to add"
          rows={[
            { label: 'Name', value: name.trim() || 'Not set yet' },
            { label: 'Grade', value: gradeValid ? `Grade ${Number(gradeLevel)}` : 'Not set yet' },
          ]}
        />
        <PrimaryButton
          label="Add section"
          icon={Plus}
          loading={saving}
          disabled={!ready}
          onPress={() => void addSection()}
        />
      </Card>

      <SectionHeader
        title="Your sections"
        caption={
          sections.length
            ? `${sections.length} ${sections.length === 1 ? 'section' : 'sections'} — tap one to make it active`
            : undefined
        }
      />
      {sections.length === 0 ? (
        <EmptyState
          title="No sections yet"
          body="Add a section before scanning student profile QR codes."
        />
      ) : (
        <Card>
          {sections.map((section, index) => (
            <View key={section.sectionId}>
              {index > 0 ? <Divider style={styles.rowDivider} /> : null}
              <ListRow
                icon={GraduationCap}
                title={section.name}
                subtitle={`Grade ${section.gradeLevel} · ${section.roster.length} learner${
                  section.roster.length === 1 ? '' : 's'
                }`}
                color={section.isActive ? colors.success : colors.secondary}
                onPress={() => {
                  void setActiveSection(section.sectionId).then(load);
                }}
                trailing={
                  section.isActive ? (
                    <StatusBadge label="Active" status="completed" />
                  ) : (
                    <Text style={styles.actionText}>Make active</Text>
                  )
                }
              />
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

export function AssignmentBuilderScreen({ navigation }: AssignmentProps) {
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [section, setSection] = useState<Section | null>(null);
  const [type, setType] = useState<AssignmentTask['type']>('module');
  const [targetId, setTargetId] = useState('');
  const [dueDate, setDueDate] = useState(defaultDueDate());
  const [tasks, setTasks] = useState<AssignmentTask[]>([]);

  useFocusEffect(
    useCallback(() => {
      void Promise.all([getTeacherProfile(), getActiveSection()]).then(
        ([nextTeacher, nextSection]) => {
          setTeacher(nextTeacher);
          setSection(nextSection);
        },
      );
    }, []),
  );

  const payload = useMemo(() => {
    if (!teacher || !section || tasks.length === 0) return '';
    return encodeAssignmentQr({
      teacherId: teacher.teacherId,
      classSection: section.name,
      tasks,
    });
  }, [section, tasks, teacher]);

  function addTask() {
    const value = targetId.trim();
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return;
    setTasks((current) => [
      ...current,
      type === 'module'
        ? { type, moduleId: value, dueDate }
        : { type, quizId: value, dueDate },
    ]);
    setTargetId('');
  }

  if (!section) {
    return (
      <Screen>
        <ScreenHeader
          overline="Assign"
          title="Assignment QR"
          onBack={navigation.goBack}
        />
        <EmptyState
          title="Choose an active section"
          body="Create or activate a section before making an assignment QR."
        />
        <PrimaryButton
          label="Manage sections"
          icon={Users}
          onPress={() => navigation.replace('Sections')}
        />
      </Screen>
    );
  }

  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(dueDate);
  const canAdd = Boolean(targetId.trim()) && dateValid;

  return (
    <Screen>
      <ScreenHeader
        overline="Assign"
        title="Assignment QR"
        subtitle={`${section.name} · Grade ${section.gradeLevel}`}
        onBack={navigation.goBack}
      />

      <SectionHeader title="New task" caption="Add as many as the lesson needs" />
      <Card>
        <CardHeader
          icon={ClipboardList}
          title="Task details"
          subtitle="Learners receive these the moment they scan the QR."
          color={colors.primary}
        />
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Task type</Text>
          <SegmentedControl
            value={type}
            onChange={(value) => setType(value)}
            options={[
              { value: 'module', label: 'Module' },
              { value: 'quiz', label: 'Quiz' },
            ]}
          />
        </View>
        <Field
          label={type === 'module' ? 'Module ID' : 'Quiz ID'}
          value={targetId}
          onChangeText={setTargetId}
          autoCapitalize="none"
          placeholder={
            type === 'module'
              ? 'grade4-math-fractions'
              : 'grade4-math-fractions-quiz1'
          }
          hint="Use the exact identifier from the authored material."
        />
        <Field
          label="Due date"
          value={dueDate}
          onChangeText={setDueDate}
          autoCapitalize="none"
          placeholder="YYYY-MM-DD"
          hint={
            dateValid
              ? formatDeadline(dueDate)
              : 'Enter the date as YYYY-MM-DD — learners see it written out in full.'
          }
        />
        <PrimaryButton
          label="Add task"
          icon={CalendarPlus}
          disabled={!canAdd}
          onPress={addTask}
        />
      </Card>

      {tasks.length ? (
        <>
          <SectionHeader
            title="Tasks in this QR"
            caption={`${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'} queued`}
          />
          <Card>
            {tasks.map((task, index) => (
              <View key={`${task.type}-${index}`}>
                {index > 0 ? <Divider style={styles.rowDivider} /> : null}
                <View style={styles.taskRow}>
                  <IconPlate
                    icon={task.type === 'module' ? BookOpen : Target}
                    color={task.type === 'module' ? colors.primary : colors.accentText}
                    size={38}
                  />
                  <View style={styles.flex}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {task.type === 'module' ? task.moduleId : task.quizId}
                    </Text>
                    <Text style={styles.body} numberOfLines={1}>
                      {task.type === 'module' ? 'Module' : 'Quiz'} · {formatDeadline(task.dueDate)}
                    </Text>
                  </View>
                  <CheckCircle2 size={22} color={colors.success} />
                </View>
              </View>
            ))}
          </Card>
        </>
      ) : (
        <Callout
          icon={ClipboardList}
          tone="info"
          title="No tasks added yet"
          body="Add at least one module or quiz — the QR appears as soon as there is something to send."
        />
      )}

      {payload ? (
        <>
          <SectionHeader title="Share with the class" caption="One scan delivers every task" />
          <Card>
            <SummaryBlock
              title="About to be shared"
              rows={[
                { label: 'Section', value: section.name },
                {
                  label: 'Tasks',
                  value: `${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'}`,
                },
                {
                  label: 'Earliest due',
                  value: formatDate(earliestDueDate(tasks)) || 'Not set',
                },
              ]}
            />
            <View style={styles.qrBlock}>
              <View style={styles.qrFrame}>
                <QRCode value={payload} size={236} ecl="M" />
              </View>
              <View style={styles.qrCaptionRow}>
                <ScanLine size={16} color={colors.inkSubtle} />
                <Text style={styles.qrNote}>
                  Learners scan this from their Scan tab. Existing tasks are preserved.
                </Text>
              </View>
            </View>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function defaultDueDate(): string {
  const value = new Date();
  value.setDate(value.getDate() + 7);
  return value.toISOString().slice(0, 10);
}

function earliestDueDate(tasks: AssignmentTask[]): string {
  return tasks.reduce<string>(
    (earliest, task) =>
      !earliest || task.dueDate < earliest ? task.dueDate : earliest,
    '',
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  rowDivider: { marginVertical: spacing.xs },

  field: { gap: spacing.xs },
  fieldLabel: { ...text.label, color: colors.ink, fontWeight: '700' },
  fieldHint: { ...text.caption, color: colors.inkSubtle, fontWeight: '500' },
  input: {
    ...text.body,
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.outline,
    backgroundColor: colors.surface,
    color: colors.ink,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  inputFocused: { borderColor: colors.primary },

  summary: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  summaryTitle: { ...text.overline, color: colors.inkMuted, fontSize: 11 },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  summaryLabel: { ...text.caption, color: colors.inkMuted, fontWeight: '600' },
  summaryValue: { ...text.caption, color: colors.ink, fontWeight: '800', flexShrink: 1, textAlign: 'right' },

  rowTitle: { ...text.bodyStrong, color: colors.ink },
  body: { ...text.caption, color: colors.inkMuted, fontWeight: '500' },
  actionText: { ...text.label, color: colors.primary, fontWeight: '800' },
  taskRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },

  qrBlock: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.sm },
  qrFrame: {
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  qrCaptionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  qrNote: {
    ...text.caption,
    color: colors.inkMuted,
    fontWeight: '500',
    flex: 1,
  },
});
