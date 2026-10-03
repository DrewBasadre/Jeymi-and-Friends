import { getDatabase } from './database';

/** Teacher side: the public key from a learner's profile QR, used to verify signed results. */
export async function enrollDeviceKey(studentId: string, publicKeyHex: string, keyId: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO enrolled_device_keys (student_id, public_key, key_id, enrolled_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(student_id) DO UPDATE SET
       public_key = excluded.public_key, key_id = excluded.key_id, enrolled_at = excluded.enrolled_at`,
    studentId,
    publicKeyHex,
    keyId,
    Date.now(),
  );
}
