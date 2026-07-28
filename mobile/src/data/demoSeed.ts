import type { SQLiteDatabase } from 'expo-sqlite';
import { getDatabase, resetDatabaseForDevelopment } from './database';
import { saveStudent } from './repository';
import type { LearningFormat, Subject } from '@/domain/types';

/**
 * Demo / mock data seeder.
 *
 * Populates the local SQLite database with a believable classroom so the app
 * can be explored "live": a teacher, an active section, a spread of learners
 * (top performers → struggling), modules with quiz questions and flashcards,
 * graded attempts, progress, and upcoming tasks.
 *
 * This does NOT change any schema, repository API, or app logic — it only
 * inserts rows through the same tables the app already reads, using the
 * existing `saveStudent` helper plus direct inserts that mirror the
 * repository's own INSERT shapes.
 */

const DAY = 86_400_000;
const nowMs = () => Date.now();

export const DEMO_STUDENT = { studentNumber: '2026-001', pin: '1234', name: 'Maria' };
export const DEMO_TEACHER = { facultyId: 'T-2026', name: 'Ms. Reyes', age: 34 };

type Tier = 'excellent' | 'great' | 'good' | 'okay' | 'struggling';

interface DemoLearner {
  key: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  pin: string;
  // correct answers out of 5, for [science, math, english]
  scores: [number, number, number];
}

