import type {
  CustomReviewSet,
  ReviewItem,
  StudyPackageManifest,
  TransferPackage,
} from '@/domain/types';
import { buildLearningPackage } from './learningPackages';
import { sha256File } from './modulePackages';

export async function buildReviewSetPackage(
  set: CustomReviewSet,
  availableItems: ReviewItem[],
): Promise<TransferPackage> {
  const selected = new Map(availableItems.map((item) => [item.itemId, item]));
  const reviewItems = [
    ...set.itemIds.flatMap((itemId) => {
      const item = selected.get(itemId);
      return item ? [item] : [];
    }),
    ...set.createdItems,
  ];
  const packageId = `review-${set.setId}`;
  const manifest: StudyPackageManifest = {
    packageId,
    version: 1,
    contentCategory: 'teacherReviewer',
    title: set.title,
    reviewItems: reviewItems.map((item) => ({
      ...item,
      moduleId: packageId,
      moduleVersion: 1,
    })),
    createdBy: set.createdBy,
    sharedBy: [],
    createdAt: new Date(set.createdAt).toISOString(),
  };
  return buildLearningPackage(manifest);
}

export { sha256File };

export async function verifyPackage(fileUri: string, expectedSha256: string): Promise<boolean> {
  return (await sha256File(fileUri)) === expectedSha256.toLocaleLowerCase();
}
