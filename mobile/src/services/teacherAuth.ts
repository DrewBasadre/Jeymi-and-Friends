import { isSupabaseConfigured, requireSupabase } from './supabase';

export async function signInTeacher(
  identifier: string,
  password: string,
): Promise<{ onlineAuthenticated: boolean }> {
  const normalized = identifier.trim().toLocaleLowerCase();
  const isOfflineDemo =
    (normalized === 't-1001' || normalized === 'teacher') &&
    (password === 'teacher123' || password.toLocaleLowerCase() === 'password');
  if (isOfflineDemo) return { onlineAuthenticated: false };

  if (!identifier.includes('@')) {
    throw new Error('Use a teacher email for online sign-in, or check the offline teacher number.');
  }
  if (!isSupabaseConfigured) {
    throw new Error('Online teacher sign-in is not configured in this build.');
  }

  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({
    email: identifier.trim(),
    password,
  });
  if (error || !data.user) {
    throw new Error(error?.message ?? 'Teacher sign-in failed.');
  }
  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single();
  if (
    profileError ||
    !profile ||
    (profile.role !== 'teacher' && profile.role !== 'admin')
  ) {
    await client.auth.signOut();
    throw new Error('This account does not have teacher access.');
  }
  return { onlineAuthenticated: true };
}
