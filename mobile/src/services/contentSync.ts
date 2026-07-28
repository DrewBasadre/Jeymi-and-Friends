import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import { Directory, File, Paths } from 'expo-file-system';
import { upsertCloudModule } from '@/data/repository';
import { saveModuleManifest } from '@/data/mvpRepository';
import { buildPdfManifest } from '@/domain/manifest';
import type { LearningModule, LearningStyle, Subject } from '@/domain/types';
import { sha256File } from './files';
import { isSupabaseConfigured, requireSupabase } from './supabase';

const modulesDirectory = new Directory(Paths.document, 'modules');

interface CloudModuleRow {
  id: string;
  title: string;
  subject: string;
  grade_level: number;
  quarter: number;
  competency_code: string;
  summary: string;
  content_style_tags: string[];
  storage_path: string | null;
  package_sha256: string | null;
  package_size_bytes: number | null;
  updated_at: string;
}

export interface DatasetSetupResult {
  source: 'cloud' | 'bundled';
  downloadedPackages: number;
  availableModules: number;
}

export async function setupGradeDataset(
  studentId: string,
  gradeLevel: number,
  learningStyle: LearningStyle,
): Promise<DatasetSetupResult> {
  const markerKey = `wais.dataset.v1.${studentId}.${gradeLevel}`;
  const marker = await AsyncStorage.getItem(markerKey);
  if (marker) {
    try {
      return JSON.parse(marker) as DatasetSetupResult;
    } catch {
      await AsyncStorage.removeItem(markerKey);
    }
  }

  const network = await Network.getNetworkStateAsync();
  if (
    !isSupabaseConfigured ||
    !network.isConnected ||
    network.isInternetReachable === false
  ) {
    return bundledResult();
  }

  try {
    const client = requireSupabase();
    const { data, error } = await client
      .from('modules')
      .select(
        'id,title,subject,grade_level,quarter,competency_code,summary,content_style_tags,storage_path,package_sha256,package_size_bytes,updated_at',
      )
      .eq('grade_level', gradeLevel)
      .eq('published', true);
    if (error) throw error;

    const rows = ((data ?? []) as CloudModuleRow[]).sort((left, right) => {
      const leftPreferred = left.content_style_tags.includes(learningStyle) ? 1 : 0;
      const rightPreferred = right.content_style_tags.includes(learningStyle) ? 1 : 0;
      return rightPreferred - leftPreferred;
    });
    if (!modulesDirectory.exists) {
      modulesDirectory.create({ intermediates: true, idempotent: true });
    }

    let downloadedPackages = 0;
    for (const row of rows) {
      const localAssetUri = await downloadPackage(row);
      if (localAssetUri) downloadedPackages += 1;
      await upsertCloudModule(mapCloudModule(row, localAssetUri));
      if (row.storage_path && row.package_sha256) {
        await saveModuleManifest(
          buildPdfManifest({
            moduleId: row.id,
            fileName: row.storage_path.split('/').at(-1) ?? `${row.id}.pdf`,
            sha256: row.package_sha256,
            source: 'supabase-ota',
            gradeLevel: row.grade_level,
            subject: row.subject,
          }),
          localAssetUri !== null,
        );
      }
    }
    const result: DatasetSetupResult = {
      source: 'cloud',
      downloadedPackages,
      availableModules: rows.length,
    };
    await AsyncStorage.setItem(markerKey, JSON.stringify(result));
    return result;
  } catch {
    return bundledResult();
  }
}

async function downloadPackage(row: CloudModuleRow): Promise<string | null> {
  if (!row.storage_path) return null;
  const client = requireSupabase();
  const { data, error } = await client.storage
    .from('module-packages')
    .createSignedUrl(row.storage_path, 15 * 60);
  if (error || !data?.signedUrl) return null;

  const destination = new File(modulesDirectory, `${sanitizeName(row.id)}.pdf`);
  const downloaded = await File.downloadFileAsync(data.signedUrl, destination, {
    idempotent: true,
  });
  if (row.package_sha256) {
    const actualHash = await sha256File(downloaded);
    if (actualHash !== row.package_sha256.toLocaleLowerCase()) {
      downloaded.delete();
      throw new Error(`Checksum mismatch for module ${row.id}.`);
    }
  }
  return downloaded.uri;
}

function mapCloudModule(
  row: CloudModuleRow,
  localAssetUri: string | null,
): LearningModule {
  return {
    id: row.id,
    title: row.title,
    subject: normalizeSubject(row.subject),
    gradeLevel: row.grade_level,
    quarter: row.quarter,
    competencyCode: row.competency_code,
    summary: row.summary,
    content: '',
    contentStyleTags: row.content_style_tags
      .map(normalizeLearningStyle)
      .filter((value): value is LearningStyle => value !== null),
    localAssetUri,
    remoteAssetPath: row.storage_path,
    packageSha256: row.package_sha256?.toLocaleLowerCase() ?? null,
    packageSizeBytes: row.package_size_bytes,
    isTeacherCreated: false,
    updatedAt: Date.parse(row.updated_at) || Date.now(),
  };
}

function normalizeSubject(value: string): Subject {
  const normalized = value.toLocaleUpperCase();
  if (normalized === 'SCIENCE' || normalized === 'MATH' || normalized === 'ENGLISH') {
    return normalized;
  }
  return 'ADDED_MATERIALS';
}

function normalizeLearningStyle(value: string): LearningStyle | null {
  if (
    value === 'visual' ||
    value === 'auditory' ||
    value === 'reading' ||
    value === 'kinesthetic' ||
    value === 'balanced'
  ) {
    return value;
  }
  return null;
}

function sanitizeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'module';
}

function bundledResult(): DatasetSetupResult {
  return {
    source: 'bundled',
    downloadedPackages: 0,
    availableModules: 3,
  };
}
