/**
 * SQLite schema and forward-only migrations. Pure SQL so the same steps run in
 * the app (expo-sqlite) and in tests (node:sqlite). Each migration runs once,
 * inside a transaction, and advances PRAGMA user_version.
 */

/** Schema version 7: the original PAVO tables, created idempotently. */
export const BASE_SCHEMA_SQL = `
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY NOT NULL,
      student_number TEXT NOT NULL UNIQUE,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      middle_initial TEXT NOT NULL DEFAULT '',
      display_name TEXT NOT NULL,
      parent_name TEXT NOT NULL DEFAULT '',
      parent_phone TEXT NOT NULL DEFAULT '',
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

    CREATE TABLE IF NOT EXISTS learning_packages (
      package_id TEXT PRIMARY KEY NOT NULL,
      owner_id TEXT NOT NULL,
      content_category TEXT NOT NULL CHECK (
        content_category IN ('teacherQuiz', 'teacherReviewer', 'studentMaterial')
      ),
      title TEXT NOT NULL,
      manifest_json TEXT NOT NULL,
      received_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_sessions (
      session_id TEXT PRIMARY KEY NOT NULL,
      owner_id TEXT NOT NULL,
      title TEXT NOT NULL,
      messages_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
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
    CREATE INDEX IF NOT EXISTS idx_packages_owner_category
      ON learning_packages(owner_id, content_category, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_owner_updated
      ON chat_sessions(owner_id, updated_at DESC);
`;

/** Columns added to the base schema before numbered migrations existed. */
export const LEGACY_COLUMNS: Array<{ table: string; column: string; definition: string }> = [
  { table: 'quiz_attempts', column: 'learning_format_used', definition: "TEXT NOT NULL DEFAULT 'text'" },
  { table: 'students', column: 'parent_name', definition: "TEXT NOT NULL DEFAULT ''" },
  { table: 'students', column: 'parent_phone', definition: "TEXT NOT NULL DEFAULT ''" },
  { table: 'quiz_attempts', column: 'quiz_id', definition: "TEXT NOT NULL DEFAULT ''" },
  { table: 'question_responses', column: 'question_text', definition: "TEXT NOT NULL DEFAULT ''" },
  { table: 'question_responses', column: 'correct_answer', definition: "TEXT NOT NULL DEFAULT ''" },
];

/** Cleanup of retired demo content that runs on every open (idempotent). */
export const LEGACY_CLEANUP_SQL = `
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
`;

export const BASE_SCHEMA_VERSION = 7;

