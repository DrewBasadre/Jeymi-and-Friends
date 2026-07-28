import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Send, ShieldCheck } from 'lucide-react-native';
import { InteractiveLearningPreview } from '@/components/InteractiveLearningPreview';
import {
  Callout,
  EmptyState,
  PrimaryButton,
  Screen,
  ScreenHeader,
} from '@/components/ui';
import {
  appendPackageSharer,
  getLearningPackage,
} from '@/data/learningRepository';
import type { StoredLearningPackage } from '@/domain/types';
import type { RootStackParamList } from '@/navigation/types';
import { buildLearningPackage } from '@/services/learningPackages';
import { useSessionStore } from '@/store/session';
import { formatDate } from '@/utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'LearningPackage'>;

export function LearningPackageScreen({ navigation, route }: Props) {
  const student = useSessionStore((state) => state.student);
  const [learningPackage, setLearningPackage] =
    useState<StoredLearningPackage | null>(null);

  useEffect(() => {
    void getLearningPackage(route.params.packageId).then(setLearningPackage);
  }, [route.params.packageId]);

  async function share() {
    if (!student || !learningPackage) return;
    try {
      const manifest = await appendPackageSharer(
        learningPackage.packageId,
        student.id,
      );
      const transferPackage = await buildLearningPackage(manifest);
      navigation.navigate('Transfer', {
        packageUri: transferPackage.fileUri,
        displayName: transferPackage.displayName,
      });
    } catch (error) {
      Alert.alert(
        'Study Jam could not be shared',
        error instanceof Error ? error.message : 'Try again.',
      );
    }
  }

  if (!learningPackage) {
    return (
      <Screen>
        <ScreenHeader title="Study material" onBack={navigation.goBack} />
        <EmptyState
          title="Package unavailable"
          body="This material may have been removed from this device."
        />
      </Screen>
    );
  }

  const manifest = learningPackage.manifest;
  return (
    <Screen>
      <ScreenHeader
        overline={
          manifest.contentCategory === 'studentMaterial'
            ? 'Study Jam'
            : manifest.contentCategory === 'teacherReviewer'
              ? 'Teacher sent reviewer'
              : 'Teacher quiz'
        }
        title={manifest.title}
        subtitle={`Created ${formatDate(manifest.createdAt)}`}
        onBack={navigation.goBack}
      />
      <Callout
        icon={ShieldCheck}
        title="Saved on this device"
        body={
          manifest.contentCategory === 'studentMaterial'
            ? `Original creator: ${manifest.createdBy}. Shared by ${manifest.sharedBy.length} learner device${manifest.sharedBy.length === 1 ? '' : 's'}.`
            : 'Teacher-issued material cannot be re-shared by students.'
        }
        tone="info"
      />
      <InteractiveLearningPreview
        reviewItems={manifest.reviewItems}
        questions={manifest.quiz?.questions}
      />
      {manifest.contentCategory === 'studentMaterial' ? (
        <PrimaryButton
          label="Export & Share to a Classmate"
          icon={Send}
          onPress={() => void share()}
        />
      ) : null}
    </Screen>
  );
}
