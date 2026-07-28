import * as Crypto from 'expo-crypto';
import { parseLearningPackageManifest } from '@/domain/manifest';
import type {
  ChatMessage,
  ChatSession,
  StoredLearningPackage,
  StudyPackageManifest,
} from '@/domain/types';
import { getDatabase } from './database';

type PackageCategory = StudyPackageManifest['contentCategory'];

export async function saveLearningPackage(args: {
  ownerId: string;
  manifest: StudyPackageManifest;
  received?: boolean;
}): Promise<StoredLearningPackage> {
  const database = await getDatabase();
  const createdAt = Date.parse(args.manifest.createdAt);
  const receivedAt = args.received ? Date.now() : null;
  await database.runAsync(
    `INSERT INTO learning_packages (
       package_id, owner_id, content_category, title, manifest_json,
       received_at, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(package_id) DO UPDATE SET
       owner_id = excluded.owner_id,
       content_category = excluded.content_category,
       title = excluded.title,
       manifest_json = excluded.manifest_json,
       received_at = COALESCE(excluded.received_at, learning_packages.received_at)`,
    args.manifest.packageId,
    args.ownerId,
    args.manifest.contentCategory,
    args.manifest.title,
    JSON.stringify(args.manifest),
    receivedAt,
    Number.isFinite(createdAt) ? createdAt : Date.now(),
  );
  return {
    packageId: args.manifest.packageId,
    ownerId: args.ownerId,
    contentCategory: args.manifest.contentCategory,
    title: args.manifest.title,
    manifest: args.manifest,
    receivedAt: receivedAt ? new Date(receivedAt).toISOString() : null,
    createdAt: args.manifest.createdAt,
  };
}

export async function listLearningPackages(
  ownerId: string,
  category?: PackageCategory,
): Promise<StoredLearningPackage[]> {
  const database = await getDatabase();
  const rows = category
    ? await database.getAllAsync<PackageRow>(
        `SELECT * FROM learning_packages
         WHERE owner_id = ? AND content_category = ?
         ORDER BY created_at DESC`,
        ownerId,
        category,
      )
    : await database.getAllAsync<PackageRow>(
        `SELECT * FROM learning_packages
         WHERE owner_id = ? ORDER BY created_at DESC`,
        ownerId,
      );
  return rows.map(mapPackage);
}

export async function getLearningPackage(
  packageId: string,
): Promise<StoredLearningPackage | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<PackageRow>(
    'SELECT * FROM learning_packages WHERE package_id = ?',
    packageId,
  );
  return row ? mapPackage(row) : null;
}

export async function appendPackageSharer(
  packageId: string,
  studentId: string,
): Promise<StudyPackageManifest> {
  const stored = await getLearningPackage(packageId);
  if (!stored || stored.contentCategory !== 'studentMaterial') {
    throw new Error('Only Study Jams can be shared with classmates.');
  }
  const sharer = `student:${studentId}`;
  const manifest: StudyPackageManifest = {
    ...stored.manifest,
    sharedBy: stored.manifest.sharedBy.includes(sharer)
      ? stored.manifest.sharedBy
      : [...stored.manifest.sharedBy, sharer],
  };
  await saveLearningPackage({ ownerId: stored.ownerId, manifest });
  return manifest;
}

export async function createChatSession(
  ownerId: ChatSession['ownerId'],
  title = 'New conversation',
): Promise<ChatSession> {
  const timestamp = new Date().toISOString();
  const session: ChatSession = {
    sessionId: `chat_${Crypto.randomUUID()}`,
    ownerId,
    title: title.trim() || 'New conversation',
    createdAt: timestamp,
    updatedAt: timestamp,
    messages: [],
  };
  await saveChatSession(session);
  return session;
}

export async function saveChatSession(session: ChatSession): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO chat_sessions (
       session_id, owner_id, title, messages_json, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(session_id) DO UPDATE SET
       title = excluded.title,
       messages_json = excluded.messages_json,
       updated_at = excluded.updated_at`,
    session.sessionId,
    session.ownerId,
    session.title,
    JSON.stringify(session.messages),
    Date.parse(session.createdAt),
    Date.parse(session.updatedAt),
  );
}

export async function appendChatMessage(
  session: ChatSession,
  message: ChatMessage,
): Promise<ChatSession> {
  const next: ChatSession = {
    ...session,
    title:
      session.messages.length === 0 && message.role === 'user'
        ? message.content.trim().slice(0, 56) || session.title
        : session.title,
    updatedAt: message.timestamp,
    messages: [...session.messages, message],
  };
  await saveChatSession(next);
  return next;
}

export async function listChatSessions(
  ownerId: ChatSession['ownerId'],
): Promise<ChatSession[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<ChatRow>(
    `SELECT * FROM chat_sessions
     WHERE owner_id = ? ORDER BY updated_at DESC`,
    ownerId,
  );
  return rows.map(mapChat);
}

interface PackageRow {
  package_id: string;
  owner_id: string;
  content_category: PackageCategory;
  title: string;
  manifest_json: string;
  received_at: number | null;
  created_at: number;
}

interface ChatRow {
  session_id: string;
  owner_id: ChatSession['ownerId'];
  title: string;
  messages_json: string;
  created_at: number;
  updated_at: number;
}

function mapPackage(row: PackageRow): StoredLearningPackage {
  const manifest = parseLearningPackageManifest(
    JSON.parse(row.manifest_json),
  );
  if (manifest.contentCategory === 'teacherModule') {
    throw new Error('A curriculum module was stored in the study package table.');
  }
  return {
    packageId: row.package_id,
    ownerId: row.owner_id,
    contentCategory: row.content_category,
    title: row.title,
    manifest,
    receivedAt: row.received_at
      ? new Date(row.received_at).toISOString()
      : null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function mapChat(row: ChatRow): ChatSession {
  return {
    sessionId: row.session_id,
    ownerId: row.owner_id,
    title: row.title,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    messages: JSON.parse(row.messages_json) as ChatMessage[],
  };
}