export const MIGRATIONS: Array<{ version: number; description: string; sql: string }> = [
  {
    version: 8,
    description: 'Assessments, result QR imports, paper scans, packages v2, lessons, device keys, AI provenance',
    sql: `
    CREATE TABLE IF NOT EXISTS pavo_packages (
      package_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      package_type TEXT NOT NULL CHECK (package_type IN ('lesson', 'quiz', 'teacher_bundle')),
      audience TEXT NOT NULL CHECK (audience IN ('student', 'teacher')),
      title TEXT NOT NULL,
      manifest_json TEXT NOT NULL,
      archive_sha256 TEXT NOT NULL,
      signature_state TEXT NOT NULL CHECK (signature_state IN ('signed', 'unsigned')),
      signer_key_id TEXT,
      directory_uri TEXT NOT NULL,
      installed_from TEXT NOT NULL,
      installed_at INTEGER NOT NULL,
      PRIMARY KEY (package_id, version)
    );

    CREATE TABLE IF NOT EXISTS assessments (
      quiz_id TEXT NOT NULL,
      quiz_version INTEGER NOT NULL,
      mode TEXT NOT NULL CHECK (mode IN ('paper_omr', 'digital_mini_quiz')),
      title TEXT NOT NULL,
      student_package_id TEXT NOT NULL,
      guide_markdown TEXT NOT NULL,
      definition_json TEXT,
      template_json TEXT,
      origin TEXT NOT NULL CHECK (origin IN ('authored', 'installed')),
      created_at INTEGER NOT NULL,
      archived_at INTEGER,
      PRIMARY KEY (quiz_id, quiz_version)
    );

    CREATE TABLE IF NOT EXISTS question_bank (
      question_id TEXT PRIMARY KEY NOT NULL,
      question_json TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
      source TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS student_quizzes (
      quiz_id TEXT NOT NULL,
      quiz_version INTEGER NOT NULL,
      package_id TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      quiz_json TEXT NOT NULL,
      installed_at INTEGER NOT NULL,
      PRIMARY KEY (quiz_id, quiz_version)
    );

    CREATE TABLE IF NOT EXISTS quiz_sessions (
      attempt_id TEXT PRIMARY KEY NOT NULL,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      quiz_id TEXT NOT NULL,
      quiz_version INTEGER NOT NULL,
      package_id TEXT NOT NULL,
      attempt_number INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('in_progress', 'submitted')),
      responses_json TEXT NOT NULL,
      current_index INTEGER NOT NULL DEFAULT 0,
      started_at INTEGER NOT NULL,
      deadline_at INTEGER,
      updated_at INTEGER NOT NULL,
      submitted_at INTEGER,
      score INTEGER,
      total INTEGER,
      percent INTEGER,
      items_json TEXT,
      result_id TEXT UNIQUE
    );

    CREATE TABLE IF NOT EXISTS imported_results (
      result_id TEXT PRIMARY KEY NOT NULL,
      student_id TEXT NOT NULL,
      quiz_id TEXT NOT NULL,
      quiz_version INTEGER NOT NULL,
      package_id TEXT NOT NULL,
      form_code TEXT NOT NULL,
      attempt_number INTEGER NOT NULL,
      score INTEGER NOT NULL,
      total INTEGER NOT NULL,
      verification TEXT NOT NULL CHECK (verification IN ('signed', 'unsigned', 'unknown_device', 'teacher_scanned')),
      source TEXT NOT NULL CHECK (source IN ('result_qr', 'paper_scan')),
      items_json TEXT NOT NULL,
      payload_text TEXT,
      completed_at INTEGER NOT NULL,
      imported_at INTEGER NOT NULL,
      imported_by TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS device_identities (
      owner_id TEXT PRIMARY KEY NOT NULL,
      public_key TEXT NOT NULL,
      key_id TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS enrolled_device_keys (
      student_id TEXT PRIMARY KEY NOT NULL,
      public_key TEXT NOT NULL,
      key_id TEXT NOT NULL,
      enrolled_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS paper_scans (
      scan_id TEXT PRIMARY KEY NOT NULL,
      quiz_id TEXT NOT NULL,
      quiz_version INTEGER NOT NULL,
      form_code TEXT NOT NULL,
      template_id TEXT NOT NULL,
      student_id TEXT,
      class_number INTEGER,
      sheet_code TEXT,
      status TEXT NOT NULL CHECK (status IN ('review', 'final', 'discarded')),
      detections_json TEXT NOT NULL,
      metrics_json TEXT NOT NULL,
      warnings_json TEXT NOT NULL,
      score INTEGER,
      total INTEGER,
      items_json TEXT,
      image_uri TEXT,
      image_retained INTEGER NOT NULL DEFAULT 0,
      teacher_id TEXT NOT NULL,
      scanned_at INTEGER NOT NULL,
      finalized_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS paper_corrections (
      id TEXT PRIMARY KEY NOT NULL,
      scan_id TEXT NOT NULL REFERENCES paper_scans(scan_id) ON DELETE CASCADE,
      question_number INTEGER NOT NULL,
      original_json TEXT NOT NULL,
      corrected_json TEXT NOT NULL,
      corrected_at TEXT NOT NULL,
      teacher_id TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lesson_progress (
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      lesson_id TEXT NOT NULL,
      lesson_version INTEGER NOT NULL,
      completed_blocks_json TEXT NOT NULL,
      check_results_json TEXT NOT NULL,
      hints_used INTEGER NOT NULL DEFAULT 0,
      completed_at INTEGER,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (student_id, lesson_id)
    );

    CREATE TABLE IF NOT EXISTS learning_recommendations (
      id TEXT PRIMARY KEY NOT NULL,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      lesson_id TEXT,
      recommended_format TEXT NOT NULL,
      signals_json TEXT NOT NULL,
      chosen_format TEXT,
      chosen_by TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_provenance (
      id TEXT PRIMARY KEY NOT NULL,
      artifact_type TEXT NOT NULL,
      artifact_id TEXT NOT NULL,
      model TEXT,
      generated_at INTEGER NOT NULL,
      source_ids_json TEXT NOT NULL,
      teacher_edited INTEGER NOT NULL DEFAULT 0,
      approved_by TEXT,
      approved_at INTEGER
    );

    ALTER TABLE quiz_questions ADD COLUMN position INTEGER;

    CREATE INDEX IF NOT EXISTS idx_quiz_sessions_student
      ON quiz_sessions(student_id, quiz_id, quiz_version, status);
    CREATE INDEX IF NOT EXISTS idx_imported_results_quiz
      ON imported_results(quiz_id, quiz_version);
    CREATE INDEX IF NOT EXISTS idx_paper_scans_quiz
      ON paper_scans(quiz_id, quiz_version, status);
`,
  },
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]!.version;

export interface MigrationTarget {
  exec(sql: string): Promise<void>;
  userVersion(): Promise<number>;
  columns(table: string): Promise<string[]>;
}

export async function runMigrations(target: MigrationTarget): Promise<{ from: number; to: number }> {
  await target.exec(BASE_SCHEMA_SQL);
  for (const patch of LEGACY_COLUMNS) {
    if (!(await target.columns(patch.table)).includes(patch.column)) {
      await target.exec(`ALTER TABLE ${patch.table} ADD COLUMN ${patch.column} ${patch.definition}`);
    }
  }
  await target.exec(LEGACY_CLEANUP_SQL);
  const from = await target.userVersion();
  if (from < BASE_SCHEMA_VERSION) await target.exec(`PRAGMA user_version = ${BASE_SCHEMA_VERSION}`);
  for (const migration of MIGRATIONS) {
    if (Math.max(from, BASE_SCHEMA_VERSION) >= migration.version) continue;
    await target.exec('BEGIN');
    try {
      await target.exec(migration.sql);
      await target.exec(`PRAGMA user_version = ${migration.version}`);
      await target.exec('COMMIT');
    } catch (error) {
      await target.exec('ROLLBACK');
      throw error;
    }
  }
  return { from, to: Math.max(from, LATEST_SCHEMA_VERSION) };
}
