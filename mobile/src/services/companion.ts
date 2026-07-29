import { companionResponseSchema } from '@/domain/companion';
import type {
  CompanionRequest,
  CompanionResponse,
} from '@/domain/companion';
import { simulateCompanionResponse } from './companionDemo';

const endpoint = process.env.EXPO_PUBLIC_PAVO_API_URL?.trim() ?? '';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

/**
 * Demo fallback: when the live endpoint is not configured or a request fails,
 * answer on-device so the experience can still be seen and simulated. Set
 * EXPO_PUBLIC_PAVO_DEMO=0 to disable and require the live backend.
 */
const DEMO_ENABLED = process.env.EXPO_PUBLIC_PAVO_DEMO !== '0';

/** True when the live edge function endpoint is wired up. */
export function isCompanionConfigured(): boolean {
  return endpoint.startsWith('https://') || endpoint.startsWith('http://10.0.2.2');
}

/** True when the bot can answer at all — live, or via the on-device demo. */
export function isCompanionAvailable(): boolean {
  return isCompanionConfigured() || DEMO_ENABLED;
}

/** Whether answers come from the live backend or the on-device demo. */
export function companionMode(): 'live' | 'demo' {
  return isCompanionConfigured() ? 'live' : 'demo';
}

async function demoAnswer(request: CompanionRequest): Promise<CompanionResponse> {
  // A brief beat so the process steps read as deliberate work.
  await new Promise((resolve) => setTimeout(resolve, 900));
  return companionResponseSchema.parse(simulateCompanionResponse(request));
}

export async function askPavo(
  request: CompanionRequest,
): Promise<CompanionResponse> {
  if (!isCompanionConfigured()) {
    if (DEMO_ENABLED) return demoAnswer(request);
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
    // Live call failed (offline, function down, timeout) — fall back to the
    // on-device demo so the flow still works, unless demo is disabled.
    if (DEMO_ENABLED) return demoAnswer(request);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Pavo took too long to answer. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

