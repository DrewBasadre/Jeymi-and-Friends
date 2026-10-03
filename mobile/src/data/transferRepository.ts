import type { TransferOffer, TransferReceipt, TransferState } from '@/domain/transferProtocol';
import { isStale } from '@/domain/transferProtocol';
import { getDatabase } from './database';

export interface TransferSessionRecord {
  transferId: string;
  sessionId: string;
  direction: 'send' | 'receive';
  packageId: string;
  packageVersion: number;
  displayName: string;
  peerName: string;
  peerRole: 'teacher' | 'student' | null;
  sizeBytes: number;
  packageSha256: string;
  manifestDigest: string;
  bytesTransferred: number;
  state: TransferState;
  fileUri: string | null;
  offer: TransferOffer | null;
  receipt: TransferReceipt | null;
  startedAt: number;
  updatedAt: number;
  completedAt: number | null;
  errorMessage: string | null;
}

interface Row {
  id: string;
  session_id: string | null;
  direction: 'send' | 'receive';
  module_id: string;
  package_version: number;
  file_name: string;
  peer_name: string;
  peer_role: 'teacher' | 'student' | null;
  size_bytes: number;
  expected_sha256: string;
  manifest_digest: string | null;
  bytes_transferred: number;
  status: string;
  file_uri: string | null;
  offer_json: string | null;
  receipt_json: string | null;
  started_at: number;
  updated_at: number;
  completed_at: number | null;
  error_message: string | null;
}

/** Persisted so rotation, an app restart, or a dropped link never erases history. */
export async function saveTransferSession(record: TransferSessionRecord): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO transfer_sessions (
       id, session_id, direction, module_id, package_version, file_name, peer_name, peer_role, size_bytes,
       expected_sha256, manifest_digest, bytes_transferred, status, file_uri, offer_json, receipt_json,
       started_at, updated_at, completed_at, error_message
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       peer_name = excluded.peer_name,
       peer_role = excluded.peer_role,
       bytes_transferred = excluded.bytes_transferred,
       status = excluded.status,
       file_uri = excluded.file_uri,
       receipt_json = COALESCE(excluded.receipt_json, transfer_sessions.receipt_json),
       updated_at = excluded.updated_at,
       completed_at = excluded.completed_at,
       error_message = excluded.error_message`,
    record.transferId,
    record.sessionId,
    record.direction,
    record.packageId,
    record.packageVersion,
    record.displayName,
    record.peerName,
    record.peerRole,
    record.sizeBytes,
    record.packageSha256,
    record.manifestDigest,
    record.bytesTransferred,
    record.state,
    record.fileUri,
    record.offer ? JSON.stringify(record.offer) : null,
    record.receipt ? JSON.stringify(record.receipt) : null,
    record.startedAt,
    record.updatedAt,
    record.completedAt,
    record.errorMessage,
  );
}

export async function listTransferSessions(limit = 20): Promise<TransferSessionRecord[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<Row>('SELECT * FROM transfer_sessions ORDER BY updated_at DESC LIMIT ?', limit);
  return rows.map(mapRow);
}

/** An unfinished send of the same package to resume instead of starting over. */
export async function findResumableSend(packageId: string, packageSha256: string): Promise<TransferSessionRecord | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<Row>(
    `SELECT * FROM transfer_sessions
     WHERE direction = 'send' AND module_id = ? AND expected_sha256 = ? AND status IN ('paused', 'reconnecting', 'failed', 'sending', 'resuming')
     ORDER BY updated_at DESC LIMIT 1`,
    packageId,
    packageSha256,
  );
  return row ? mapRow(row) : null;
}

export async function findReceiveSession(transferId: string): Promise<TransferSessionRecord | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<Row>("SELECT * FROM transfer_sessions WHERE id = ? AND direction = 'receive'", transferId);
  return row ? mapRow(row) : null;
}

/** Removes stale sessions; returns their transfer IDs so partial files can be deleted. */
export async function removeStaleSessions(now = Date.now()): Promise<string[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<Row>('SELECT * FROM transfer_sessions');
  const stale = rows.map(mapRow).filter((session) => isStale(session, now));
  for (const session of stale) {
    await database.runAsync('DELETE FROM transfer_sessions WHERE id = ?', session.transferId);
  }
  return stale.map((session) => session.transferId);
}

function mapRow(row: Row): TransferSessionRecord {
  return {
    transferId: row.id,
    sessionId: row.session_id ?? row.id,
    direction: row.direction,
    packageId: row.module_id,
    packageVersion: row.package_version,
    displayName: row.file_name,
    peerName: row.peer_name,
    peerRole: row.peer_role,
    sizeBytes: row.size_bytes,
    packageSha256: row.expected_sha256,
    manifestDigest: row.manifest_digest ?? '',
    bytesTransferred: row.bytes_transferred,
    state: (row.status === 'complete' ? 'completed' : row.status) as TransferState,
    fileUri: row.file_uri,
    offer: row.offer_json ? (JSON.parse(row.offer_json) as TransferOffer) : null,
    receipt: row.receipt_json ? (JSON.parse(row.receipt_json) as TransferReceipt) : null,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    errorMessage: row.error_message,
  };
}
