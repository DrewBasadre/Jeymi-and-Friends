import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

export function sha256Bytes(value: string | Uint8Array): Uint8Array {
  return sha256(typeof value === 'string' ? utf8ToBytes(value) : value);
}

export function sha256Hex(value: string | Uint8Array): string {
  return bytesToHex(sha256Bytes(value));
}
