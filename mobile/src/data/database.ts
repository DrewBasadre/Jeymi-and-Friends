import * as SQLite from 'expo-sqlite';
import { removeLegacyAddedMaterialsDemoFiles } from '@/services/modulePackages';

const DATABASE_NAME = 'wais-next.db';
const SCHEMA_VERSION = 5;

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME).then(async (database) => {
      await migrate(database);
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

    CREATE TABLE IF NOT EXISTS teachers (
      teacher_id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      age INTEGER NOT NULL,
      faculty_id TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sections (
      section_id TEXT PRIMARY KEY NOT NULL,
      teacher_id TEXT NOT NULL REFERENCES teachers(teacher_id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      grade_level INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      UNIQUE(teacher_id, name)
    );

    CREATE TABLE IF NOT EXISTS section_roster (
      section_id TEXT NOT NULL REFERENCES sections(section_id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      added_at INTEGER NOT NULL,
      PRIMARY KEY (section_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS student_tasks (
      task_id TEXT PRIMARY KEY NOT NULL,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      task_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      due_date TEXT NOT NULL,
      issued_by TEXT NOT NULL,
      issued_at TEXT NOT NULL,
      class_section TEXT NOT NULL,
      completed_at TEXT,
      UNIQUE(student_id, task_type, target_id, due_date)
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

    CREATE TABLE IF NOT EXISTS parent_pins (
      student_id TEXT PRIMARY KEY NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      parent_pin_hash TEXT NOT NULL,
      pin_set_at INTEGER NOT NULL
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
    CREATE INDEX IF NOT EXISTS idx_sections_teacher
      ON sections(teacher_id, is_active DESC);
    CREATE INDEX IF NOT EXISTS idx_roster_student
      ON section_roster(student_id);
    CREATE INDEX IF NOT EXISTS idx_student_tasks_due
      ON student_tasks(student_id, completed_at, due_date);

    PRAGMA user_version = ${SCHEMA_VERSION};
  `);
  await ensureColumn(
    database,
    'quiz_attempts',
    'learning_format_used',
    "TEXT NOT NULL DEFAULT 'text'",
  );
  await database.execAsync(`
    DELETE FROM module_manifests
    WHERE json_extract(manifest_json, '$.content.markdown') IS NULL;
    UPDATE modules
    SET content = CASE
          WHEN trim(content) = '' THEN
            '# Module needs re-export\n\nThis legacy PDF module must be shared again as Markdown.'
          ELSE content
        END,
        summary = CASE
          WHEN trim(summary) = '' THEN 'Legacy module awaiting Markdown re-export.'
          ELSE summary
        END,
        local_asset_uri = NULL
    WHERE lower(local_asset_uri) LIKE '%.pdf';
    DELETE FROM modules
    WHERE id IN (
      SELECT module_id FROM module_manifests WHERE source = 'bundled'
    );
    DELETE FROM module_manifests
    WHERE source NOT IN ('teacher-bluetooth', 'seed-bundle');
    DELETE FROM module_manifests
    WHERE module_id LIKE 'image-demo-%'
       OR module_id LIKE 'markdown-demo-%';
    DELETE FROM modules
    WHERE id LIKE 'image-demo-%'
       OR id LIKE 'markdown-demo-%';
    DROP TABLE IF EXISTS sync_queue;
    DROP TABLE IF EXISTS privacy_consents;
  `);
  removeLegacyAddedMaterialsDemoFiles();
  await database.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
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
    DELETE FROM parent_pins;
    DELETE FROM format_history;
    DELETE FROM adaptive_format_profiles;
    DELETE FROM learning_profiles;
    DELETE FROM scanned_reports;
    DELETE FROM scanned_report_parts;
    DELETE FROM transfer_sessions;
    DELETE FROM student_tasks;
    DELETE FROM section_roster;
    DELETE FROM sections;
    DELETE FROM teachers;
    DELETE FROM students;
  `);
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
