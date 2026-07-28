import { type ComponentProps, useState } from 'react';
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
import { getStudent, saveLearningProfile } from '@/data/repository';
import { LEARNING_ASSESSMENT } from '@/domain/assessment';
import { deriveLearningProfile } from '@/domain/learning';
import type { LearningAssessmentAnswer } from '@/domain/types';
import type { RootStackParamList } from '@/navigation/types';
import {
  setupGradeDataset,
  type DatasetSetupResult,
} from '@/services/contentSync';
import { signInTeacher } from '@/services/teacherAuth';
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
  const [section, setSection] = useState('');
  const [pin, setPin] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const student = await createStudent({
        studentNumber,
        firstName,
        lastName,
        middleInitial: '',
        gradeLevel: 5,
        section,
        birthday: '',
        pin,
      });
      navigation.replace('LearningAssessment', { studentId: student.id });
    } catch (error) {
      Alert.alert('Profile not saved', error instanceof Error ? error.message : 'Please check the profile details.');
    } finally {
      setSaving(false);
    }
  }

  const complete = studentNumber.trim() && firstName.trim() && lastName.trim() && section.trim() && pin.length >= 4;
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
        <Field label="Grade and section" value={section} onChangeText={setSection} placeholder="5 - Mabini" />
        <Field
          label="Create a PIN"
          value={pin}
          onChangeText={setPin}
          keyboardType="number-pad"
          secureTextEntry
          placeholder="At least 4 digits"
        />
        <PrimaryButton label="Save and continue" loading={saving} disabled={!complete} onPress={save} />
      </Card>
    </Screen>
  );
}

export function LearningAssessmentScreen({ navigation, route }: Props<'LearningAssessment'>) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<LearningAssessmentAnswer[]>([]);
  const [guardianAcknowledged, setGuardianAcknowledged] = useState(false);
  const [dataset, setDataset] = useState<DatasetSetupResult | null>(null);
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
            {dataset?.source === 'cloud'
              ? `${dataset.availableModules} grade-level modules are ready, including ${dataset.downloadedPackages} offline PDF package(s).`
              : 'The bundled Grade 5 lessons are ready. Cloud modules can download later when this device is online.'}
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
        const student = await getStudent(route.params.studentId);
        setDataset(
          await setupGradeDataset(
            route.params.studentId,
            student?.gradeLevel ?? 5,
            profile.primaryStyle,
          ),
        );
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
  const [teacherNumber, setTeacherNumber] = useState('T-1001');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setError('');
    try {
      await signInTeacher(teacherNumber, password);
      navigation.replace('TeacherTabs');
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'The teacher credentials are incorrect.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Teacher sign in" subtitle="Classroom tools work without internet." onBack={navigation.goBack} />
      <Card>
        <Field
          label="Teacher number or email"
          value={teacherNumber}
          onChangeText={setTeacherNumber}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton
          label="Open teacher workspace"
          icon={UsersRound}
          loading={loading}
          disabled={!teacherNumber.trim() || !password}
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
