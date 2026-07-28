import * as Network from 'expo-network';
import type {
  AiSuggestion,
  DiagnosticInput,
  LearningStyle,
  Subject,
} from '@/domain/types';
import { requireSupabase } from './supabase';

export interface LessonPlanInput {
  gradeLevel: number;
  subject: Subject;
  quarter: number;
  competencyCode: string;
  topic: string;
  learningStyle: LearningStyle;
  availableMaterials: string[];
}

export interface LessonPlanResult {
  title: string;
  objectives: string[];
  lessonFlow: string[];
  assessment: string[];
  remediation: string[];
  source: 'edge';
}

async function assertOnline(): Promise<void> {
  const state = await Network.getNetworkStateAsync();
  if (!state.isConnected || state.isInternetReachable === false) {
    throw new Error('This feature needs an internet connection. Offline learning remains available.');
  }
}

export async function generateLessonPlan(input: LessonPlanInput): Promise<LessonPlanResult> {
  await assertOnline();
  const client = requireSupabase();
  await requireOnlineSession(client);
  const { data, error } = await client.functions.invoke<LessonPlanResult>('lesson-plan', {
    body: input,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error('The lesson service returned no result.');
  return { ...data, source: 'edge' };
}

export async function generateDiagnostic(
  input: DiagnosticInput,
  onlineProcessingAllowed: boolean,
): Promise<AiSuggestion> {
  if (!onlineProcessingAllowed) return offlineDiagnostic(input);
  try {
    await assertOnline();
    const client = requireSupabase();
    await requireOnlineSession(client);
    const { data, error } = await client.functions.invoke<Omit<AiSuggestion, 'source'>>(
      'student-diagnostic',
      { body: input },
    );
    if (error) throw new Error(error.message);
    if (!data) throw new Error('The diagnostic service returned no result.');
    return { ...data, source: 'edge' };
  } catch {
    return offlineDiagnostic(input);
  }
}

async function requireOnlineSession(
  client: ReturnType<typeof requireSupabase>,
): Promise<void> {
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) {
    throw new Error('Sign in with a teacher email to use online AI tools.');
  }
}

function offlineDiagnostic(input: DiagnosticInput): AiSuggestion {
  const styleAction = {
    visual: 'Use a labeled diagram, color-coded example, and one worked model.',
    auditory: 'Explain the idea aloud, then ask the learner to teach it back in their own words.',
    reading: 'Provide a short checklist and let the learner write a two-sentence explanation.',
    kinesthetic: 'Use familiar objects and let the learner demonstrate each step.',
    balanced: 'Combine one visual model, a short explanation, and guided practice.',
  }[input.learningStyleTag];
  return {
    summary: `The learner is currently in the ${input.scoreBand.toLocaleLowerCase()} score band for ${input.competencyCode}.`,
    actions: [
      styleAction,
      'Reteach the weakest topic with one worked example before independent practice.',
      'Use a five-item exit check and compare it with the previous attempt.',
    ],
    monitoringPlan: 'Check again after two short practice sessions; aim for at least four correct answers.',
    source: 'offline',
  };
}
