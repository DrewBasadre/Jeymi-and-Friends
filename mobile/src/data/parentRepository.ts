import * as Crypto from 'expo-crypto';
import { isValidParentPin, parseStoredParentPinHash } from '@/domain/parentPin';
import type { ParentPinRecord } from '@/domain/types';
import { getDatabase } from './database';

export async function getParentPinRecord(
  studentId: string,
): Promise<ParentPinRecord | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{
    student_id: string;
    parent_pin_hash: string;
    pin_set_at: number;
  }>('SELECT * FROM parent_pins WHERE student_id = ?', studentId);
  return row
    ? {
        studentId: row.student_id,
        parentPinHash: row.parent_pin_hash,
        pinSetAt: new Date(row.pin_set_at).toISOString(),
      }
    : null;
}

export async function setParentPin(
  studentId: string,
  pin: string,
): Promise<ParentPinRecord> {
  if (!isValidParentPin(pin)) {
    throw new Error('Use a 4 to 8 digit parent PIN.');
  }
  const salt = Crypto.randomUUID();
  const digest = await digestPin(studentId, salt, pin);
  const pinSetAt = Date.now();
  const parentPinHash = `${salt}:${digest}`;
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO parent_pins (student_id, parent_pin_hash, pin_set_at)
     VALUES (?, ?, ?)
     ON CONFLICT(student_id) DO UPDATE SET
       parent_pin_hash = excluded.parent_pin_hash,
       pin_set_at = excluded.pin_set_at`,
    studentId,
    parentPinHash,
    pinSetAt,
  );
  return {
    studentId,
    parentPinHash,
    pinSetAt: new Date(pinSetAt).toISOString(),
  };
}

export async function verifyParentPin(
  studentId: string,
  pin: string,
): Promise<boolean> {
  if (!isValidParentPin(pin)) return false;
  const record = await getParentPinRecord(studentId);
  if (!record) return false;
  const parsed = parseStoredParentPinHash(record.parentPinHash);
  if (!parsed) return false;
  return (await digestPin(studentId, parsed.salt, pin)) === parsed.digest;
}

async function digestPin(
  studentId: string,
  salt: string,
  pin: string,
): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${studentId}:${pin}`,
  );
}
