import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { getDatabase } from '@/data/database';
import { createDeviceIdentity, type DeviceIdentity } from '@/domain/resultQr';

/**
 * Per-owner Ed25519 signing keys. The private key stays in the Android
 * Keystore-backed secure store; only the public key is written to SQLite or
 * shown in the enrollment QR.
 */
export async function ensureDeviceIdentity(ownerId: `student:${string}` | `teacher:${string}`): Promise<DeviceIdentity> {
  const storeKey = `pavo.signing.${ownerId.replace(/[^A-Za-z0-9._-]/g, '_')}`;
  const existing = await SecureStore.getItemAsync(storeKey);
  let identity: DeviceIdentity;
  if (existing) {
    identity = JSON.parse(existing) as DeviceIdentity;
  } else {
    identity = createDeviceIdentity(Crypto.getRandomBytes(32));
    await SecureStore.setItemAsync(storeKey, JSON.stringify(identity), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO device_identities (owner_id, public_key, key_id, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(owner_id) DO NOTHING`,
    ownerId,
    identity.publicKeyHex,
    identity.keyId,
    Date.now(),
  );
  return identity;
}
