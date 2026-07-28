import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CalendarPlus, CheckCircle2, Plus, QrCode } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import {
  Card,
  Chip,
  EmptyState,
  PrimaryButton,
  Screen,
  ScreenHeader,
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
import { colors, radius, spacing } from '@/theme/tokens';

type SectionsProps = NativeStackScreenProps<RootStackParamList, 'Sections'>;
type AssignmentProps = NativeStackScreenProps<
  RootStackParamList,
  'AssignmentBuilder'
>;

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

  return (
    <Screen>
      <ScreenHeader
        title="Sections"
        subtitle="The active section controls roster placement."
        onBack={navigation.goBack}
      />
      <Card>
        <Text style={styles.fieldLabel}>Section name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          style={styles.input}
          placeholder="Grade 4 - Sampaguita"
          placeholderTextColor={colors.inkMuted}
        />
        <Text style={styles.fieldLabel}>Grade level</Text>
        <TextInput
          value={gradeLevel}
          onChangeText={setGradeLevel}
          style={styles.input}
          keyboardType="number-pad"
          placeholder="4"
          placeholderTextColor={colors.inkMuted}
        />
        <PrimaryButton
          label="Add section"
          icon={Plus}
          loading={saving}
          disabled={
            !name.trim() ||
            !Number.isInteger(Number(gradeLevel)) ||
            Number(gradeLevel) < 1
          }
          onPress={() => void addSection()}
        />
      </Card>
      {sections.map((section) => (
        <Pressable
          key={section.sectionId}
          onPress={() => {
            void setActiveSection(section.sectionId).then(load);
          }}
        >
          <Card accent={section.isActive ? colors.emerald : colors.outline}>
            <View style={styles.rowBetween}>
              <View style={styles.flex}>
                <Text style={styles.cardTitle}>{section.name}</Text>
                <Text style={styles.body}>
                  Grade {section.gradeLevel} · {section.roster.length} learner
                  {section.roster.length === 1 ? '' : 's'}
                </Text>
              </View>
              {section.isActive ? (
                <Chip label="Active" selected color={colors.emerald} />
              ) : (
                <Text style={styles.actionText}>Make active</Text>
              )}
            </View>
          </Card>
        </Pressable>
      ))}
      {sections.length === 0 ? (
        <EmptyState
          title="No sections yet"
          body="Add a section before scanning student profile QR codes."
        />
      ) : null}
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
        <ScreenHeader title="Assignment QR" onBack={navigation.goBack} />
        <EmptyState
          title="Choose an active section"
          body="Create or activate a section before making an assignment QR."
        />
        <PrimaryButton
          label="Manage sections"
          onPress={() => navigation.replace('Sections')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        title="Assignment QR"
        subtitle={section.name}
        onBack={navigation.goBack}
      />
      <Card>
        <Text style={styles.fieldLabel}>Task type</Text>
        <View style={styles.chipRow}>
          <Chip
            label="Module"
            selected={type === 'module'}
            onPress={() => setType('module')}
          />
          <Chip
            label="Quiz"
            selected={type === 'quiz'}
            onPress={() => setType('quiz')}
          />
        </View>
        <Text style={styles.fieldLabel}>
          {type === 'module' ? 'Module ID' : 'Quiz ID'}
        </Text>
        <TextInput
          value={targetId}
          onChangeText={setTargetId}
          style={styles.input}
          autoCapitalize="none"
          placeholder={
            type === 'module'
              ? 'grade4-math-fractions'
              : 'grade4-math-fractions-quiz1'
          }
          placeholderTextColor={colors.inkMuted}
        />
        <Text style={styles.fieldLabel}>Due date</Text>
        <TextInput
          value={dueDate}
          onChangeText={setDueDate}
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.inkMuted}
        />
        <PrimaryButton
          label="Add task"
          icon={CalendarPlus}
          disabled={!targetId.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)}
          onPress={addTask}
        />
      </Card>
      {tasks.map((task, index) => (
        <Card key={`${task.type}-${index}`}>
          <View style={styles.rowBetween}>
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>
                {task.type === 'module' ? task.moduleId : task.quizId}
              </Text>
              <Text style={styles.body}>
                {task.type === 'module' ? 'Module' : 'Quiz'} · due {task.dueDate}
              </Text>
            </View>
            <CheckCircle2 size={22} color={colors.emerald} />
          </View>
        </Card>
      ))}
      {payload ? (
        <Card style={styles.qrCard}>
          <QrCode size={24} color={colors.indigo} />
          <Text style={styles.cardTitle}>{section.name}</Text>
          <QRCode value={payload} size={250} ecl="M" />
          <Text style={styles.body}>
            Students scan this from their Scan tab. Existing tasks are preserved.
          </Text>
        </Card>
      ) : null}
    </Screen>
  );
}

function defaultDueDate(): string {
  const value = new Date();
  value.setDate(value.getDate() + 7);
  return value.toISOString().slice(0, 10);
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fieldLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  input: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surface,
    color: colors.ink,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  body: {
    color: colors.inkMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionText: {
    color: colors.indigo,
    fontSize: 13,
    fontWeight: '800',
  },
  qrCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.xxl,
  },
});
