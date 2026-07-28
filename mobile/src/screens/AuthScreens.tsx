import { type ComponentProps, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  BookOpen,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
} from 'lucide-react-native';
import { Card, PrimaryButton, Screen, ScreenHeader, SectionTitle } from '@/components/ui';
import {
  getTeacherProfile,
  saveLearningProfile,
  saveTeacherProfile,
} from '@/data/repository';
import { LEARNING_ASSESSMENT } from '@/domain/assessment';
import { deriveLearningProfile } from '@/domain/learning';
import type { LearningAssessmentAnswer } from '@/domain/types';
import type { RootStackParamList } from '@/navigation/types';
import { useSessionStore } from '@/store/session';
import { colors, radius, spacing } from '@/theme/tokens';

type Props<Route extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, Route>;

export function RoleScreen({ navigation }: Props<'Role'>) {
  const chooseRole = useSessionStore((state) => state.chooseRole);
  const mode = useSessionStore((state) => state.mode);
  return (
    <Screen style={styles.roleScreen}>
      <View style={styles.brandBlock}>
        <View style={styles.brandMark}>
          <BookOpen size={32} color={colors.white} />
        </View>
        <Text style={styles.brandName}>WAIS</Text>
        <Text style={styles.brandLine}>Learning that stays with you, online or offline.</Text>
      </View>

      <Card accent={colors.indigo}>
        <View style={styles.cardTitleRow}>
          <UserRound size={25} color={colors.indigo} />
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>I am a student</Text>
            <Text style={styles.body}>Open lessons, practice with flashcards, and share results.</Text>
          </View>
        </View>
        <PrimaryButton
          label="Continue as student"
          onPress={() => {
            chooseRole('student');
            navigation.navigate('StudentLogin');
          }}
        />
      </Card>

      <Card accent={colors.emerald}>
        <View style={styles.cardTitleRow}>
          <UsersRound size={25} color={colors.emerald} />
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>I am a teacher</Text>
            <Text style={styles.body}>Scan reports, review the class, and prepare modules.</Text>
          </View>
        </View>
        <PrimaryButton
          label="Continue as teacher"
          tone="secondary"
          onPress={() => {
            chooseRole('teacher');
            navigation.navigate('TeacherLogin');
          }}
        />
      </Card>

      <View style={styles.modeNote}>
        <ShieldCheck size={18} color={colors.emerald} />
        <Text style={styles.modeText}>
          {mode === 'lightweight' ? 'Lightweight offline mode is active.' : 'Full mode is active. Core learning still works offline.'}
        </Text>
      </View>
    </Screen>
  );
}

export function StudentLoginScreen({ navigation }: Props<'StudentLogin'>) {
  const login = useSessionStore((state) => state.login);
  const [identifier, setIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setLoading(true);
    setError('');
    const success = await login(identifier, pin);
    setLoading(false);
    if (success) navigation.replace('StudentTabs');
    else setError('We could not match that student number or last name and PIN.');
  }

  return (
    <Screen>
      <ScreenHeader title="Student sign in" subtitle="Your learning stays saved on this device." onBack={navigation.goBack} />
      <Card>
        <Field
          label="Student number or last name"
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          placeholder="Example: 2026-001"
        />
        <Field
          label="PIN"
          value={pin}
          onChangeText={setPin}
          keyboardType="number-pad"
          secureTextEntry
          placeholder="4 digits"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton
          label="Sign in"
          loading={loading}
          disabled={!identifier.trim() || pin.length < 4}
          onPress={submit}
        />
      </Card>
      <PrimaryButton
        label="Create student profile"
        tone="secondary"
        icon={Sparkles}
        onPress={() => navigation.navigate('StudentSetup')}
      />
    </Screen>
  );
}

