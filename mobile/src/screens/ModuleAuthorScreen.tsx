import { useEffect, useMemo, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Crypto from 'expo-crypto';
import {
  BookOpen,
  Bot,
  CheckCircle2,
  FileImage,
  FileText,
  ListChecks,
  PackageCheck,
  Plus,
  TriangleAlert,
  Type,
} from 'lucide-react-native';
import {
  Callout,
  Card,
  CardHeader,
  Chip,
  Divider,
  PrimaryButton,
  Row,
  Screen,
  ScreenHeader,
  SectionHeader,
  StatTile,
  StatusBadge,
} from '@/components/ui';
import {
  getTeacherProfile,
  saveReceivedModulePackage,
} from '@/data/repository';
import type {
  ReviewImportance,
  ReviewItem,
  ReviewItemType,
  Subject,
} from '@/domain/types';
import type { RootStackParamList } from '@/navigation/types';
import {
  buildTeacherModulePackage,
  markdownImageSnippet,
  pickAndProcessModuleImages,
  type TeacherModuleImage,
} from '@/services/modulePackages';
import { colors, radius, spacing, subjectColor, text } from '@/theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'ModuleAuthor'>;

const SUBJECTS: Subject[] = [
  'SCIENCE',
  'MATH',
  'ENGLISH',
  'ADDED_MATERIALS',
];

const REVIEW_TYPES: ReviewItemType[] = [
  'flashcard',
  'quiz-question',
  'concept-summary',
];

const IMPORTANCES: ReviewImportance[] = ['core', 'supplementary', 'stretch'];

export function ModuleAuthorScreen({ navigation }: Props) {
  const [title, setTitle] = useState('');
  const [gradeLevel, setGradeLevel] = useState('5');
  const [subject, setSubject] = useState<Subject>('ADDED_MATERIALS');
  const [markdown, setMarkdown] = useState(
    '# Lesson title\n\nWrite the lesson here using Markdown.\n\n## Try it\n\nAdd a short activity.',
  );
  const [images, setImages] = useState<TeacherModuleImage[]>([]);
  const [teacherId, setTeacherId] = useState('local-teacher');
  const [conceptId, setConceptId] = useState('');
  const [reviewType, setReviewType] =
    useState<ReviewItemType>('flashcard');
  const [importance, setImportance] =
    useState<ReviewImportance>('core');
  const [prompt, setPrompt] = useState('');
  const [answer, setAnswer] = useState('');
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getTeacherProfile().then((profile) => {
      if (profile) setTeacherId(profile.teacherId);
    });
  }, []);

  function addReviewItem() {
    if (!conceptId.trim() || !prompt.trim() || !answer.trim()) return;
    setReviewItems((current) => [
      ...current,
      {
        itemId: Crypto.randomUUID(),
        moduleId: '',
        moduleVersion: 1,
        conceptId: conceptId.trim(),
        type: reviewType,
        importance,
        prompt: prompt.trim(),
        answer: answer.trim(),
        formats: { text: answer.trim() },
        authoredBy: `teacher:${teacherId}`,
        tags: [],
      },
    ]);
    setPrompt('');
    setAnswer('');
  }

  async function addPhotos() {
    setBusy(true);
    try {
      const next = await pickAndProcessModuleImages(title || 'lesson');
      if (!next.length) return;
      setImages((current) => [...current, ...next]);
      setMarkdown((current) =>
        [
          current.trimEnd(),
          '',
          ...next.flatMap((image) => [markdownImageSnippet(image), '']),
        ].join('\n'),
      );
    } catch (error) {
      Alert.alert(
        'Photos could not be added',
        error instanceof Error ? error.message : 'Choose another image.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function buildAndShare() {
    const parsedGrade = Number(gradeLevel);
    if (
      !title.trim() ||
      !markdown.trim() ||
      !Number.isInteger(parsedGrade) ||
      parsedGrade < 1 ||
      parsedGrade > 12
    ) {
      Alert.alert(
        'Check the module',
        'Add a title, Markdown lesson, and grade level from 1 to 12.',
      );
      return;
    }
    setBusy(true);
    try {
      const transferPackage = await buildTeacherModulePackage({
        title: title.trim(),
        gradeLevel: parsedGrade,
        subject,
        markdown,
        images,
        reviewItems,
      });
      await saveReceivedModulePackage(transferPackage);
      navigation.replace('Transfer', {
        packageUri: transferPackage.fileUri,
        displayName: transferPackage.displayName,
      });
    } catch (error) {
      Alert.alert(
        'Module could not be built',
        error instanceof Error ? error.message : 'Review the module and retry.',
      );
    } finally {
      setBusy(false);
    }
  }

  // ── Live summary (presentation only — mirrors the checks in buildAndShare)
  const parsedGrade = Number(gradeLevel);
  const gradeValid =
    Number.isInteger(parsedGrade) && parsedGrade >= 1 && parsedGrade <= 12;
  const wordCount = useMemo(
    () => markdown.trim().split(/\s+/).filter(Boolean).length,
    [markdown],
  );
  const missing = [
    !title.trim() ? 'a title' : null,
    !markdown.trim() ? 'a Markdown lesson' : null,
    !gradeValid ? 'a grade level from 1 to 12' : null,
  ].filter((entry): entry is string => entry !== null);
  const canAddReviewItem =
    !!conceptId.trim() && !!prompt.trim() && !!answer.trim();

  return (
    <Screen>
      <ScreenHeader
        overline="Teacher tools"
        title="Author module"
        subtitle="Write in markdown, attach local photos, and share it device to device."
        onBack={navigation.goBack}
      />

      <SectionHeader
        title="Module details"
        caption="How the lesson is label={led} on a student's device"
      />
      <Card>
        <CardHeader
          icon={FileText}
          title="Identity"
          subtitle="Title, grade level, and subject"
        />
        <Divider />
        <Field
          label="Module title"
          helper="Shown on the student's module card — keep it short and specific."
          value={title}
          onChangeText={setTitle}
          placeholder="Example: subtracting fractions"
        />
        <Field
          label="Grade level"
          helper="A whole number from 1 to 12."
          invalid={gradeLevel.length > 0 && !gradeValid}
          invalidHelper="Enter a whole number between 1 and 12."
          value={gradeLevel}
          onChangeText={setGradeLevel}
          keyboardType="number-pad"
        />
        <FieldGroup
          label="Subject"
          helper="Sets the colour and grouping students see."
        >
          {SUBJECTS.map((option) => (
            <Chip
              key={option}
              label={toTitleCase(option)}
              color={subjectColor[option]}
              selected={subject === option}
              onPress={() => setSubject(option)}
            />
          ))}
        </FieldGroup>
      </Card>

      <SectionHeader
        title="Lesson content"
        caption="Markdown is stored offline and rendered on the student device"
      />
      <Card>
        <CardHeader
          icon={BookOpen}
          title="Lesson markdown"
          subtitle={`${wordCount} word${wordCount === 1 ? '' : 's'}`}
          action={
            <StatusBadge
              label={markdown.trim() ? 'Drafted' : 'Empty'}
              status={markdown.trim() ? 'inProgress' : 'notStarted'}
            />
          }
        />
        <Divider />
        <Editor value={markdown} onChangeText={setMarkdown} />
        <Text style={styles.helper}>
          Headings, lists and emphasis are supported — images you attach are
          appended as Markdown automatically.
        </Text>
        <PrimaryButton
          label="Attach photos as WebP"
          icon={FileImage}
          loading={busy}
          tone="secondary"
          onPress={() => void addPhotos()}
        />
        {images.length ? (
          <>
            <Divider />
            <Text style={styles.groupLabel}>
              {images.length} attached photo{images.length === 1 ? '' : 's'}
            </Text>
            <View style={styles.imageGrid}>
              {images.map((image) => (
                <View key={image.packagePath} style={styles.imageItem}>
                  <Image
                    source={{ uri: image.fileUri }}
                    style={styles.image}
                    accessibilityLabel={`Attached photo ${image.packagePath}`}
                  />
                  <Text numberOfLines={2} style={styles.imageName}>
                    {image.packagePath}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </Card>

      <SectionHeader
        title="Review items"
        caption="Flashcards and checks that feed the student's review queue"
      />
      <Card>
        <CardHeader
          icon={ListChecks}
          title="Add an item"
          subtitle="Pavo never infers the concept or importance on the student device — set both here."
          color={colors.secondary}
        />
        <Divider />
        <Field
          label="Concept ID"
          helper="A stable, lowercase key that groups related items."
          value={conceptId}
          onChangeText={setConceptId}
          autoCapitalize="none"
          placeholder="Example: fraction-subtraction"
        />
        <FieldGroup
          label="Item type"
          helper="How the item is presented during review."
        >
          {REVIEW_TYPES.map((option) => (
            <Chip
              key={option}
              label={toTitleCase(option)}
              selected={reviewType === option}
              onPress={() => setReviewType(option)}
            />
          ))}
        </FieldGroup>
        <FieldGroup
          label="Importance"
          helper="Core items are scheduled first when review time is short."
        >
          {IMPORTANCES.map((option) => (
            <Chip
              key={option}
              label={toTitleCase(option)}
              selected={importance === option}
              onPress={() => setImportance(option)}
            />
          ))}
        </FieldGroup>
        <Field
          label="Prompt"
          helper="The question the student sees first."
          value={prompt}
          onChangeText={setPrompt}
          multiline
        />
        <Field
          label="Answer"
          helper="The response Pavo reveals or checks against."
          value={answer}
          onChangeText={setAnswer}
          multiline
        />
        <PrimaryButton
          label="Add review item"
          icon={Plus}
          tone="secondary"
          disabled={!canAddReviewItem}
          onPress={addReviewItem}
        />
      </Card>

      {reviewItems.length ? (
        <Card>
          <CardHeader
            icon={ListChecks}
            title="Items in this module"
            subtitle={`${reviewItems.length} item${
              reviewItems.length === 1 ? '' : 's'
            } will ship with the package`}
            color={colors.success}
          />
          <Divider />
          {reviewItems.map((item) => (
            <View key={item.itemId} style={styles.reviewItem}>
              <Text style={styles.reviewTitle} numberOfLines={3}>
                {item.prompt}
              </Text>
              <Row gap={spacing.xs} wrap>
                <Chip label={item.conceptId} size="sm" />
                <Chip label={toTitleCase(item.type)} size="sm" />
                <Chip label={toTitleCase(item.importance)} size="sm" />
              </Row>
            </View>
          ))}
        </Card>
      ) : null}

      <Card>
        <CardHeader
          icon={Bot}
          title="AI assist"
          subtitle="This build uses manual authoring only — drafting help is planned."
          color={colors.inkSubtle}
          action={<StatusBadge label="Planned" status="locked" />}
        />
      </Card>

      <SectionHeader
        title="Publish"
        caption="Package the module, then hand it to a nearby device"
      />
      <Card>
        <CardHeader
          icon={PackageCheck}
          title={title.trim() || 'Untitled module'}
          subtitle={`${toTitleCase(subject)} · ${
            gradeValid ? `Grade ${parsedGrade}` : 'Grade level not set'
          }`}
        />
        <Divider />
        <Row gap={spacing.sm} align="stretch" wrap>
          <StatTile icon={Type} label="Words" value={wordCount} />
          <StatTile
            icon={FileImage}
            label="Photos"
            value={images.length}
            color={colors.secondary}
          />
          <StatTile
            icon={ListChecks}
            label="Review items"
            value={reviewItems.length}
            color={colors.success}
          />
        </Row>
        {missing.length ? (
          <Callout
            icon={TriangleAlert}
            tone="warning"
            title="Almost ready"
            body={`Still needed — ${formatList(missing)}.`}
          />
        ) : (
          <Callout
            icon={CheckCircle2}
            tone="success"
            title="Ready to build"
            body="Everything required is in place — build the package to share it."
          />
        )}
        <PrimaryButton
          label="Build and share module"
          icon={PackageCheck}
          loading={busy}
          onPress={() => void buildAndShare()}
        />
      </Card>
    </Screen>
  );
}

/* ── Form primitives ───────────────────────────────────────────────────── */

function Field({
  label,
  helper,
  invalid,
  invalidHelper,
  ...props
}: {
  label: string;
  helper?: string;
  invalid?: boolean;
  invalidHelper?: string;
} & ComponentProps<typeof TextInput>) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.groupLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        {...props}
        onFocus={(event) => {
          setFocused(true);
          props.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          props.onBlur?.(event);
        }}
        placeholderTextColor={colors.inkSubtle}
        style={[
          styles.input,
          props.multiline && styles.multiline,
          focused && styles.inputFocused,
          invalid && styles.inputInvalid,
        ]}
      />
      {invalid && invalidHelper ? (
        <Text style={styles.helperError}>{invalidHelper}</Text>
      ) : helper ? (
        <Text style={styles.helper}>{helper}</Text>
      ) : null}
    </View>
  );
}

/** A label={led} row of chips — the non-text sibling of `Field`. */
function FieldGroup({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.chips}>{children}</View>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

function Editor({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (next: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      accessibilityLabel="Lesson Markdown"
      autoCapitalize="sentences"
      multiline
      onChangeText={onChangeText}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder="# Lesson title"
      placeholderTextColor={colors.inkSubtle}
      style={[styles.input, styles.editor, focused && styles.inputFocused]}
      textAlignVertical="top"
      value={value}
    />
  );
}

/* ── Text helpers ──────────────────────────────────────────────────────── */

function toTitleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .toLocaleLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => `${word[0]?.toLocaleUpperCase() ?? ''}${word.slice(1)}`)
    .join(' ');
}

function formatList(entries: string[]): string {
  if (entries.length <= 1) return entries[0] ?? '';
  return `${entries.slice(0, -1).join(', ')} and ${entries[entries.length - 1]}`;
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  groupLabel: {
    ...text.label,
    color: colors.ink,
    fontWeight: '700',
  },
  input: {
    ...text.body,
    backgroundColor: colors.surface,
    borderColor: colors.outline,
    borderRadius: radius.md,
    borderWidth: 1.5,
    color: colors.ink,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  inputFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  inputInvalid: { borderColor: colors.error },
  multiline: { minHeight: 82, textAlignVertical: 'top' },
  editor: {
    fontFamily: 'monospace',
    minHeight: 320,
    textAlignVertical: 'top',
    backgroundColor: colors.surfaceMuted,
  },
  helper: {
    ...text.caption,
    color: colors.inkMuted,
    fontWeight: '500',
  },
  helperError: {
    ...text.caption,
    color: colors.error,
    fontWeight: '600',
  },
  reviewItem: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  reviewTitle: {
    ...text.bodyStrong,
    color: colors.ink,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  imageItem: { gap: spacing.xs, width: 120 },
  image: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    height: 90,
    width: 120,
  },
  imageName: {
    ...text.caption,
    color: colors.inkMuted,
    fontWeight: '500',
  },
});