const MODULES: Array<{
  id: string;
  title: string;
  subject: Subject;
  competencyCode: string;
  summary: string;
  content: string;
  tags: string[];
  flashcards: Array<[string, string]>;
  questions: Array<{ q: string; choices: string[]; answer: string; topic: string }>;
}> = [
  {
    id: 'demo_sci_ecosystems',
    title: 'Ecosystems & Food Chains',
    subject: 'SCIENCE',
    competencyCode: 'S5LT-IIa-1',
    summary: 'How living things depend on each other and their environment.',
    content:
      '# Ecosystems & Food Chains\n\nAn **ecosystem** is a community of living things and their environment.\n\n## Food chains\nEnergy flows from the `sun` to `producers` (plants), then to `consumers` (animals), and finally to `decomposers`.\n\n- **Producers** make their own food.\n- **Consumers** eat other living things.\n- **Decomposers** break down dead matter.\n\n> Every living thing has a role in keeping the ecosystem balanced.',
    tags: ['visual', 'reading'],
    flashcards: [
      ['What is a producer?', 'A living thing that makes its own food, like a plant.'],
      ['What do decomposers do?', 'They break down dead plants and animals.'],
      ['Where does a food chain get its energy?', 'From the sun.'],
    ],
    questions: [
      { q: 'What is the main source of energy in a food chain?', choices: ['The sun', 'The soil', 'The wind', 'The rain'], answer: 'The sun', topic: 'Energy flow' },
      { q: 'Which of these is a producer?', choices: ['Grass', 'Frog', 'Snake', 'Eagle'], answer: 'Grass', topic: 'Producers' },
      { q: 'What do we call animals that eat other animals?', choices: ['Consumers', 'Producers', 'Decomposers', 'Minerals'], answer: 'Consumers', topic: 'Consumers' },
      { q: 'Which organism breaks down dead matter?', choices: ['Fungi', 'Deer', 'Hawk', 'Corn'], answer: 'Fungi', topic: 'Decomposers' },
      { q: 'A group of living things and their environment is a(n)…', choices: ['Ecosystem', 'Galaxy', 'Machine', 'Mineral'], answer: 'Ecosystem', topic: 'Ecosystems' },
    ],
  },
  {
    id: 'demo_math_fractions',
    title: 'Understanding Fractions',
    subject: 'MATH',
    competencyCode: 'M5NS-Ia-1',
    summary: 'Reading, comparing, and adding simple fractions.',
    content:
      '# Understanding Fractions\n\nA **fraction** shows part of a whole. In `3/4`, the top number (**numerator**) is the parts we have, and the bottom (**denominator**) is the total parts.\n\n## Comparing\nWith the same denominator, the bigger numerator is the bigger fraction.\n\n- 1/2 is the same as 2/4\n- 3/4 is greater than 1/4',
    tags: ['visual', 'kinesthetic'],
    flashcards: [
      ['What is the top number of a fraction called?', 'The numerator.'],
      ['What is the bottom number called?', 'The denominator.'],
      ['Which is larger, 3/4 or 1/4?', '3/4.'],
    ],
    questions: [
      { q: 'In the fraction 3/5, what is the numerator?', choices: ['3', '5', '8', '2'], answer: '3', topic: 'Numerator' },
      { q: 'Which fraction is equal to 1/2?', choices: ['2/4', '1/3', '3/5', '2/5'], answer: '2/4', topic: 'Equivalent fractions' },
      { q: 'Which fraction is the largest?', choices: ['3/4', '1/4', '2/4', '0/4'], answer: '3/4', topic: 'Comparing' },
      { q: 'What is 1/4 + 1/4?', choices: ['2/4', '1/8', '2/8', '1/4'], answer: '2/4', topic: 'Adding' },
      { q: 'The bottom number of a fraction is the…', choices: ['Denominator', 'Numerator', 'Product', 'Sum'], answer: 'Denominator', topic: 'Denominator' },
    ],
  },
  {
    id: 'demo_eng_grammar',
    title: 'Parts of Speech',
    subject: 'ENGLISH',
    competencyCode: 'EN5G-Ia-2',
    summary: 'Nouns, verbs, and adjectives in everyday sentences.',
    content:
      '# Parts of Speech\n\nWords do different jobs in a sentence.\n\n- A **noun** names a person, place, or thing: `teacher`, `Manila`, `book`.\n- A **verb** shows action: `run`, `read`, `sing`.\n- An **adjective** describes a noun: `happy`, `blue`, `tall`.',
    tags: ['reading', 'auditory'],
    flashcards: [
      ['What does a noun name?', 'A person, place, or thing.'],
      ['What does a verb show?', 'An action.'],
      ['What does an adjective do?', 'It describes a noun.'],
    ],
    questions: [
      { q: 'Which word is a noun?', choices: ['Dog', 'Run', 'Quickly', 'Blue'], answer: 'Dog', topic: 'Nouns' },
      { q: 'Which word is a verb?', choices: ['Jump', 'Table', 'Happy', 'Slowly'], answer: 'Jump', topic: 'Verbs' },
      { q: 'Which word is an adjective?', choices: ['Tall', 'Sing', 'River', 'Teacher'], answer: 'Tall', topic: 'Adjectives' },
      { q: 'In "The red ball", which word is the adjective?', choices: ['Red', 'The', 'Ball', 'None'], answer: 'Red', topic: 'Adjectives' },
      { q: 'A word that shows action is a…', choices: ['Verb', 'Noun', 'Adjective', 'Number'], answer: 'Verb', topic: 'Verbs' },
    ],
  },
  {
    id: 'demo_sci_matter',
    title: 'States of Matter',
    subject: 'SCIENCE',
    competencyCode: 'S5MT-Ia-1',
    summary: 'Solids, liquids, and gases and how they change.',
    content:
      '# States of Matter\n\nMatter comes in three common states: **solid**, **liquid**, and **gas**.\n\n- A **solid** keeps its shape.\n- A **liquid** takes the shape of its container.\n- A **gas** spreads to fill any space.\n\nHeating and cooling can change one state into another.',
    tags: ['visual', 'kinesthetic'],
    flashcards: [
      ['Which state keeps its shape?', 'A solid.'],
      ['Which state fills any container?', 'A gas.'],
      ['What can change a solid to a liquid?', 'Heating (melting).'],
    ],
    questions: [
      { q: 'Which state of matter keeps its own shape?', choices: ['Solid', 'Liquid', 'Gas', 'None'], answer: 'Solid', topic: 'Solids' },
      { q: 'Water is an example of a…', choices: ['Liquid', 'Solid', 'Gas', 'Metal'], answer: 'Liquid', topic: 'Liquids' },
      { q: 'What happens to ice when it is heated?', choices: ['It melts', 'It freezes', 'It disappears', 'It grows'], answer: 'It melts', topic: 'Changes' },
      { q: 'Which spreads to fill any space?', choices: ['Gas', 'Solid', 'Liquid', 'Rock'], answer: 'Gas', topic: 'Gases' },
      { q: 'Cooling a liquid enough turns it into a…', choices: ['Solid', 'Gas', 'Plasma', 'Light'], answer: 'Solid', topic: 'Changes' },
    ],
  },
];

