export type AppMode = 'lightweight' | 'full';
export type UserRole = 'student' | 'teacher';
export type LearningStyle = 'visual' | 'auditory' | 'reading' | 'kinesthetic' | 'balanced';
export type Subject = 'SCIENCE' | 'MATH' | 'ENGLISH' | 'ADDED_MATERIALS';
export type ProgressStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
export type MasteryLevel = 'BEGINNER' | 'DEVELOPING' | 'PROFICIENT' | 'ADVANCED';
export type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'IDENTIFICATION';

export interface Student {
  id: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  middleInitial: string;
  displayName: string;
  gradeLevel: number;
  section: string;
  birthday: string;
  pin: string;
  isArchived: boolean;
}

export interface LearningProfile {
  studentId: string;
  primaryStyle: LearningStyle;
  scores: Record<Exclude<LearningStyle, 'balanced'>, number>;
  assessmentVersion: number;
  completedAt: number;
  guardianAcknowledgedAt: number | null;
}

export interface LearningAssessmentAnswer {
  questionId: string;
  style: Exclude<LearningStyle, 'balanced'>;
}

export interface LearningModule {
  id: string;
  title: string;
  subject: Subject;
  gradeLevel: number;
  quarter: number;
  competencyCode: string;
  summary: string;
  content: string;
  contentStyleTags: LearningStyle[];
  localAssetUri: string | null;
  remoteAssetPath: string | null;
  packageSha256: string | null;
  packageSizeBytes: number | null;
  isTeacherCreated: boolean;
  updatedAt: number;
}

export interface QuizQuestion {
  id: string;
  moduleId: string;
  type: QuestionType;
  questionText: string;
  choices: string[];
  correctAnswer: string;
  topicTag: string;
}

export interface QuestionResponse {
  questionId: string;
  answer: string;
  isCorrect: boolean;
  elapsedMs: number;
}

export interface QuizAttempt {
  id: string;
  studentId: string;
  moduleId: string;
  score: number;
  totalItems: number;
  weakTopic: string;
  strongTopic: string;
  masteryLevel: MasteryLevel;
  durationSeconds: number;
  attemptNumber: number;
  submittedAt: number;
  responses: QuestionResponse[];
}

export interface StudentProgress {
  studentId: string;
  moduleId: string;
  status: ProgressStatus;
  masteryLevel: MasteryLevel;
  updatedAt: number;
}

export interface Flashcard {
  id: string;
  moduleId: string;
  front: string;
  back: string;
  learningStyleTag: LearningStyle;
}

export interface DueFlashcard extends Flashcard {
  studentId: string;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  dueAt: number;
}

export type FlashcardRating = 1 | 2 | 3 | 4;

export interface StudentDashboard {
  completedModules: number;
  totalModules: number;
  averageScore: number;
  dueFlashcards: number;
  weakTopic: string;
  strongTopic: string;
  totalAttempts: number;
}

export interface TeacherLearnerRow {
  studentId: string;
  studentNumber: string;
  displayName: string;
  section: string;
  averageScore: number;
  completedModules: number;
  totalAttempts: number;
  weakTopic: string;
  struggling: boolean;
}

export interface TeacherDashboard {
  classAverage: number;
  leaderboard: TeacherLearnerRow[];
  strugglingStudents: TeacherLearnerRow[];
  learners: TeacherLearnerRow[];
}

export interface DiagnosticInput {
  gradeLevel: number;
  subject: Subject;
  competencyCode: string;
  scoreBand: 'LOW' | 'DEVELOPING' | 'PROFICIENT' | 'ADVANCED';
  durationBand: 'FAST' | 'EXPECTED' | 'SLOW';
  topicOutcomeCounts: Array<{ topic: string; correct: number; incorrect: number }>;
  attemptTrend: 'FIRST_ATTEMPT' | 'IMPROVING' | 'STEADY' | 'DECLINING';
  learningStyleTag: LearningStyle;
}

export interface AiSuggestion {
  summary: string;
  actions: string[];
  monitoringPlan: string;
  source: 'edge' | 'offline';
}

export interface TransferPackage {
  moduleId: string;
  displayName: string;
  fileUri: string;
  mimeType: 'application/pdf';
  sizeBytes: number;
  sha256: string;
}

