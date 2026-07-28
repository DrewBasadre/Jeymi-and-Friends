import { createClient } from 'npm:@supabase/supabase-js@2';
import { HttpError } from './http.ts';

export async function requireAuthenticatedUser(
  request: Request,
): Promise<{ id: string }> {
  const { id } = await authenticatedContext(request);
  return { id };
}

export async function requireTeacherUser(
  request: Request,
): Promise<{ id: string }> {
  const { id, client } = await authenticatedContext(request);
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('role')
    .eq('id', id)
    .single();
  if (
    profileError ||
    !profile ||
    (profile.role !== 'teacher' && profile.role !== 'admin')
  ) {
    throw new HttpError(403, 'Teacher access is required.');
  }
  return { id };
}

async function authenticatedContext(
  request: Request,
) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw new HttpError(401, 'Authentication is required.');
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = getPublishableKey();
  if (!supabaseUrl || !publishableKey) {
    throw new Error('Supabase authentication environment is not configured.');
  }
  const client = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    throw new HttpError(401, 'The session is invalid or expired.');
  }
  return { id: data.user.id, client };
}

function getPublishableKey(): string | null {
  const direct =
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ??
    Deno.env.get('SUPABASE_ANON_KEY');
  if (direct) return direct;
  const keyMap = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');
  if (!keyMap) return null;
  try {
    const parsed = JSON.parse(keyMap) as Record<string, string>;
    return parsed.default ?? Object.values(parsed)[0] ?? null;
  } catch {
    return null;
  }
}
