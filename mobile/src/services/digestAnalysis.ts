import { buildDigestCompanionRequest } from '@/domain/companion';
import type { CompanionResponse } from '@/domain/companion';
import type { ParentDigest } from '@/domain/types';
import { askPavo } from './companion';

export async function analyzeParentDigest(
  digest: ParentDigest,
  gradeLevel: number,
): Promise<CompanionResponse> {
  return askPavo(buildDigestCompanionRequest({ digest, gradeLevel }));
}
