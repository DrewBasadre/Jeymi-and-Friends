import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { getDatabase } from '@/data/database';
import { initializeStudentReviewData } from '@/data/mvpRepository';
import { saveSeedModulePackage } from '@/data/repository';
import { BUNDLED_MODULES } from '@/seed/generatedRegistry';

export interface SeedProvisionProgress {
  completed: number;
  total: number;
  title: string;
}

export async function provisionSeedBundleForGrade(
  studentId: string,
  gradeLevel: number,
  onProgress?: (progress: SeedProvisionProgress) => void,
): Promise<number> {
  const modules = BUNDLED_MODULES.filter(
    (module) => module.gradeLevel === gradeLevel,
  );
  if (modules.length === 0) {
    throw new Error(`No bundled Grade ${gradeLevel} demo modules were found.`);
  }

  const database = await getDatabase();
  let installed = 0;
  for (const [index, module] of modules.entries()) {
    const existing = await database.getFirstAsync<{ module_id: string }>(
      `SELECT mm.module_id
       FROM module_manifests mm
       JOIN modules m ON m.id = mm.module_id
       WHERE mm.module_id = ? AND mm.source = 'seed-bundle'
         AND m.grade_level = ?`,
      module.moduleId,
      gradeLevel,
    );
    if (!existing) {
      const asset = Asset.fromModule(module.archiveAsset);
      await asset.downloadAsync();
      if (!asset.localUri) {
        throw new Error(`The bundled module ${module.title} is unavailable.`);
      }
      const file = new File(asset.localUri);
      await saveSeedModulePackage({
        moduleId: module.moduleId,
        displayName: module.title,
        fileUri: file.uri,
        sizeBytes: file.size,
      });
      installed += 1;
    }
    onProgress?.({
      completed: index + 1,
      total: modules.length,
      title: module.title,
    });
  }
  await initializeStudentReviewData(studentId);
  return installed;
}

export function bundledModuleCount(gradeLevel: number): number {
  return BUNDLED_MODULES.filter(
    (module) => module.gradeLevel === gradeLevel,
  ).length;
}
