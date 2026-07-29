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
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  GraduationCap,
  KeyRound,
  Lock,
  School,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
  WifiOff,
  type LucideIcon,
} from 'lucide-react-native';
import {
  Callout,
  Card,
  CardHeader,
  HeroCard,
  IconPlate,
  PressableScale,
  PrimaryButton,
  ProgressBar,
  Screen,
  ScreenHeader,
  SectionHeader,
} from '@/components/ui';
import { Celebrate, MascotPanel, PeacockPhase } from '@/components/mascot';
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
import { colors, elevation, gradients, radius, spacing, text } from '@/theme/tokens';

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
      <View style={styles.landingTop}>
        <HeroCard ramp={gradients.hero} style={styles.landingHero}>
          <View style={styles.landingHalo}>
            <PeacockPhase phase={5} size={124} accessibilityLabel="Pavo the peacock" />
          </View>
          <View style={styles.landingWordmark}>
            <Text style={styles.landingOverline}>OFFLINE LEARNING COMPANION</Text>
            <Text style={styles.brandNameHero} accessibilityRole="header">
              Pavo
            </Text>
            <Text style={styles.landingTagline}>
              Grow your peacock as you learn.
            </Text>
          </View>
        </HeroCard>

        <View style={styles.pillRow}>
          <TrustPill icon={WifiOff} label="Works offline" />
          <TrustPill icon={ShieldCheck} label="No account needed" />
          <TrustPill icon={School} label="Built for class" />
        </View>
      </View>

      <View style={styles.landingActions}>
        <PrimaryButton label="Start learning" icon={Sparkles} onPress={() => navigation.navigate('Role')} />
        <PrimaryButton
          label="Explore a demo classroom"
          tone="ghost"
          loading={loadingDemo}
          onPress={() => void exploreDemo()}
        />
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
          <PeacockPhase phase={5} size={92} />
        </View>
        <Text style={styles.brandName} accessibilityRole="header">
          Pavo
        </Text>
      </View>

      <SectionHeader
        title="Who's using this device?"
        caption="You can switch roles later by signing out."
      />

      <RoleCard
        icon={UserRound}
        color={colors.primary}
        title="I'm a student"
        subtitle="Open lessons, practice with flashcards, and share results."
        bullets={[
          'Read modules with no internet',
          'Review flashcards right when they help',
          'Send a QR report to your teacher',
        ]}
        actionLabel="Continue as student"
        onPress={() => {
          chooseRole('student');
          navigation.navigate('StudentLogin');
        }}
      />

      <RoleCard
        icon={UsersRound}
        color={colors.secondary}
        title="I'm a teacher"
        subtitle="Scan reports, review the class, and prepare modules."
        bullets={[
          'Scan student QR reports offline',
          'Track the class at a glance',
          'Send modules to nearby devices',
        ]}
        actionLabel="Continue as teacher"
        onPress={() => {
          chooseRole('teacher');
          navigation.navigate('TeacherLogin');
        }}
      />

      <Callout
        icon={ShieldCheck}
        tone={mode === 'lightweight' ? 'info' : 'success'}
        title={mode === 'lightweight' ? 'Lightweight mode' : 'Full mode'}
        body={
          mode === 'lightweight'
            ? 'Trimmed to run smoothly on this device.'
            : 'All features are available on this device.'
        }
      />
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
      <ScreenHeader
        overline="Student"
        title="Sign in"
        subtitle="Pick up right where you left off."
        onBack={navigation.goBack}
      />
      <Card>
        <CardHeader
          icon={UserRound}
          color={colors.primary}
          title="Your details"
          subtitle="Ask your teacher if you are unsure of your student number."
        />
        <Field
          label="Student number or last name"
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="username"
          placeholder="Example: 2026-001"
        />
        <Field
          label="PIN"
          value={pin}
          onChangeText={setPin}
          keyboardType="number-pad"
          secureTextEntry
          autoComplete="off"
          textContentType="password"
          placeholder="4 digits"
        />
        {error ? (
          <Callout tone="error" icon={CircleAlert} title="We couldn't sign you in" body={error} />
        ) : null}
        <PrimaryButton
          label="Sign in"
          loading={loading}
          disabled={!identifier.trim() || pin.length < 4}
          onPress={submit}
        />
        <DeviceNote />
      </Card>

      <SectionHeader title="New here?" caption="First time on this device" />
      <PrimaryButton
        label="Create a student profile"
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
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
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
          parentName,
          parentPhone,
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
      parentName.trim() &&
      parentPhone.trim().length >= 7 &&
      Number.isInteger(parsedGrade) &&
      parsedGrade >= 1 &&
      parsedGrade <= 10 &&
      section.trim() &&
      pin.length >= 4,
  );
  return (
    <Screen>
      <ScreenHeader
        overline="Setup · step 1 of 2"
        title="Create a profile"
        subtitle="A parent or guardian can help with this first setup."
        onBack={navigation.goBack}
      />

      <Card>
        <CardHeader icon={UserRound} color={colors.primary} title="About you" />
        <Field
          label="Student number"
          value={studentNumber}
          onChangeText={setStudentNumber}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="2026-001"
        />
        <Field
          label="First name"
          value={firstName}
          onChangeText={setFirstName}
          autoCapitalize="words"
          placeholder="First name"
        />
        <Field
          label="Last name"
          value={lastName}
          onChangeText={setLastName}
          autoCapitalize="words"
          placeholder="Last name"
        />
      </Card>

      <Card>
        <CardHeader
          icon={UsersRound}
          color={colors.accentText}
          title="Parent contact"
        />
        <Field
          label="Parent or guardian name"
          value={parentName}
          onChangeText={setParentName}
          autoCapitalize="words"
          placeholder="Juan Santos"
        />
        <Field
          label="Mobile number"
          value={parentPhone}
          onChangeText={setParentPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          placeholder="+63 917 123 4567"
          hint="Shared with the teacher only through your profile QR."
        />
      </Card>

      <Card>
        <CardHeader icon={School} color={colors.secondary} title="Your class" />
        <Field
          label="Grade level"
          value={gradeLevel}
          onChangeText={setGradeLevel}
          keyboardType="number-pad"
          placeholder="1 to 10"
        />
        <Field
          label="Section"
          value={section}
          onChangeText={setSection}
          autoCapitalize="words"
          placeholder="Mabini"
        />
      </Card>

      <Card>
        <CardHeader
          icon={KeyRound}
          color={colors.accentText}
          title="Your PIN"
          subtitle="You will use this every time you sign in."
        />
        <Field
          label="Create a PIN"
          value={pin}
          onChangeText={setPin}
          keyboardType="number-pad"
          secureTextEntry
          autoComplete="off"
          textContentType="newPassword"
          placeholder="At least 4 digits"
        />
        {seedStatus ? <Text style={styles.helper}>{seedStatus}</Text> : null}
        <DeviceNote label="Your PIN is stored only on this device — never uploaded." />
      </Card>

      <PrimaryButton label="Save and continue" loading={saving} disabled={!complete} onPress={save} />
    </Screen>
  );
}

