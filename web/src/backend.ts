import { companionResponseSchema, type CompanionResponse } from '@pavo/domain/companion';

/**
 * Optional online services. Without these variables the studio runs in an
 * isolated demo mode: drafts, previews, and exports all work offline, and
 * nothing leaves the browser.
 */
const env = import.meta.env;
const SUPABASE_URL = (env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const SUPABASE_ANON_KEY = (env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';
const PACKAGE_BUCKET = (env.VITE_SUPABASE_PACKAGE_BUCKET as string | undefined) ?? 'pavo-packages';
const AI_URL = (env.VITE_PAVO_API_URL as string | undefined) ?? '';

export const backend = {
  supabaseConfigured: Boolean(SUPABASE_URL && SUPABASE_ANON_KEY),
  aiConfigured: AI_URL.startsWith('https://') || AI_URL.startsWith('http://localhost'),
};

export interface TeacherSession {
  accessToken: string;
  userId: string;
  email: string;
  expiresAt: number;
}

export async function signIn(email: string, password: string): Promise<TeacherSession> {
  if (!backend.supabaseConfigured) throw new Error('Sign-in is not configured. Use demo mode.');
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    user?: { id: string; email: string };
    error_description?: string;
  };
  if (!response.ok || !body.access_token || !body.user) {
    throw new Error(body.error_description ?? 'Sign-in failed. Check your email and password.');
  }
  return {
    accessToken: body.access_token,
    userId: body.user.id,
    email: body.user.email,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
}

/** Uploads an export to the teacher's own folder in Supabase Storage. */
export async function uploadExport(session: TeacherSession, fileName: string, bytes: Uint8Array): Promise<string> {
  if (!backend.supabaseConfigured) throw new Error('Synchronization is not configured.');
  if (session.expiresAt < Date.now()) throw new Error('Your session expired. Sign in again.');
  const path = `${session.userId}/${fileName.replace(/[^A-Za-z0-9._-]/g, '_')}`;
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/${PACKAGE_BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/zip',
      'x-upsert': 'true',
    },
    body: new Blob([bytes as BlobPart], { type: 'application/zip' }),
  });
  if (!response.ok) throw new Error('Upload failed. Your export is still saved on this computer.');
  return path;
}

export interface AiDraft {
  response: CompanionResponse;
  model: string;
  generatedAt: string;
}

/**
 * Asks the server-side AI boundary for an editable draft grounded in the
 * teacher's approved source text. The API key never reaches the browser.
 */
export async function requestAiDraft(args: {
  intent: 'teacher_author_module' | 'teacher_author_quiz';
  gradeLevel: number;
  subject: string;
  instruction: string;
  source: { id: string; title: string; text: string };
}): Promise<AiDraft> {
  if (!backend.aiConfigured) throw new Error('AI drafting is not configured for this studio.');
  if (!navigator.onLine) throw new Error('You are offline. Keep writing; AI drafting returns when you reconnect.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(AI_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } : {}),
      },
      body: JSON.stringify({
        intent: args.intent,
        activity: args.intent === 'teacher_author_quiz' ? 'quiz' : 'lesson',
        gradeLevel: args.gradeLevel,
        question: args.instruction.slice(0, 500),
        conversation: [],
        modules: [
          {
            id: args.source.id,
            title: args.source.title.slice(0, 160),
            subject: args.subject.slice(0, 40),
            competencyCode: 'teacher-source',
            summary: args.source.text.slice(0, 800),
            content: args.source.text.slice(0, 5000),
          },
        ],
        performance: {},
        deadlines: [],
      }),
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload && typeof payload === 'object' && 'error' in payload ? String((payload as { error: unknown }).error) : '';
      throw new Error(message || 'The AI service could not draft this right now.');
    }
    return {
      response: companionResponseSchema.parse(payload),
      model: response.headers.get('x-pavo-model') ?? 'server-default',
      generatedAt: response.headers.get('x-pavo-generated-at') ?? new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('The AI service took too long. Try a shorter source.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
