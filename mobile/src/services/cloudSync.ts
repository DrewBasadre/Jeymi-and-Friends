import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import {
  completeSyncItem,
  failSyncItem,
  getLearningProfile,
  getPrivacyConsent,
  listDueSyncItems,
} from '@/data/repository';
import type { LearningProfile, QuizAttempt } from '@/domain/types';
import { requireSupabase } from './supabase';

const linkedStudentKey = 'wais.cloud.linkedStudent';

export interface SyncResult {
  synced: number;
  failed: number;
}

export async function connectStudentCloudAccount(
  studentId: string,
  email: string,
  password: string,
): Promise<SyncResult> {
  await assertOnline();
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error || !data.user) {
    throw new Error(error?.message ?? 'Cloud account sign-in failed.');
  }
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single();
  if (profileError || profile?.role !== 'student') {
    await client.auth.signOut();
    throw new Error('This account is not configured as a student account.');
  }
  await AsyncStorage.setItem(
    linkedStudentKey,
    JSON.stringify({ studentId, userId: data.user.id }),
  );
  return syncStudentData(studentId);
}

export async function syncStudentData(studentId: string): Promise<SyncResult> {
  await assertOnline();
  const consent = await getPrivacyConsent(studentId);
  if (!consent?.cloudSyncAllowed) {
    throw new Error('A guardian must enable cloud backup before student records can sync.');
  }

  const client = requireSupabase();
  const {
    data: { session },
  } = await client.auth.getSession();
  const linked = await readLinkedStudent();
  if (
    !session ||
    linked?.studentId !== studentId ||
    linked.userId !== session.user.id
  ) {
    throw new Error('Connect this student profile to its cloud account first.');
  }

  const learningProfile = await getLearningProfile(studentId);
  if (learningProfile) {
    const { error } = await client.from('learning_profiles').upsert({
      user_id: session.user.id,
      primary_style: learningProfile.primaryStyle,
      scores: learningProfile.scores,
      assessment_version: learningProfile.assessmentVersion,
      completed_at: new Date(learningProfile.completedAt).toISOString(),
      guardian_acknowledged_at: learningProfile.guardianAcknowledgedAt
        ? new Date(learningProfile.guardianAcknowledgedAt).toISOString()
        : null,
      cloud_sync_allowed: true,
      ai_diagnostics_allowed: consent.aiDiagnosticsAllowed,
      notice_version: consent.noticeVersion,
    });
    if (error) throw new Error(error.message);
  }

  let synced = 0;
  let failed = 0;
  const queue = await listDueSyncItems();
  for (const item of queue) {
    if (!belongsToStudent(item.payload, studentId)) continue;
    try {
      if (item.entityType === 'learning_profile') {
        await completeSyncItem(item.id);
        synced += 1;
        continue;
      }
      if (item.entityType === 'quiz_attempt') {
        const attempt = item.payload as QuizAttempt;
        const { error } = await client.from('quiz_attempts').upsert(
          {
            client_id: attempt.id,
            student_id: session.user.id,
            module_id: attempt.moduleId,
            score: attempt.score,
            total_items: attempt.totalItems,
            mastery_level: attempt.masteryLevel,
            duration_seconds: attempt.durationSeconds,
            attempt_number: attempt.attemptNumber,
            weak_topic: attempt.weakTopic,
            strong_topic: attempt.strongTopic,
            response_timing: attempt.responses.map((response) => ({
              questionId: response.questionId,
              elapsedMs: response.elapsedMs,
              isCorrect: response.isCorrect,
            })),
            submitted_at: new Date(attempt.submittedAt).toISOString(),
          },
          { onConflict: 'student_id,client_id' },
        );
        if (error) throw new Error(error.message);
        await completeSyncItem(item.id);
        synced += 1;
      }
    } catch (error) {
      failed += 1;
      await failSyncItem(
        item.id,
        error instanceof Error ? error.message : 'Cloud sync failed.',
        item.attempts,
      );
    }
  }
  return { synced, failed };
}

export async function disconnectStudentCloudAccount(): Promise<void> {
  await AsyncStorage.removeItem(linkedStudentKey);
  await requireSupabase().auth.signOut();
}

async function assertOnline(): Promise<void> {
  const state = await Network.getNetworkStateAsync();
  if (!state.isConnected || state.isInternetReachable === false) {
    throw new Error('Cloud backup will be available again when this device is online.');
  }
}

function belongsToStudent(payload: unknown, studentId: string): boolean {
  if (!payload || typeof payload !== 'object') return false;
  return (payload as Partial<LearningProfile & QuizAttempt>).studentId === studentId;
}

async function readLinkedStudent(): Promise<{
  studentId: string;
  userId: string;
} | null> {
  const raw = await AsyncStorage.getItem(linkedStudentKey);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<{
      studentId: string;
      userId: string;
    }>;
    return value.studentId && value.userId
      ? { studentId: value.studentId, userId: value.userId }
      : null;
  } catch {
    await AsyncStorage.removeItem(linkedStudentKey);
    return null;
  }
}
