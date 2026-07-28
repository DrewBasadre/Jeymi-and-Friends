import { companionResponseSchema } from '@/domain/companion';
import type {
  CompanionRequest,
  CompanionResponse,
} from '@/domain/companion';

const endpoint = process.env.EXPO_PUBLIC_PAVO_API_URL?.trim() ?? '';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

export function isCompanionConfigured(): boolean {
  return endpoint.startsWith('https://') || endpoint.startsWith('http://10.0.2.2');
}

export async function askPavo(
  request: CompanionRequest,
): Promise<CompanionResponse> {
  if (!isCompanionConfigured()) {
    throw new Error('Pavo online review is not configured on this build.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(supabaseAnonKey
          ? {
              apikey: supabaseAnonKey,
              Authorization: `Bearer ${supabaseAnonKey}`,
            }
          : {}),
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    const payload: unknown = await response.json();
    if (!response.ok) {
      const message =
        typeof payload === 'object' &&
        payload !== null &&
        'error' in payload &&
        typeof payload.error === 'string'
          ? payload.error
          : 'Pavo could not finish that request.';
      throw new Error(message);
    }
    return companionResponseSchema.parse(payload);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Pavo took too long to answer. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

