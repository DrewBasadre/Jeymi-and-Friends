import { strFromU8, strToU8 } from 'fflate';

/**
 * Deterministic CBOR subset (RFC 8949): unsigned integers, byte strings, text
 * strings, arrays, and maps with unsigned integer keys sorted ascending.
 * Enough for compact QR payloads; anything else is rejected.
 */
export type CborValue = number | string | Uint8Array | CborValue[] | CborMap;
export type CborMap = Map<number, CborValue>;

const LIMITS = { bytes: 4_096, items: 128, depth: 4 } as const;

export function encodeCbor(value: CborValue): Uint8Array {
  const out: number[] = [];
  write(value, out);
  return Uint8Array.from(out);
}

export function decodeCbor(bytes: Uint8Array): CborValue {
  if (bytes.byteLength > LIMITS.bytes) throw new Error('CBOR payload is too large.');
  const state = { offset: 0 };
  const value = read(bytes, state, 0);
  if (state.offset !== bytes.byteLength) throw new Error('CBOR payload has trailing bytes.');
  return value;
}

function write(value: CborValue, out: number[]): void {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Only unsigned integers are supported.');
    head(0, value, out);
  } else if (typeof value === 'string') {
    const bytes = strToU8(value);
    head(3, bytes.byteLength, out);
    for (const byte of bytes) out.push(byte);
  } else if (value instanceof Uint8Array) {
    head(2, value.byteLength, out);
    for (const byte of value) out.push(byte);
  } else if (Array.isArray(value)) {
    head(4, value.length, out);
    for (const item of value) write(item, out);
  } else {
    const keys = [...value.keys()].sort((a, b) => a - b);
    head(5, keys.length, out);
    for (const key of keys) {
      write(key, out);
      write(value.get(key)!, out);
    }
  }
}

function head(major: number, length: number, out: number[]): void {
  const type = major << 5;
  if (length < 24) out.push(type | length);
  else if (length < 0x100) out.push(type | 24, length);
  else if (length < 0x10000) out.push(type | 25, length >> 8, length & 0xff);
  else if (length < 0x100000000) {
    out.push(type | 26, (length >>> 24) & 0xff, (length >>> 16) & 0xff, (length >>> 8) & 0xff, length & 0xff);
  } else {
    const high = Math.floor(length / 0x100000000);
    out.push(type | 27, (high >>> 24) & 0xff, (high >>> 16) & 0xff, (high >>> 8) & 0xff, high & 0xff);
    out.push((length >>> 24) & 0xff, (length >>> 16) & 0xff, (length >>> 8) & 0xff, length & 0xff);
  }
}

function read(bytes: Uint8Array, state: { offset: number }, depth: number): CborValue {
  if (depth > LIMITS.depth) throw new Error('CBOR payload is nested too deeply.');
  const initial = take(bytes, state, 1)[0]!;
  const major = initial >> 5;
  const length = readLength(bytes, state, initial & 0x1f);
  switch (major) {
    case 0:
      return length;
    case 2:
      return take(bytes, state, length).slice();
    case 3:
      return strFromU8(take(bytes, state, length));
    case 4: {
      if (length > LIMITS.items) throw new Error('CBOR array is too long.');
      return Array.from({ length }, () => read(bytes, state, depth + 1));
    }
    case 5: {
      if (length > LIMITS.items) throw new Error('CBOR map is too large.');
      const map: CborMap = new Map();
      for (let index = 0; index < length; index += 1) {
        const key = read(bytes, state, depth + 1);
        if (typeof key !== 'number') throw new Error('CBOR map keys must be unsigned integers.');
        if (map.has(key)) throw new Error('CBOR map repeats a key.');
        map.set(key, read(bytes, state, depth + 1));
      }
      return map;
    }
    default:
      throw new Error('Unsupported CBOR type.');
  }
}

function readLength(bytes: Uint8Array, state: { offset: number }, info: number): number {
  if (info < 24) return info;
  const size = { 24: 1, 25: 2, 26: 4, 27: 8 }[info];
  if (!size) throw new Error('Unsupported CBOR length encoding.');
  let value = 0;
  for (const byte of take(bytes, state, size)) value = value * 256 + byte;
  if (!Number.isSafeInteger(value)) throw new Error('CBOR integer is too large.');
  return value;
}

function take(bytes: Uint8Array, state: { offset: number }, count: number): Uint8Array {
  if (count > bytes.byteLength - state.offset) throw new Error('CBOR payload is truncated.');
  const slice = bytes.subarray(state.offset, state.offset + count);
  state.offset += count;
  return slice;
}
