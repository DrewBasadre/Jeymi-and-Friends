import { requireAuthenticatedUser } from '../_shared/auth.ts';
import {
  errorResponse,
  HttpError,
  jsonResponse,
  readJsonObject,
} from '../_shared/http.ts';

interface InteractionResponse {
  output_audio?: {
    data?: string;
    mime_type?: string;
  };
  error?: {
    message?: string;
  };
}

Deno.serve(async (request) => {
  try {
    await requireAuthenticatedUser(request);
    const body = await readJsonObject(request, 4_000);
    const text = lessonText(body.text);
    const pcm = await generateSpeech(text);
    const wav = pcmToWav(pcm, 24_000);
    return jsonResponse({
      audioBase64: encodeBase64(wav),
      mimeType: 'audio/wav',
      excerptLength: text.length,
    });
  } catch (error) {
    return errorResponse(error);
  }
});

async function generateSpeech(text: string): Promise<Uint8Array> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');
  const model =
    Deno.env.get('GEMINI_TTS_MODEL') ?? 'gemini-3.1-flash-tts-preview';
  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/interactions',
    {
      method: 'POST',
      headers: {
        'Api-Revision': '2026-05-20',
        'content-type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        model,
        input: `Read this elementary lesson excerpt clearly, warmly, and at a calm pace. Recite the text exactly:\n\n${text}`,
        response_format: { type: 'audio' },
        generation_config: {
          speech_config: [{ voice: 'Kore' }],
        },
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  const payload = (await response.json()) as InteractionResponse;
  const audio = payload.output_audio?.data;
  if (!response.ok || !audio) {
    throw new Error(
      payload.error?.message ?? `Gemini TTS returned HTTP ${response.status}.`,
    );
  }
  return decodeBase64(audio);
}

function lessonText(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(400, 'text must be a non-empty string.');
  }
  return value.trim().slice(0, 350);
}

function pcmToWav(pcm: Uint8Array, sampleRate: number): Uint8Array {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcm.byteLength, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, pcm.byteLength, true);
  const wav = new Uint8Array(44 + pcm.byteLength);
  wav.set(new Uint8Array(header));
  wav.set(pcm, 44);
  return wav;
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeBase64(value: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < value.length; offset += 32_768) {
    binary += String.fromCharCode(...value.subarray(offset, offset + 32_768));
  }
  return btoa(binary);
}
