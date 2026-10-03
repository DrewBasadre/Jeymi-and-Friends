import * as SQLite from 'expo-sqlite';
import { removeLegacyAddedMaterialsDemoFiles } from '@/services/modulePackages';
import { runMigrations } from './migrations';

const DATABASE_NAME = 'pavo-next.db';
let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME).then(async (database) => {
      await database.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
      await runMigrations({
        exec: (sql) => database.execAsync(sql),
        userVersion: async () =>
          (await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0,
        columns: async (table) =>
          (await database.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`)).map((column) => column.name),
      });
      removeLegacyAddedMaterialsDemoFiles();
      return database;
    });
  }
  return databasePromise;
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
    DELETE FROM learning_packages;
    DELETE FROM chat_sessions;
    DELETE FROM student_tasks;
    DELETE FROM section_roster;
    DELETE FROM sections;
    DELETE FROM teachers;
    DELETE FROM students;
    DELETE FROM quiz_sessions;
    DELETE FROM imported_results;
    DELETE FROM paper_corrections;
    DELETE FROM paper_scans;
    DELETE FROM lesson_progress;
    DELETE FROM learning_recommendations;
    DELETE FROM enrolled_device_keys;
  `);
}
