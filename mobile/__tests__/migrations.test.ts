import { describe, expect, it } from '@jest/globals';
import { DatabaseSync } from 'node:sqlite';
import {
  BASE_SCHEMA_SQL,
  LATEST_SCHEMA_VERSION,
  runMigrations,
  type MigrationTarget,
} from '../src/data/migrations';

function target(database: DatabaseSync): MigrationTarget {
  return {
    exec: async (sql) => {
      database.exec(sql);
    },
    userVersion: async () => (database.prepare('PRAGMA user_version').get() as { user_version: number }).user_version,
    columns: async (table) =>
      (database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((column) => column.name),
  };
}

function tables(database: DatabaseSync): string[] {
  return (database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as Array<{ name: string }>).map(
    (row) => row.name,
  );
}

/** A database as shipped by PAVO 1.x (schema version 7) with learner data. */
function legacyDatabase(): DatabaseSync {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON;');
  database.exec(BASE_SCHEMA_SQL);
  database.exec(`
    ALTER TABLE quiz_attempts ADD COLUMN learning_format_used TEXT NOT NULL DEFAULT 'text';
    ALTER TABLE quiz_attempts ADD COLUMN quiz_id TEXT NOT NULL DEFAULT '';
    ALTER TABLE question_responses ADD COLUMN question_text TEXT NOT NULL DEFAULT '';
    ALTER TABLE question_responses ADD COLUMN correct_answer TEXT NOT NULL DEFAULT '';
    INSERT INTO students (id, student_number, first_name, last_name, display_name, grade_level, section, pin, updated_at)
      VALUES ('student_ana', '2026-001', 'Ana', 'Santos', 'Ana Santos', 5, 'Sampaguita', '1234', 1);
    INSERT INTO teachers (teacher_id, name, age, faculty_id, created_at) VALUES ('teacher_demo', 'Ms. Reyes', 34, 'T-2026', 1);
    INSERT INTO sections (section_id, teacher_id, name, grade_level, is_active, created_at)
      VALUES ('section_1', 'teacher_demo', 'Sampaguita', 5, 1, 1);
    INSERT INTO section_roster (section_id, student_id, added_at) VALUES ('section_1', 'student_ana', 1);
    INSERT INTO modules (id, title, subject, grade_level, quarter, competency_code, summary, content, content_style_tags_json, updated_at)
      VALUES ('g5-science-plants', 'Plants', 'SCIENCE', 5, 1, 'S5LT', 'Plants', '# Plants', '[]', 1);
    INSERT INTO quiz_questions (id, module_id, type, question_text, choices_json, correct_answer, topic_tag)
      VALUES ('q1', 'g5-science-plants', 'MULTIPLE_CHOICE', 'Which part makes food?', '["Leaf","Root"]', 'Leaf', 'parts');
    INSERT INTO quiz_attempts (id, student_id, module_id, score, total_items, weak_topic, strong_topic, mastery_level,
      duration_seconds, attempt_number, submitted_at) VALUES ('attempt_1', 'student_ana', 'g5-science-plants', 1, 1, '-', 'parts',
      'ADVANCED', 30, 1, 1);
    INSERT INTO learning_packages (package_id, owner_id, content_category, title, manifest_json, created_at)
      VALUES ('quiz_old', 'teacher:teacher_demo', 'teacherQuiz', 'Old quiz', '{}', 1);
    PRAGMA user_version = 7;
  `);
  return database;
}

describe('SQLite migrations', () => {
  it('upgrades a version 7 database without losing learner progress, sections, or packages', async () => {
    const database = legacyDatabase();
    const result = await runMigrations(target(database));
    expect(result).toEqual({ from: 7, to: LATEST_SCHEMA_VERSION });
    expect(tables(database)).toEqual(
      expect.arrayContaining([
        'assessments',
        'imported_results',
        'paper_scans',
        'paper_corrections',
        'quiz_sessions',
        'student_quizzes',
        'pavo_packages',
        'lesson_progress',
        'enrolled_device_keys',
        'ai_provenance',
      ]),
    );
    expect(database.prepare('SELECT display_name FROM students').get()).toEqual({ display_name: 'Ana Santos' });
    expect(database.prepare('SELECT score, attempt_number FROM quiz_attempts').get()).toEqual({ score: 1, attempt_number: 1 });
    expect(database.prepare('SELECT student_id FROM section_roster').get()).toEqual({ student_id: 'student_ana' });
    expect(database.prepare('SELECT title FROM learning_packages').get()).toEqual({ title: 'Old quiz' });
    expect(database.prepare('SELECT id, position FROM quiz_questions').get()).toEqual({ id: 'q1', position: null });
    for (const column of ['parent_name', 'parent_phone']) {
      expect((database.prepare('PRAGMA table_info(students)').all() as Array<{ name: string }>).map((row) => row.name)).toContain(column);
    }
  });

  it('is idempotent and also builds a fresh database', async () => {
    const database = legacyDatabase();
    await runMigrations(target(database));
    await expect(runMigrations(target(database))).resolves.toEqual({ from: LATEST_SCHEMA_VERSION, to: LATEST_SCHEMA_VERSION });

    const fresh = new DatabaseSync(':memory:');
    const result = await runMigrations(target(fresh));
    expect(result).toEqual({ from: 0, to: LATEST_SCHEMA_VERSION });
    expect((fresh.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(LATEST_SCHEMA_VERSION);
    expect(tables(fresh)).toContain('paper_scans');
  });

  it('enforces new constraints such as result verification labels and paper scan states', async () => {
    const database = new DatabaseSync(':memory:');
    await runMigrations(target(database));
    expect(() =>
      database.exec(`INSERT INTO imported_results VALUES ('r1','s','q',1,'p','A',1,1,1,'trusted','result_qr','[]',NULL,1,1,'t')`),
    ).toThrow();
    expect(() =>
      database.exec(`INSERT INTO paper_scans (scan_id, quiz_id, quiz_version, form_code, template_id, status, detections_json,
        metrics_json, warnings_json, teacher_id, scanned_at) VALUES ('s1','q',1,'A','t','guessed','[]','{}','[]','t',1)`),
    ).toThrow();
  });

  it('rolls back a failed migration and leaves the version unchanged', async () => {
    const database = legacyDatabase();
    database.exec('CREATE TABLE assessments (broken INTEGER);');
    const failing = target(database);
    await expect(
      runMigrations({
        ...failing,
        exec: async (sql) => {
          if (sql.includes('ALTER TABLE quiz_questions ADD COLUMN position')) {
            database.exec('CREATE TABLE IF NOT EXISTS probe (x INTEGER);');
            throw new Error('disk full');
          }
          await failing.exec(sql);
        },
      }),
    ).rejects.toThrow('disk full');
    expect((database.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(7);
  });
});