const LEARNERS: DemoLearner[] = [
  { key: 'maria', studentNumber: '2026-001', firstName: 'Maria', lastName: 'Santos', pin: '1234', scores: [5, 5, 4] },
  { key: 'josefa', studentNumber: '2026-002', firstName: 'Josefa', lastName: 'Reyes', pin: '2222', scores: [5, 4, 4] },
  { key: 'andres', studentNumber: '2026-003', firstName: 'Andres', lastName: 'Bonifacio', pin: '3333', scores: [4, 4, 3] },
  { key: 'gabriela', studentNumber: '2026-004', firstName: 'Gabriela', lastName: 'Silang', pin: '4444', scores: [4, 3, 4] },
  { key: 'emilio', studentNumber: '2026-005', firstName: 'Emilio', lastName: 'Aguinaldo', pin: '5555', scores: [3, 3, 3] },
  { key: 'apolinario', studentNumber: '2026-006', firstName: 'Apolinario', lastName: 'Mabini', pin: '6666', scores: [3, 2, 3] },
  { key: 'melchora', studentNumber: '2026-007', firstName: 'Melchora', lastName: 'Aquino', pin: '7777', scores: [2, 2, 1] },
  { key: 'diego', studentNumber: '2026-008', firstName: 'Diego', lastName: 'Silang', pin: '8888', scores: [1, 2, 1] },
];

const GRADED_MODULES = ['demo_sci_ecosystems', 'demo_math_fractions', 'demo_eng_grammar'] as const;
const SECTION_NAME = 'Section Mabini';

function masteryFor(pct: number): string {
  if (pct >= 85) return 'ADVANCED';
  if (pct >= 70) return 'PROFICIENT';
  if (pct >= 50) return 'DEVELOPING';
  return 'BEGINNER';
}

/** Whether demo data already exists (so we don't reseed on every launch). */
export async function hasDemoData(): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM students WHERE id = 'demo_stu_maria'",
  );
  return (row?.count ?? 0) > 0;
}

