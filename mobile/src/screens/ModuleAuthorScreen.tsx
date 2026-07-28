import { useEffect, useState } from 'react';
import type { ComponentProps } from 'react';
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
  FileImage,
  FileText,
  ListChecks,
  PackageCheck,
  Plus,
} from 'lucide-react-native';
import {
  Card,
  CardHeader,
  Chip,
  PrimaryButton,
  Screen,
  ScreenHeader,
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
import { colors, radius, spacing, text } from '@/theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'ModuleAuthor'>;

const SUBJECTS: Subject[] = [
  'SCIENCE',
  'MATH',
  'ENGLISH',
  'ADDED_MATERIALS',
];

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

  return (
    <Screen>
      <ScreenHeader
        title="Author module"
        subtitle="Markdown and local WebP photos"
        onBack={navigation.goBack}
      />
      <Card>
        <CardHeader icon={FileText} title="Module details" />
        <Field label="Module title" value={title} onChangeText={setTitle} />
        <Field
          label="Grade level"
          value={gradeLevel}
          onChangeText={setGradeLevel}
          keyboardType="number-pad"
        />
        <Text style={styles.label}>Subject</Text>
        <View style={styles.chips}>
          {SUBJECTS.map((option) => (
            <Chip
              key={option}
              label={option.replace('_', ' ')}
              selected={subject === option}
              onPress={() => setSubject(option)}
            />
          ))}
        </View>
      </Card>

      <Card>
        <CardHeader
          icon={Bot}
          title="AI assist"
          subtitle="This Android build uses manual authoring only."
          action={<StatusBadge label="Planned" status="locked" />}
        />
      </Card>

      <Card>
        <CardHeader
          icon={ListChecks}
          title="Review items"
          subtitle="Set the concept and importance here. Pavo will not infer either on the student device."
        />
        <Field
          label="Concept ID"
          value={conceptId}
          onChangeText={setConceptId}
          autoCapitalize="none"
          placeholder="fraction-subtraction"
        />
        <Text style={styles.label}>Item type</Text>
        <View style={styles.chips}>
          {(
            [
              'flashcard',
              'quiz-question',
              'concept-summary',
            ] as ReviewItemType[]
          ).map((option) => (
            <Chip
              key={option}
              label={option.replace('-', ' ')}
              selected={reviewType === option}
              onPress={() => setReviewType(option)}
            />
          ))}
        </View>
        <Text style={styles.label}>Importance</Text>
        <View style={styles.chips}>
          {(['core', 'supplementary', 'stretch'] as ReviewImportance[]).map(
            (option) => (
              <Chip
                key={option}
                label={option}
                selected={importance === option}
                onPress={() => setImportance(option)}
              />
            ),
          )}
        </View>
        <Field label="Prompt" value={prompt} onChangeText={setPrompt} multiline />
        <Field label="Answer" value={answer} onChangeText={setAnswer} multiline />
        <PrimaryButton
          label="Add review item"
          icon={Plus}
          tone="secondary"
          disabled={!conceptId.trim() || !prompt.trim() || !answer.trim()}
          onPress={addReviewItem}
        />
        {reviewItems.map((item) => (
          <View key={item.itemId} style={styles.reviewItem}>
            <Text style={styles.reviewTitle}>{item.prompt}</Text>
            <Text style={styles.helper}>
              {item.conceptId} · {item.type} · {item.importance}
            </Text>
          </View>
        ))}
      </Card>

      <Card>
        <CardHeader icon={BookOpen} title="Lesson Markdown" />
        <TextInput
          autoCapitalize="sentences"
          multiline
          onChangeText={setMarkdown}
          placeholder="# Lesson title"
          placeholderTextColor={colors.inkMuted}
          style={[styles.input, styles.editor]}
          textAlignVertical="top"
          value={markdown}
        />
        <PrimaryButton
          label="Attach photos as WebP"
          icon={FileImage}
          loading={busy}
          tone="secondary"
          onPress={() => void addPhotos()}
        />
        {images.length ? (
          <View style={styles.imageGrid}>
            {images.map((image) => (
              <View key={image.packagePath} style={styles.imageItem}>
                <Image source={{ uri: image.fileUri }} style={styles.image} />
                <Text numberOfLines={2} style={styles.imageName}>
                  {image.packagePath}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </Card>

      <PrimaryButton
        label="Build and share module"
        icon={PackageCheck}
        loading={busy}
        onPress={() => void buildAndShare()}
      />
    </Screen>
  );
}

function Field({
  label,
  ...props
}: {
  label: string;
} & ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.inkMuted}
        style={[styles.input, props.multiline && styles.multiline]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs },
  label: {
    ...text.label,
    color: colors.ink,
  },
  input: {
    ...text.body,
    backgroundColor: colors.surface,
    borderColor: colors.outline,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.ink,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  multiline: { minHeight: 82, textAlignVertical: 'top' },
  helper: {
    ...text.caption,
    color: colors.inkMuted,
  },
  reviewItem: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  reviewTitle: {
    ...text.bodyStrong,
    color: colors.ink,
  },
  editor: {
    fontFamily: 'monospace',
    minHeight: 320,
    textAlignVertical: 'top',
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
  },
});
