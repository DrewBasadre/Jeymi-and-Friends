import type {
  CustomReviewSet,
  ReviewItem,
  TransferPackage,
} from '@/domain/types';
import {
  buildTeacherModulePackage,
  sha256File,
} from './modulePackages';

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
  return buildTeacherModulePackage({
    moduleId: `review-${set.setId}`,
    title: set.title,
    gradeLevel: 5,
    subject: 'ADDED_MATERIALS',
    markdown: [
      `# ${set.title}`,
      '',
      ...reviewItems.flatMap((item) => [
        `## ${item.prompt}`,
        '',
        item.answer,
        '',
      ]),
    ].join('\n'),
    images: [],
    reviewItems: reviewItems.map((item) => ({
      ...item,
      moduleId: `review-${set.setId}`,
      moduleVersion: 1,
    })),
  });
}

export { sha256File };

export async function verifyPackage(fileUri: string, expectedSha256: string): Promise<boolean> {
  return (await sha256File(fileUri)) === expectedSha256.toLocaleLowerCase();
}