/** Wipe local data and seed a full demo classroom. Returns demo student credentials. */
export async function seedDemoData(): Promise<{ studentNumber: string; pin: string }> {
  const db = await getDatabase();
  await resetDatabaseForDevelopment();

  const teacherId = 'demo_teacher_reyes';
  const sectionId = 'demo_section_mabini';
  const created = nowMs();

  // Teacher + active section
  await db.runAsync(
    `INSERT INTO teachers (teacher_id, name, age, faculty_id, created_at) VALUES (?, ?, ?, ?, ?)`,
    teacherId,
    DEMO_TEACHER.name,
    DEMO_TEACHER.age,
    DEMO_TEACHER.facultyId,
    created,
  );
  await db.runAsync(
    `INSERT INTO sections (section_id, teacher_id, name, grade_level, is_active, created_at)
     VALUES (?, ?, ?, ?, 1, ?)`,
    sectionId,
    teacherId,
    SECTION_NAME,
    5,
    created,
  );

  // Modules, questions, flashcards.
  // `resetDatabaseForDevelopment()` intentionally does NOT clear the modules /
  // quiz_questions / flashcards tables (a teacher may have authored their own
  // modules we must not wipe). So the demo's own rows are written with INSERT
  // OR REPLACE — re-running the demo overwrites its fixed `demo_*` ids cleanly
  // instead of colliding on the primary key.
  for (const mod of MODULES) {
    await db.runAsync(
      `INSERT OR REPLACE INTO modules (
        id, title, subject, grade_level, quarter, competency_code, summary,
        content, content_style_tags_json, is_teacher_created, updated_at
      ) VALUES (?, ?, ?, 5, 1, ?, ?, ?, ?, 1, ?)`,
      mod.id,
      mod.title,
      mod.subject,
      mod.competencyCode,
      mod.summary,
      mod.content,
      JSON.stringify(mod.tags),
      created,
    );
    for (let i = 0; i < mod.questions.length; i += 1) {
      const question = mod.questions[i]!;
      await db.runAsync(
        `INSERT OR REPLACE INTO quiz_questions (id, module_id, type, question_text, choices_json, correct_answer, topic_tag)
         VALUES (?, ?, 'MULTIPLE_CHOICE', ?, ?, ?, ?)`,
        `${mod.id}_q${i + 1}`,
        mod.id,
        question.q,
        JSON.stringify(question.choices),
        question.answer,
        question.topic,
      );
    }
    for (let i = 0; i < mod.flashcards.length; i += 1) {
      const [front, back] = mod.flashcards[i]!;
      await db.runAsync(
        `INSERT OR REPLACE INTO flashcards (id, module_id, front, back, learning_style_tag)
         VALUES (?, ?, ?, ?, ?)`,
        `${mod.id}_f${i + 1}`,
        mod.id,
        front,
        back,
        mod.tags[0] ?? 'reading',
      );
    }
  }

  // Learners (saveStudent also initializes their flashcard reviews)
  const idByKey = new Map<string, string>();
  for (const learner of LEARNERS) {
    const forcedId = `demo_stu_${learner.key}`;
    const student = await saveStudent({
      id: forcedId,
      studentNumber: learner.studentNumber,
      firstName: learner.firstName,
      lastName: learner.lastName,
      middleInitial: '',
      gradeLevel: 5,
      section: SECTION_NAME,
      birthday: '',
      pin: learner.pin,
    });
    idByKey.set(learner.key, student.id);
    await db.runAsync(
      `INSERT OR IGNORE INTO section_roster (section_id, student_id, added_at) VALUES (?, ?, ?)`,
      sectionId,
      student.id,
      created,
    );
  }

  // Attempts, responses, progress — a believable history per learner.
  // Learners who ended up strong show a two-attempt arc (a weaker first try,
  // then improvement) so the record book, reports and trend badges have real
  // history to render; struggling learners have a single recent attempt.
  const FORMATS = ['visual', 'text', 'audio'] as const;
  for (const learner of LEARNERS) {
    const studentId = idByKey.get(learner.key)!;
    for (let m = 0; m < GRADED_MODULES.length; m += 1) {
      const moduleId = GRADED_MODULES[m]!;
      const mod = MODULES.find((x) => x.id === moduleId)!;
      const finalScore = learner.scores[m]!;
      const total = mod.questions.length;
      const format = FORMATS[m % FORMATS.length]!;

      // A retake arc only where there is room to improve.
      const scores = finalScore >= 3 ? [Math.max(1, finalScore - 2), finalScore] : [finalScore];
      for (let a = 0; a < scores.length; a += 1) {
        const isLatest = a === scores.length - 1;
        // Latest attempt is recent; the earlier try sits ~9–12 days back.
        const submittedAt = isLatest
          ? created - (GRADED_MODULES.length - m) * DAY - m * 3_600_000
          : created - (9 + m) * DAY;
        await seedAttempt(db, {
          attemptId: `demo_att_${learner.key}_${m}_${a + 1}`,
          studentId,
          moduleId,
          mod,
          correct: scores[a]!,
          total,
          attemptNumber: a + 1,
          durationSeconds: 150 - a * 20 + m * 15,
          format,
          submittedAt,
        });
      }
      await db.runAsync(
        `INSERT OR REPLACE INTO progress (student_id, module_id, status, mastery_level, updated_at)
         VALUES (?, ?, 'COMPLETED', ?, ?)`,
        studentId,
        moduleId,
        masteryFor(Math.round((finalScore / total) * 100)),
        created - (GRADED_MODULES.length - m) * DAY,
      );
    }
  }

  // Review items (retrieval-practice bank) built from every module's questions
  // and flashcards. Opening the Review Hub auto-schedules these as due, so the
  // technique screens have real prompts to drill instead of an empty queue.
  const reviewItemIds = await seedReviewItems(db);

  // A shared, teacher-authored custom review set drawn from the science bank.
  await db.runAsync(
    `INSERT INTO custom_review_sets
      (set_id, created_by, title, item_ids_json, created_items_json, visibility, created_at)
     VALUES (?, ?, ?, ?, '[]', 'shared', ?)`,
    'demo_set_ecosystems',
    teacherId,
    'Ecosystem key ideas',
    JSON.stringify(reviewItemIds.filter((id) => id.startsWith('demo_sci_ecosystems')).slice(0, 4)),
    created,
  );

  // Learning profile + adaptive format for the demo student (drives the home hero)
  const mariaId = idByKey.get('maria')!;
  await db.runAsync(
    `INSERT OR REPLACE INTO learning_profiles
      (student_id, primary_style, scores_json, assessment_version, completed_at, guardian_acknowledged_at)
     VALUES (?, 'visual', ?, 1, ?, ?)`,
    mariaId,
    JSON.stringify({ visual: 4, auditory: 2, reading: 3, kinesthetic: 2 }),
    created,
    created,
  );
  await db.runAsync(
    `INSERT OR REPLACE INTO adaptive_format_profiles
      (student_id, initial_assessment_json, current_default_format, manual_override, confidence, updated_at)
     VALUES (?, ?, 'visual', NULL, 0.72, ?)`,
    mariaId,
    JSON.stringify({ visual: 0.5, auditory: 0.2, reading: 0.2, kinesthetic: 0.1 }),
    created,
  );

  // Format history — the signal behind "Pavo recommends visual". Recent visual
  // work scores highest, so the recommendation the app shows is earned.
  const formatRuns: Array<[LearningFormat, number, number]> = [
    ['visual', 92, 1],
    ['visual', 88, 3],
    ['text', 74, 5],
    ['audio', 68, 8],
    ['kinesthetic', 80, 11],
  ];
  for (let i = 0; i < formatRuns.length; i += 1) {
    const [format, score, daysAgo] = formatRuns[i]!;
    await db.runAsync(
      `INSERT INTO format_history (id, student_id, attempted_at, format, completed, score_percentage)
       VALUES (?, ?, ?, ?, 1, ?)`,
      `demo_fmt_${i}`,
      mariaId,
      created - daysAgo * DAY,
      format,
      score,
    );
  }

  // A little retrieval-practice history for the demo student, so the review
  // analytics and streak reflect real activity rather than a cold start.
  const techniques = ['active-recall', 'retrieval-quiz', 'interleaved', 'blurting'] as const;
  const historyItems = reviewItemIds.slice(0, 6);
  for (let i = 0; i < historyItems.length; i += 1) {
    const recalled = i % 4 !== 0 ? 1 : 0; // mostly recalled, a couple missed
    await db.runAsync(
      `INSERT INTO review_events
        (id, student_id, item_id, quality, recalled, elapsed_seconds, reviewed_at, technique)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      `demo_rev_${i}`,
      mariaId,
      historyItems[i]!,
      recalled ? 4 + (i % 2) : 2,
      recalled,
      12 + i * 3,
      created - (i + 1) * 3_600_000,
      techniques[i % techniques.length]!,
    );
  }

  // Upcoming tasks for the demo student
  const issuedAt = new Date(created).toISOString();
  const due = (days: number) => new Date(created + days * DAY).toISOString().slice(0, 10);
  await seedTask(db, mariaId, 'module', 'demo_sci_matter', due(2), SECTION_NAME, issuedAt);
  await seedTask(db, mariaId, 'quiz', 'demo_math_fractions', due(4), SECTION_NAME, issuedAt);

  return { studentNumber: DEMO_STUDENT.studentNumber, pin: DEMO_STUDENT.pin };
}

/** Insert one graded attempt plus its per-question responses. */
async function seedAttempt(
  db: SQLiteDatabase,
  args: {
    attemptId: string;
    studentId: string;
    moduleId: string;
    mod: (typeof MODULES)[number];
    correct: number;
    total: number;
    attemptNumber: number;
    durationSeconds: number;
    format: LearningFormat;
    submittedAt: number;
  },
): Promise<void> {
  const { mod, correct, total } = args;
  const pct = Math.round((correct / total) * 100);
  const orderedTopics = mod.questions.map((question) => question.topic);
  const strongTopic = orderedTopics[0] ?? mod.subject;
  const weakTopic = orderedTopics[total - 1] ?? 'Review';
  await db.runAsync(
    `INSERT OR REPLACE INTO quiz_attempts (
      id, student_id, module_id, score, total_items, weak_topic, strong_topic,
      mastery_level, duration_seconds, attempt_number, submitted_at, source, learning_format_used
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local', ?)`,
    args.attemptId,
    args.studentId,
    args.moduleId,
    correct,
    total,
    correct < total ? weakTopic : 'Ready for next challenge',
    strongTopic,
    masteryFor(pct),
    args.durationSeconds,
    args.attemptNumber,
    args.submittedAt,
    args.format,
  );
  for (let i = 0; i < total; i += 1) {
    const question = mod.questions[i]!;
    const isCorrect = i < correct;
    await db.runAsync(
      `INSERT OR REPLACE INTO question_responses (attempt_id, question_id, answer, is_correct, elapsed_ms)
       VALUES (?, ?, ?, ?, ?)`,
      args.attemptId,
      `${args.moduleId}_q${i + 1}`,
      isCorrect ? question.answer : (question.choices.find((c) => c !== question.answer) ?? 'A'),
      isCorrect ? 1 : 0,
      8000 + i * 1500,
    );
  }
}

/**
 * Seed the retrieval-practice bank from module content. Returns the created
 * item ids. Written with INSERT OR REPLACE because `review_items` is shared
 * curriculum data that the dev reset intentionally leaves in place.
 */
async function seedReviewItems(db: SQLiteDatabase): Promise<string[]> {
  const ids: string[] = [];
  for (const mod of MODULES) {
    // Flashards → flashcard items.
    for (let i = 0; i < mod.flashcards.length; i += 1) {
      const [front, back] = mod.flashcards[i]!;
      const itemId = `${mod.id}_ri_f${i + 1}`;
      await upsertReviewItem(db, {
        itemId,
        moduleId: mod.id,
        conceptId: mod.competencyCode,
        type: 'flashcard',
        importance: i === 0 ? 'core' : 'supplementary',
        prompt: front,
        answer: back,
        formats: { text: front },
        tags: mod.tags,
      });
      ids.push(itemId);
    }
    // Quiz questions → quiz-question items.
    for (let i = 0; i < mod.questions.length; i += 1) {
      const question = mod.questions[i]!;
      const itemId = `${mod.id}_ri_q${i + 1}`;
      await upsertReviewItem(db, {
        itemId,
        moduleId: mod.id,
        conceptId: question.topic,
        type: 'quiz-question',
        importance: i < 2 ? 'core' : i < 4 ? 'supplementary' : 'stretch',
        prompt: question.q,
        answer: question.answer,
        formats: { text: question.q },
        tags: [question.topic],
      });
      ids.push(itemId);
    }
  }
  return ids;
}

async function upsertReviewItem(
  db: SQLiteDatabase,
  item: {
    itemId: string;
    moduleId: string;
    conceptId: string;
    type: 'flashcard' | 'quiz-question' | 'concept-summary';
    importance: 'core' | 'supplementary' | 'stretch';
    prompt: string;
    answer: string;
    formats: { text?: string; audio?: string; visual?: string };
    tags: string[];
  },
): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO review_items
      (item_id, module_id, module_version, concept_id, type, importance,
       prompt, answer, formats_json, authored_by, tags_json)
     VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`,
    item.itemId,
    item.moduleId,
    item.conceptId,
    item.type,
    item.importance,
    item.prompt,
    item.answer,
    JSON.stringify(item.formats),
    DEMO_TEACHER.name,
    JSON.stringify(item.tags),
  );
}

async function seedTask(
  db: SQLiteDatabase,
  studentId: string,
  type: 'module' | 'quiz',
  targetId: string,
  dueDate: string,
  section: string,
  issuedAt: string,
): Promise<void> {
  await db.runAsync(
    `INSERT OR IGNORE INTO student_tasks (
      task_id, student_id, task_type, target_id, due_date, issued_by, issued_at, class_section, completed_at
    ) VALUES (?, ?, ?, ?, ?, 'Ms. Reyes', ?, ?, NULL)`,
    `demo_task_${type}_${targetId}`,
    studentId,
    type,
    targetId,
    dueDate,
    issuedAt,
    section,
  );
}
