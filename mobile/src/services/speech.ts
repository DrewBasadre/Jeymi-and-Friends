import * as Speech from 'expo-speech';

export async function stopReading(): Promise<void> {
  await Speech.stop();
}

export async function readModuleAloud(
  text: string,
  callbacks: { onStart?: () => void; onDone?: () => void; onError?: () => void } = {},
): Promise<void> {
  await Speech.stop();
  const chunks = chunkSpeech(text, Math.min(Speech.maxSpeechInputLength, 2_500));
  callbacks.onStart?.();
  for (const [index, chunk] of chunks.entries()) {
    await new Promise<void>((resolve, reject) => {
      Speech.speak(chunk, {
        language: 'en-PH',
        rate: 0.88,
        pitch: 1,
        onDone: resolve,
        onError: reject,
        onStopped: resolve,
      });
    }).catch(() => {
      callbacks.onError?.();
      throw new Error('The on-device voice could not read this section.');
    });
    if (index === chunks.length - 1) callbacks.onDone?.();
  }
}

export function chunkSpeech(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    if (sentence.length > maxLength) {
      if (current) chunks.push(current);
      for (let offset = 0; offset < sentence.length; offset += maxLength) {
        chunks.push(sentence.slice(offset, offset + maxLength));
      }
      current = '';
    } else if (`${current} ${sentence}`.trim().length > maxLength) {
      chunks.push(current);
      current = sentence;
    } else {
      current = `${current} ${sentence}`.trim();
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