export function StudentSetupScreen({ navigation }: Props<'StudentSetup'>) {
  const createStudent = useSessionStore((state) => state.createStudent);
  const [studentNumber, setStudentNumber] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [section, setSection] = useState('');
  const [pin, setPin] = useState('');
  const [saving, setSaving] = useState(false);
  const [seedStatus, setSeedStatus] = useState('');

  async function save() {
    setSaving(true);
    try {
      const student = await createStudent(
        {
          studentNumber,
          firstName,
          lastName,
          middleInitial: '',
          gradeLevel: Number(gradeLevel),
          section,
          birthday: '',
          pin,
        },
        ({ completed, total, title }) =>
          setSeedStatus(`Adding ${title} (${completed}/${total})`),
      );
      navigation.replace('LearningAssessment', { studentId: student.id });
    } catch (error) {
      Alert.alert('Profile not saved', error instanceof Error ? error.message : 'Please check the profile details.');
    } finally {
      setSaving(false);
      setSeedStatus('');
    }
  }

  const parsedGrade = Number(gradeLevel);
  const complete = Boolean(
    studentNumber.trim() &&
      firstName.trim() &&
      lastName.trim() &&
      Number.isInteger(parsedGrade) &&
      parsedGrade >= 1 &&
      parsedGrade <= 10 &&
      section.trim() &&
      pin.length >= 4,
  );
  return (
    <Screen>
      <ScreenHeader
        title="Create a profile"
        subtitle="A parent or guardian can help with this first setup."
        onBack={navigation.goBack}
      />
      <Card>
        <Field label="Student number" value={studentNumber} onChangeText={setStudentNumber} placeholder="2026-001" />
        <Field label="First name" value={firstName} onChangeText={setFirstName} placeholder="First name" />
        <Field label="Last name" value={lastName} onChangeText={setLastName} placeholder="Last name" />
        <Field
          label="Grade level"
          value={gradeLevel}
          onChangeText={setGradeLevel}
          keyboardType="number-pad"
          placeholder="1 to 10"
        />
        <Field label="Section" value={section} onChangeText={setSection} placeholder="Mabini" />
        <Field
          label="Create a PIN"
          value={pin}
          onChangeText={setPin}
          keyboardType="number-pad"
          secureTextEntry
          placeholder="At least 4 digits"
        />
        {seedStatus ? <Text style={styles.helper}>{seedStatus}</Text> : null}
        <PrimaryButton label="Save and continue" loading={saving} disabled={!complete} onPress={save} />
      </Card>
    </Screen>
  );
}