export function LearningAssessmentScreen({ navigation, route }: Props<'LearningAssessment'>) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<LearningAssessmentAnswer[]>([]);
  const [guardianAcknowledged, setGuardianAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);
  const question = LEARNING_ASSESSMENT[step];
  const total = LEARNING_ASSESSMENT.length;

  if (!question) {
    return (
      <Screen>
        <Celebrate trigger={1} />
        <MascotPanel
          expression="happy"
          title="You're all set!"
          body="Pavo will show your most helpful formats first — you can change this anytime."
        />
        <Callout
          tone="success"
          icon={CheckCircle2}
          title="Learning profile saved"
          body={`All ${total} questions answered.`}
        />
        <Card accent={colors.primary}>
          <CardHeader icon={GraduationCap} title="What's next" color={colors.primary} />
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

  const chosen = answers.find((answer) => answer.questionId === question.id)?.style;

  return (
    <Screen>
      <ScreenHeader
        overline={`Question ${step + 1} of ${total}`}
        title="How do you like to learn?"
        onBack={step === 0 ? navigation.goBack : () => setStep((current) => current - 1)}
      />

      <ProgressBar
        value={(step + 1) / total}
        accessibilityLabel={`Question ${step + 1} of ${total}`}
      />

      {step === 0 ? (
        <View style={styles.guardianRow}>
          <IconPlate icon={ShieldCheck} color={colors.success} size={38} />
          <View style={styles.flex}>
            <Text style={styles.guardianTitle}>Guardian helping</Text>
            <Text style={styles.guardianText}>A parent or guardian is helping with first setup.</Text>
          </View>
          <Switch
            value={guardianAcknowledged}
            onValueChange={setGuardianAcknowledged}
            accessibilityLabel="A parent or guardian is helping with first setup"
            trackColor={{ false: colors.outline, true: colors.successTint }}
            thumbColor={guardianAcknowledged ? colors.success : colors.inkMuted}
          />
        </View>
      ) : null}

      <Card accent={colors.primary}>
        <View style={styles.eyebrowRow}>
          <Sparkles size={15} color={colors.inkSubtle} />
          <Text style={styles.eyebrow}>Pick the one that feels most like you</Text>
        </View>
        <Text style={styles.question}>{question.prompt}</Text>
      </Card>

      <View style={styles.optionList}>
        {question.options.map((option, optionIndex) => {
          const isSelected = chosen === option.style;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              accessibilityLabel={`Option ${String.fromCharCode(65 + optionIndex)}. ${option.label}`}
              accessibilityState={{ selected: isSelected, disabled: saving }}
              disabled={saving}
              onPress={() => select({ questionId: question.id, style: option.style })}
              style={({ pressed }) => [
                styles.answerOption,
                isSelected && styles.answerSelected,
                pressed && !isSelected && styles.answerPressed,
                saving && styles.optionDisabled,
              ]}
            >
              <View style={[styles.optionKey, isSelected && styles.optionKeySelected]}>
                {isSelected ? (
                  <CheckCircle2 size={17} color={colors.white} />
                ) : (
                  <Text style={styles.optionKeyText}>
                    {String.fromCharCode(65 + optionIndex)}
                  </Text>
                )}
              </View>
              <Text style={styles.answerText}>{option.label}</Text>
              <ChevronRight size={18} color={colors.inkSubtle} />
            </Pressable>
          );
        })}
      </View>

      {saving ? <Text style={styles.helper}>Preparing offline lessons…</Text> : null}
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
        overline="Teacher"
        title={existingId ? 'Teacher profile' : 'Create teacher profile'}
        subtitle={
          existingId
            ? 'Your saved teacher details.'
            : 'Set up once to scan reports and send modules.'
        }
        onBack={navigation.goBack}
      />
      <Card>
        <CardHeader
          icon={UsersRound}
          color={colors.secondary}
          title="Faculty details"
          subtitle="Used to label the reports you scan and the modules you send."
        />
        <Field
          label="Faculty ID"
          value={facultyId}
          onChangeText={setFacultyId}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="Example: FAC-2026-014"
        />
        <Field
          label="Full name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          placeholder="Full name"
        />
        <Field
          label="Age"
          value={age}
          onChangeText={setAge}
          keyboardType="number-pad"
          placeholder="18 or older"
        />
        {error ? (
          <Callout tone="error" icon={CircleAlert} title="We couldn't open that profile" body={error} />
        ) : null}
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
        <DeviceNote label="Your data stays on this device — nothing is uploaded." />
      </Card>
    </Screen>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Local building blocks
   ──────────────────────────────────────────────────────────────────────── */

/** Small trust/feature marker used on the landing screen. */
function TrustPill({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <View style={styles.trustPill}>
      <Icon size={13} color={colors.primary} />
      <Text style={styles.trustPillText}>{label}</Text>
    </View>
  );
}

/** Rich, tappable role choice — icon plate, what you get, and a clear next step. */
function RoleCard({
  icon,
  color,
  title,
  subtitle,
  bullets,
  actionLabel,
  onPress,
}: {
  icon: LucideIcon;
  color: string;
  title: string;
  subtitle: string;
  bullets: string[];
  actionLabel: string;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={`${title}. ${subtitle}`}
      accessibilityHint={actionLabel}
    >
      <View style={[styles.roleCard, { borderLeftColor: color }]}>
        <View style={styles.roleTop}>
          <IconPlate icon={icon} color={color} size={48} />
          <View style={styles.flex}>
            <Text style={styles.roleTitle}>{title}</Text>
            <Text style={styles.roleSubtitle}>{subtitle}</Text>
          </View>
        </View>
        <View style={styles.roleBullets}>
          {bullets.map((bullet) => (
            <View key={bullet} style={styles.bulletRow}>
              <CheckCircle2 size={15} color={color} />
              <Text style={styles.bulletText}>{bullet}</Text>
            </View>
          ))}
        </View>
        <View style={styles.roleAction}>
          <Text style={[styles.roleActionText, { color }]}>{actionLabel}</Text>
          <ChevronRight size={18} color={color} />
        </View>
      </View>
    </PressableScale>
  );
}

/** Quiet reassurance line under a form. */
function DeviceNote({ label = 'Your data stays on this device.' }: { label?: string }) {
  return (
    <View style={styles.deviceNote}>
      <Lock size={13} color={colors.inkSubtle} />
      <Text style={styles.deviceNoteText}>{label}</Text>
    </View>
  );
}

/**
 * Text field with a floating-style label inside the frame. The frame — not the
 * text — carries the focus state, so the active field is obvious at a glance.
 */
function Field({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & ComponentProps<typeof TextInput>) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.fieldBlock}>
      <View style={[styles.field, focused && styles.fieldFocused]}>
        <Text style={[styles.fieldLabel, focused && styles.fieldLabelFocused]}>{label}</Text>
        <TextInput
          {...props}
          accessibilityLabel={label}
          style={styles.input}
          placeholderTextColor={colors.inkSubtle}
          selectionColor={colors.primary}
          onFocus={(event) => {
            setFocused(true);
            props.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            props.onBlur?.(event);
          }}
        />
      </View>
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  body: { ...text.bodySm, color: colors.inkMuted },

  // ── Landing ───────────────────────────────────────────────────────────
  landing: { flex: 1, justifyContent: 'space-between', paddingBottom: spacing.xxl },
  landingTop: { flex: 1, justifyContent: 'center', gap: spacing.lg },
  landingHero: { alignItems: 'center', paddingVertical: spacing.xxl },
  landingHalo: {
    width: 168,
    height: 168,
    borderRadius: radius.round,
    backgroundColor: colors.onBrandSurface,
    borderWidth: 1,
    borderColor: colors.onBrandLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  landingWordmark: { alignItems: 'center', gap: spacing.xs },
  landingOverline: { ...text.overline, color: colors.accent, fontSize: 11 },
  brandNameHero: { ...text.hero, color: colors.onBrand },
  landingTagline: {
    ...text.bodySm,
    color: colors.onBrandMuted,
    textAlign: 'center',
    maxWidth: 320,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  trustPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.round,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...elevation.e0,
  },
  trustPillText: { ...text.caption, color: colors.inkMuted, fontWeight: '700' },
  landingActions: { gap: spacing.md },

  // ── Role ──────────────────────────────────────────────────────────────
  roleScreen: { gap: spacing.lg },
  brandBlock: { alignItems: 'center', paddingTop: spacing.sm, gap: spacing.xs },
  brandHalo: {
    width: 120,
    height: 120,
    borderRadius: radius.round,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  brandName: { ...text.display, color: colors.ink, fontSize: 38 },
  roleCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outline,
    borderLeftWidth: 5,
    padding: spacing.lg,
    gap: spacing.md,
    ...elevation.e1,
  },
  roleTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  roleTitle: { ...text.title, color: colors.ink },
  roleSubtitle: { ...text.caption, color: colors.inkMuted, fontWeight: '500', marginTop: 2 },
  roleBullets: { gap: spacing.sm },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bulletText: { ...text.caption, color: colors.inkMuted, fontWeight: '500', flex: 1 },
  roleAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 28,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  roleActionText: { ...text.label, fontWeight: '800' },

  // ── Forms ─────────────────────────────────────────────────────────────
  fieldBlock: { gap: spacing.xs },
  field: {
    minHeight: 64,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.outline,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    justifyContent: 'center',
  },
  fieldFocused: { borderColor: colors.primary, backgroundColor: colors.n0 },
  fieldLabel: { ...text.tiny, color: colors.inkSubtle, letterSpacing: 0.3 },
  fieldLabelFocused: { color: colors.primary },
  input: {
    minHeight: 30,
    padding: 0,
    color: colors.ink,
    ...text.body,
  },
  fieldHint: { ...text.caption, color: colors.inkSubtle, fontWeight: '500', paddingHorizontal: spacing.xs },
  deviceNote: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  deviceNoteText: { ...text.caption, color: colors.inkSubtle, fontWeight: '500', flex: 1 },

  // ── Assessment ────────────────────────────────────────────────────────
  guardianRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.outline,
    padding: spacing.md,
  },
  guardianTitle: { ...text.bodyStrong, color: colors.ink },
  guardianText: { ...text.caption, color: colors.inkMuted, fontWeight: '500', marginTop: 1 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  eyebrow: { ...text.caption, color: colors.inkSubtle, fontWeight: '600' },
  question: { ...text.h2, color: colors.ink, fontSize: 21, lineHeight: 29 },
  optionList: { gap: spacing.md },
  answerOption: {
    minHeight: 64,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.outline,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  answerSelected: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  answerPressed: { backgroundColor: colors.surfaceMuted },
  optionDisabled: { opacity: 0.55 },
  optionKey: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.outlineStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionKeySelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  optionKeyText: { ...text.label, color: colors.inkMuted, fontWeight: '800' },
  answerText: { flex: 1, color: colors.ink, ...text.bodyStrong },
  helper: { color: colors.inkMuted, textAlign: 'center', ...text.caption, fontWeight: '500' },
});
