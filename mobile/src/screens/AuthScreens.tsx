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
  GraduationCap,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
} from 'lucide-react-native';
import { Card, CardHeader, PrimaryButton, ProgressBar, Screen, ScreenHeader, SectionTitle } from '@/components/ui';
import { Celebrate, MascotPanel, Peacock, PixelPeacock } from '@/components/mascot';
import { seedDemoData } from '@/data/demoSeed';
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
import { colors, radius, spacing, text } from '@/theme/tokens';

type Props<Route extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, Route>;

export function LandingScreen({ navigation }: Props<'Landing'>) {
  const login = useSessionStore((state) => state.login);
  const [loadingDemo, setLoadingDemo] = useState(false);

  async function exploreDemo() {
    setLoadingDemo(true);
    try {
      const creds = await seedDemoData();
      const ok = await login(creds.studentNumber, creds.pin);
      if (ok) {
        navigation.reset({ index: 0, routes: [{ name: 'StudentTabs' }] });
      } else {
        navigation.navigate('Role');
      }
    } catch (error) {
      Alert.alert('Demo data', error instanceof Error ? error.message : 'Could not load the demo classroom.');
    } finally {
      setLoadingDemo(false);
    }
  }

  return (
    <Screen style={styles.landing} scroll={false}>
      <View style={styles.landingHero}>
        <View style={styles.landingHalo}>
          <PixelPeacock size={152} stage={4} accessibilityLabel="Pavo the peacock" />
        </View>
        <Text style={styles.brandName}>Pavo</Text>
        <Text style={styles.landingTagline}>
          Your friendly learning buddy. Grow your peacock as you learn — online or offline.
        </Text>
      </View>
      <View style={styles.landingActions}>
        <PrimaryButton label="Start learning" icon={Sparkles} onPress={() => navigation.navigate('Role')} />
        <PrimaryButton
          label="Explore a demo classroom"
          tone="ghost"
          loading={loadingDemo}
          onPress={() => void exploreDemo()}
        />
        <Text style={styles.landingFoot}>Works fully offline · No account needed to try</Text>
      </View>
    </Screen>
  );
}

export function RoleScreen({ navigation }: Props<'Role'>) {
  const chooseRole = useSessionStore((state) => state.chooseRole);
  const mode = useSessionStore((state) => state.mode);
  return (
    <Screen style={styles.roleScreen}>
      <View style={styles.brandBlock}>
        <View style={styles.brandHalo}>
          <Peacock size={104} expression="happy" />
        </View>
        <Text style={styles.brandName}>Pavo</Text>
        <Text style={styles.brandLine}>Learning that stays with you, online or offline.</Text>
      </View>

      <Card accent={colors.primary}>
        <CardHeader
          icon={UserRound}
          color={colors.primary}
          title="I am a student"
          subtitle="Open lessons, practice with flashcards, and share results."
        />
        <PrimaryButton
          label="Continue as student"
          onPress={() => {
            chooseRole('student');
            navigation.navigate('StudentLogin');
          }}
        />
      </Card>

      <Card accent={colors.secondary}>
        <CardHeader
          icon={UsersRound}
          color={colors.secondary}
          title="I am a teacher"
          subtitle="Scan reports, review the class, and prepare modules."
        />
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
        <ShieldCheck size={18} color={colors.success} />
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
        {error ? <ErrorNote message={error} /> : null}
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

  async function save() {
    setSaving(true);
    try {
      const student = await createStudent({
        studentNumber,
        firstName,
        lastName,
        middleInitial: '',
        gradeLevel: Number(gradeLevel),
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

  const parsedGrade = Number(gradeLevel);
  const complete = Boolean(
    studentNumber.trim() &&
      firstName.trim() &&
      lastName.trim() &&
      Number.isInteger(parsedGrade) &&
      parsedGrade >= 1 &&
      parsedGrade <= 12 &&
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
          placeholder="1 to 12"
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
        <Celebrate trigger={1} />
        <MascotPanel
          expression="happy"
          title="You're all set!"
          body="Pavo will show your most helpful formats first. This isn't a test — you can change it anytime."
        />
        <Card accent={colors.primary}>
          <CardHeader icon={GraduationCap} title="What's next" color={colors.primary} />
          <Text style={styles.body}>
            Your lesson library starts empty. Ask your teacher to send your first
            module — then scan the QR to add it here.
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
        overline={`Question ${step + 1} of ${LEARNING_ASSESSMENT.length}`}
        title="How do you like to learn?"
        onBack={step === 0 ? navigation.goBack : () => setStep((current) => current - 1)}
      />
      <ProgressBar value={(step + 1) / LEARNING_ASSESSMENT.length} />
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
        {error ? <ErrorNote message={error} /> : null}
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
        placeholderTextColor={colors.inkSubtle}
        selectionColor={colors.primary}
      />
    </View>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <View style={styles.errorNote}>
      <ShieldCheck size={16} color={colors.error} />
      <Text style={styles.error}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  landing: { flex: 1, justifyContent: 'space-between', paddingBottom: spacing.xxl },
  landingHero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  landingHalo: {
    width: 196,
    height: 196,
    borderRadius: radius.round,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  landingTagline: {
    ...text.body,
    color: colors.inkMuted,
    textAlign: 'center',
    maxWidth: 320,
    marginTop: spacing.xs,
  },
  landingActions: { gap: spacing.md },
  landingFoot: { ...text.caption, color: colors.inkSubtle, textAlign: 'center', marginTop: spacing.xs },
  roleScreen: { gap: spacing.lg },
  brandBlock: { alignItems: 'center', paddingTop: spacing.sm, paddingBottom: spacing.md, gap: spacing.xs },
  brandHalo: {
    width: 132,
    height: 132,
    borderRadius: radius.round,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  brandName: { ...text.display, color: colors.ink, fontSize: 38 },
  brandLine: { ...text.body, color: colors.inkMuted, textAlign: 'center', maxWidth: 320 },
  cardTitle: { ...text.title, color: colors.ink },
  body: { ...text.body, color: colors.inkMuted, fontSize: 15 },
  flex: { flex: 1, gap: spacing.xs },
  modeNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.successTint,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  modeText: { flex: 1, color: colors.inkMuted, ...text.caption },
  field: { gap: spacing.sm },
  fieldLabel: { color: colors.ink, ...text.label, fontWeight: '800' },
  input: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surface,
    color: colors.ink,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
  },
  errorNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.errorTint,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  error: { flex: 1, color: colors.error, ...text.label, fontWeight: '700' },
  guardianRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.outline,
    padding: spacing.md,
  },
  guardianText: { flex: 1, color: colors.inkMuted, ...text.label },
  optionList: { gap: spacing.md },
  option: {
    minHeight: 64,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.outline,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  optionPressed: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  optionDisabled: { opacity: 0.55 },
  optionText: { color: colors.ink, ...text.bodyStrong, fontSize: 17 },
  helper: { color: colors.inkMuted, textAlign: 'center', ...text.caption },
});