export function LearningAssessmentScreen({ navigation, route }: Props<'LearningAssessment'>) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<LearningAssessmentAnswer[]>([]);
  const [guardianAcknowledged, setGuardianAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);
  const question = LEARNING_ASSESSMENT[step];

  if (!question) {
    return (
      <Screen>
        <ScreenHeader title="Your learning mix" />
        <Card accent={colors.emerald}>
          <GraduationCap size={36} color={colors.emerald} />
          <Text style={styles.cardTitle}>All set</Text>
          <Text style={styles.body}>
            WAIS will use your answers to order helpful formats first. This is not an intelligence test, and you can change it later.
          </Text>
          <Text style={styles.body}>
            Your Grade {useSessionStore.getState().student?.gradeLevel ?? ''}
            {' '}Science, Math, and English demo lessons are ready offline.
            Teacher-sent modules will appear beside them.
          </Text>
          <PrimaryButton label="Open my learning hub" onPress={() => navigation.replace('StudentTabs')} />
        </Card>
      </Screen>
    );
  }

  async function select(option: LearningAssessmentAnswer) {
    if (saving) return;
    const nextAnswers = [...answers.filter((answer) => answer.questionId !== question!.id), option];
    setAnswers(nextAnswers);
    if (step === LEARNING_ASSESSMENT.length - 1) {
      setSaving(true);
      const profile = deriveLearningProfile(
        route.params.studentId,
        nextAnswers,
        guardianAcknowledged ? Date.now() : null,
      );
      try {
        await saveLearningProfile(profile);
      } finally {
        setSaving(false);
      }
    }
    setStep((current) => current + 1);
  }

  return (
    <Screen>
      <ScreenHeader
        title="How do you like to learn?"
        subtitle={`Question ${step + 1} of ${LEARNING_ASSESSMENT.length}`}
        onBack={step === 0 ? navigation.goBack : () => setStep((current) => current - 1)}
      />
      {step === 0 ? (
        <View style={styles.guardianRow}>
          <Switch
            value={guardianAcknowledged}
            onValueChange={setGuardianAcknowledged}
            trackColor={{ false: colors.outline, true: colors.emeraldTint }}
            thumbColor={guardianAcknowledged ? colors.emerald : colors.inkMuted}
          />
          <Text style={styles.guardianText}>A parent or guardian is helping with first setup.</Text>
        </View>
      ) : null}
      <SectionTitle>{question.prompt}</SectionTitle>
      <View style={styles.optionList}>
        {question.options.map((option) => (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            disabled={saving}
            onPress={() => select({ questionId: question.id, style: option.style })}
            style={({ pressed }) => [
              styles.option,
              pressed && styles.optionPressed,
              saving && styles.optionDisabled,
            ]}
          >
            <Text style={styles.optionText}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.helper}>
        {saving ? 'Preparing offline lessons...' : 'Choose what feels most comfortable. There are no wrong answers.'}
      </Text>
    </Screen>
  );
}

export function TeacherLoginScreen({ navigation }: Props<'TeacherLogin'>) {
  const [facultyId, setFacultyId] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [existingTeacherId, setExistingTeacherId] = useState<string | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void getTeacherProfile().then((profile) => {
      if (!profile) return;
      setExistingTeacherId(profile.teacherId);
      setExistingId(profile.facultyId);
      setFacultyId(profile.facultyId);
      setName(profile.name);
      setAge(String(profile.age));
    });
  }, []);

  async function submit() {
    setLoading(true);
    setError('');
    try {
      if (existingId && facultyId.trim() !== existingId) {
        throw new Error('This device is registered to a different faculty ID.');
      }
      await saveTeacherProfile({
        teacherId: existingTeacherId ?? undefined,
        name,
        age: Number(age),
        facultyId,
      });
      navigation.replace('TeacherTabs');
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'The local teacher profile could not be opened.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader
        title={existingId ? 'Teacher profile' : 'Create teacher profile'}
        subtitle="This account stays only on this Android device."
        onBack={navigation.goBack}
      />
      <Card>
        <Field
          label="Faculty ID"
          value={facultyId}
          onChangeText={setFacultyId}
          autoCapitalize="none"
        />
        <Field label="Name" value={name} onChangeText={setName} />
        <Field
          label="Age"
          value={age}
          onChangeText={setAge}
          keyboardType="number-pad"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton
          label="Open teacher workspace"
          icon={UsersRound}
          loading={loading}
          disabled={
            !facultyId.trim() ||
            !name.trim() ||
            !Number.isInteger(Number(age)) ||
            Number(age) < 18
          }
          onPress={() => void submit()}
        />
      </Card>
    </Screen>
  );
}

function Field({
  label,
  ...props
}: { label: string } & ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        style={styles.input}
        placeholderTextColor={colors.inkMuted}
        selectionColor={colors.indigo}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  roleScreen: { paddingTop: 44 },
  brandBlock: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  brandMark: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.indigo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: { color: colors.ink, fontSize: 40, fontWeight: '900' },
  brandLine: { color: colors.inkMuted, fontSize: 16, lineHeight: 23, textAlign: 'center', maxWidth: 330 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  cardTitle: { color: colors.ink, fontSize: 19, lineHeight: 25, fontWeight: '800' },
  body: { color: colors.inkMuted, fontSize: 15, lineHeight: 22 },
  flex: { flex: 1, gap: spacing.xs },
  modeNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  modeText: { flex: 1, color: colors.inkMuted, fontSize: 13, lineHeight: 18 },
  field: { gap: spacing.sm },
  fieldLabel: { color: colors.ink, fontSize: 14, fontWeight: '800' },
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
  error: { color: colors.danger, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  guardianRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  guardianText: { flex: 1, color: colors.inkMuted, fontSize: 14, lineHeight: 20 },
  optionList: { gap: spacing.md },
  option: {
    minHeight: 64,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  optionPressed: { borderColor: colors.indigo, backgroundColor: colors.indigoTint },
  optionDisabled: { opacity: 0.55 },
  optionText: { color: colors.ink, fontSize: 17, lineHeight: 23, fontWeight: '700' },
  helper: { color: colors.inkMuted, textAlign: 'center', fontSize: 13, lineHeight: 19 },
});
