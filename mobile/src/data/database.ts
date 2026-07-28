import * as SQLite from 'expo-sqlite';
import { SEED_FLASHCARDS, SEED_MODULES, SEED_QUESTIONS } from './seed';

const DATABASE_NAME = 'wais-next.db';
const SCHEMA_VERSION = 2;

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME).then(async (database) => {
      await migrate(database);
      await seed(database);
      return database;
    });
  }
  return databasePromise;
}

async function migrate(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY NOT NULL,
      student_number TEXT NOT NULL UNIQUE,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      middle_initial TEXT NOT NULL DEFAULT '',
      display_name TEXT NOT NULL,
      grade_level INTEGER NOT NULL,
      section TEXT NOT NULL,
      birthday TEXT NOT NULL DEFAULT '',
      pin TEXT NOT NULL,
      is_archived INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS learning_profiles (
      student_id TEXT PRIMARY KEY NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      primary_style TEXT NOT NULL,
      scores_json TEXT NOT NULL,
      assessment_version INTEGER NOT NULL,
      completed_at INTEGER NOT NULL,
      guardian_acknowledged_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS adaptive_format_profiles (
      student_id TEXT PRIMARY KEY NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      initial_assessment_json TEXT NOT NULL,
      current_default_format TEXT NOT NULL,
      manual_override TEXT,
      confidence REAL NOT NULL DEFAULT 0.2,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS format_history (
      id TEXT PRIMARY KEY NOT NULL,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      attempted_at INTEGER NOT NULL,
      format TEXT NOT NULL,
      completed INTEGER NOT NULL,
      score_percentage REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS modules (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      subject TEXT NOT NULL,
      grade_level INTEGER NOT NULL,
      quarter INTEGER NOT NULL,
      competency_code TEXT NOT NULL,
      summary TEXT NOT NULL,
      content TEXT NOT NULL,
      content_style_tags_json TEXT NOT NULL,
      local_asset_uri TEXT,
      remote_asset_path TEXT,
      package_sha256 TEXT,
      package_size_bytes INTEGER,
      is_teacher_created INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quiz_questions (
      id TEXT PRIMARY KEY NOT NULL,
      module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      question_text TEXT NOT NULL,
      choices_json TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      topic_tag TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id TEXT PRIMARY KEY NOT NULL,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
      score INTEGER NOT NULL,
      total_items INTEGER NOT NULL,
      weak_topic TEXT NOT NULL,
      strong_topic TEXT NOT NULL,
      mastery_level TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL,
      attempt_number INTEGER NOT NULL,
      submitted_at INTEGER NOT NULL,
      source TEXT NOT NULL DEFAULT 'local'
    );

    CREATE TABLE IF NOT EXISTS question_responses (
      attempt_id TEXT NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL,
      answer TEXT NOT NULL,
      is_correct INTEGER NOT NULL,
      elapsed_ms INTEGER NOT NULL,
      PRIMARY KEY (attempt_id, question_id)
    );

    CREATE TABLE IF NOT EXISTS progress (
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      mastery_level TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (student_id, module_id)
    );

    CREATE TABLE IF NOT EXISTS flashcards (
      id TEXT PRIMARY KEY NOT NULL,
      module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      learning_style_tag TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS flashcard_reviews (
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      flashcard_id TEXT NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
      ease_factor REAL NOT NULL DEFAULT 2.5,
      interval_days INTEGER NOT NULL DEFAULT 0,
      repetitions INTEGER NOT NULL DEFAULT 0,
      due_at INTEGER NOT NULL,
      last_rating INTEGER,
      last_reviewed_at INTEGER,
      PRIMARY KEY (student_id, flashcard_id)
    );

    CREATE TABLE IF NOT EXISTS review_items (
      item_id TEXT PRIMARY KEY NOT NULL,
      module_id TEXT NOT NULL,
      module_version INTEGER NOT NULL,
      concept_id TEXT NOT NULL,
      type TEXT NOT NULL,
      importance TEXT NOT NULL,
      prompt TEXT NOT NULL,
      answer TEXT NOT NULL,
      formats_json TEXT NOT NULL,
      authored_by TEXT NOT NULL,
      tags_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS review_states (
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      item_id TEXT NOT NULL REFERENCES review_items(item_id) ON DELETE CASCADE,
      easiness_factor REAL NOT NULL DEFAULT 2.5,
      interval_days INTEGER NOT NULL DEFAULT 0,
      repetitions INTEGER NOT NULL DEFAULT 0,
      due_date TEXT NOT NULL,
      last_reviewed TEXT,
      PRIMARY KEY (student_id, item_id)
    );

    CREATE TABLE IF NOT EXISTS review_events (
      id TEXT PRIMARY KEY NOT NULL,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      item_id TEXT NOT NULL REFERENCES review_items(item_id) ON DELETE CASCADE,
      quality INTEGER NOT NULL,
      recalled INTEGER NOT NULL,
      elapsed_seconds INTEGER NOT NULL,
      reviewed_at INTEGER NOT NULL,
      technique TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS custom_review_sets (
      set_id TEXT PRIMARY KEY NOT NULL,
      created_by TEXT NOT NULL,
      title TEXT NOT NULL,
      item_ids_json TEXT NOT NULL,
      created_items_json TEXT NOT NULL,
      visibility TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pomodoro_sessions (
      session_id TEXT PRIMARY KEY NOT NULL,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      work_minutes INTEGER NOT NULL,
      break_minutes INTEGER NOT NULL,
      cycles_planned INTEGER NOT NULL,
      queue_snapshot_json TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_cycles INTEGER NOT NULL,
      item_log_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS parent_digests (
      digest_id TEXT PRIMARY KEY NOT NULL,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      week_start TEXT NOT NULL,
      week_end TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      generated_at INTEGER NOT NULL,
      UNIQUE(student_id, week_start)
    );

    CREATE TABLE IF NOT EXISTS teacher_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS module_manifests (
      module_id TEXT PRIMARY KEY NOT NULL,
      version INTEGER NOT NULL,
      source TEXT NOT NULL,
      manifest_json TEXT NOT NULL,
      verified_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS scanned_reports (
      report_id TEXT PRIMARY KEY NOT NULL,
      student_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      schema_version INTEGER NOT NULL,
      scanned_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scanned_report_parts (
      report_id TEXT NOT NULL,
      part INTEGER NOT NULL,
      total_parts INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      scanned_at INTEGER NOT NULL,
      PRIMARY KEY (report_id, part)
    );

    CREATE TABLE IF NOT EXISTS transfer_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      module_id TEXT NOT NULL,
      direction TEXT NOT NULL,
      peer_name TEXT NOT NULL,
      file_name TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      expected_sha256 TEXT NOT NULL,
      received_sha256 TEXT,
      bytes_transferred INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      completed_at INTEGER,
      error_message TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      last_error TEXT
    );

    CREATE TABLE IF NOT EXISTS privacy_consents (
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      notice_version TEXT NOT NULL,
      guardian_name TEXT NOT NULL,
      guardian_acknowledged_at INTEGER NOT NULL,
      ai_diagnostics_allowed INTEGER NOT NULL DEFAULT 0,
      cloud_sync_allowed INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (student_id, notice_version)
    );

    CREATE INDEX IF NOT EXISTS idx_modules_grade_subject
      ON modules(grade_level, subject, quarter);
    CREATE INDEX IF NOT EXISTS idx_attempts_student_submitted
      ON quiz_attempts(student_id, submitted_at DESC);
    CREATE INDEX IF NOT EXISTS idx_progress_student
      ON progress(student_id, status);
    CREATE INDEX IF NOT EXISTS idx_reviews_due
      ON flashcard_reviews(student_id, due_at);
    CREATE INDEX IF NOT EXISTS idx_review_states_due
      ON review_states(student_id, due_date);
    CREATE INDEX IF NOT EXISTS idx_review_events_student_time
      ON review_events(student_id, reviewed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_format_history_student_time
      ON format_history(student_id, attempted_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sync_due
      ON sync_queue(next_attempt_at);

    PRAGMA user_version = ${SCHEMA_VERSION};
  `);
  await ensureColumn(
    database,
    'quiz_attempts',
    'learning_format_used',
    "TEXT NOT NULL DEFAULT 'text'",
  );
  await database.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
}

async function seed(database: SQLite.SQLiteDatabase): Promise<void> {
  const row = await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM modules');
  if ((row?.count ?? 0) === 0) {
    await database.withTransactionAsync(async () => {
      for (const module of SEED_MODULES) {
        await database.runAsync(
        `INSERT INTO modules (
          id, title, subject, grade_level, quarter, competency_code, summary, content,
          content_style_tags_json, local_asset_uri, remote_asset_path, package_sha256,
          package_size_bytes, is_teacher_created, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        module.id,
        module.title,
        module.subject,
        module.gradeLevel,
        module.quarter,
        module.competencyCode,
        module.summary,
        module.content,
        JSON.stringify(module.contentStyleTags),
        module.localAssetUri,
        module.remoteAssetPath,
        module.packageSha256,
        module.packageSizeBytes,
        module.isTeacherCreated ? 1 : 0,
        module.updatedAt,
        );
      }

      for (const question of SEED_QUESTIONS) {
        await database.runAsync(
        `INSERT INTO quiz_questions (
          id, module_id, type, question_text, choices_json, correct_answer, topic_tag
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        question.id,
        question.moduleId,
        question.type,
        question.questionText,
        JSON.stringify(question.choices),
        question.correctAnswer,
        question.topicTag,
        );
      }

      for (const flashcard of SEED_FLASHCARDS) {
        await database.runAsync(
        `INSERT INTO flashcards (id, module_id, front, back, learning_style_tag)
         VALUES (?, ?, ?, ?, ?)`,
        flashcard.id,
        flashcard.moduleId,
        flashcard.front,
        flashcard.back,
        flashcard.learningStyleTag,
        );
      }
    });
  }
  await seedReviewItems(database);
  await seedBundledManifests(database);
}

export async function resetDatabaseForDevelopment(): Promise<void> {
  const database = await getDatabase();
  await database.execAsync(`
    DELETE FROM question_responses;
    DELETE FROM quiz_attempts;
    DELETE FROM progress;
    DELETE FROM flashcard_reviews;
    DELETE FROM review_events;
    DELETE FROM review_states;
    DELETE FROM custom_review_sets;
    DELETE FROM pomodoro_sessions;
    DELETE FROM parent_digests;
    DELETE FROM format_history;
    DELETE FROM adaptive_format_profiles;
    DELETE FROM learning_profiles;
    DELETE FROM privacy_consents;
    DELETE FROM scanned_reports;
    DELETE FROM scanned_report_parts;
    DELETE FROM transfer_sessions;
    DELETE FROM sync_queue;
    DELETE FROM students;
  `);
}

async function seedReviewItems(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    INSERT OR IGNORE INTO review_items (
      item_id, module_id, module_version, concept_id, type, importance,
      prompt, answer, formats_json, authored_by, tags_json
    )
    SELECT
      f.id,
      f.module_id,
      1,
      CASE
        WHEN instr(f.id, '_') > 0 THEN f.module_id || ':' || f.id
        ELSE f.module_id || ':review'
      END,
      'flashcard',
      'core',
      f.front,
      f.back,
      json_object('text', f.back),
      'curriculum',
      json_array(f.learning_style_tag)
    FROM flashcards f;
  `);
}

async function seedBundledManifests(
  database: SQLite.SQLiteDatabase,
): Promise<void> {
  for (const module of SEED_MODULES) {
    const reviewItems = SEED_FLASHCARDS.filter(
      (card) => card.moduleId === module.id,
    ).map((card) => ({
      itemId: card.id,
      moduleId: module.id,
      moduleVersion: 1,
      conceptId: `${module.id}:${card.id}`,
      type: 'flashcard',
      importance: 'core',
      prompt: card.front,
      answer: card.back,
      formats: { text: card.back },
      authoredBy: 'curriculum',
      tags: [card.learningStyleTag],
    }));
    const manifest = {
      moduleId: module.id,
      version: 1,
      source: 'bundled',
      gradeLevel: module.gradeLevel,
      subject: module.subject,
      formats: { text: `${module.id}.txt` },
      checksums: {},
      quizId: `${module.id}-quiz1`,
      reviewItems,
    };
    await database.runAsync(
      `INSERT OR IGNORE INTO module_manifests
       (module_id, version, source, manifest_json, verified_at)
       VALUES (?, 1, 'bundled', ?, ?)`,
      module.id,
      JSON.stringify(manifest),
      Date.now(),
    );
  }
}

async function ensureColumn(
  database: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  definition: string,
): Promise<void> {
  const columns = await database.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${table})`,
  );
  if (!columns.some((item) => item.name === column)) {
    await database.execAsync(
      `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`,
    );
  }
}
