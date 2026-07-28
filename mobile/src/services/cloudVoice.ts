import * as Network from 'expo-network';
import { File, Paths } from 'expo-file-system';
import { requireSupabase } from './supabase';

interface CloudVoiceResponse {
  audioBase64: string;
  mimeType: 'audio/wav';
  excerptLength: number;
}

export async function generateCloudVoice(text: string): Promise<string> {
  const network = await Network.getNetworkStateAsync();
  if (!network.isConnected || network.isInternetReachable === false) {
    throw new Error('Enhanced voice needs internet. On-device read aloud still works offline.');
  }
  const client = requireSupabase();
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session) {
    throw new Error('Connect a student cloud account before using enhanced voice.');
  }
  const { data, error } = await client.functions.invoke<CloudVoiceResponse>(
    'cloud-voice',
    { body: { text: text.slice(0, 350) } },
  );
  if (error) throw new Error(error.message);
  if (!data?.audioBase64) throw new Error('The voice service returned no audio.');

  const file = new File(Paths.cache, 'wais-cloud-voice.wav');
  file.write(decodeBase64(data.audioBase64));
  return file.uri;
}

function decodeBase64(value: string): Uint8Array {
  const binary = globalThis.atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
