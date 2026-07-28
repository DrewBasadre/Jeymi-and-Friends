export type AppMode = 'lightweight' | 'full';
export type UserRole = 'student' | 'teacher';
export type LearningStyle = 'visual' | 'auditory' | 'reading' | 'kinesthetic' | 'balanced';
export type LearningFormat = 'text' | 'audio' | 'visual' | 'kinesthetic';
export type Subject = 'SCIENCE' | 'MATH' | 'ENGLISH' | 'ADDED_MATERIALS';
export type ProgressStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
export type MasteryLevel = 'BEGINNER' | 'DEVELOPING' | 'PROFICIENT' | 'ADVANCED';
export type QuestionType =
  | 'MULTIPLE_CHOICE'
  | 'FILL_IN_THE_BLANK'
  | 'IDENTIFICATION';

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

export type AssignmentTask =
  | {
      type: 'module';
      moduleId: string;
      dueDate: string;
    }
  | {
      type: 'quiz';
      quizId: string;
      dueDate: string;
    };

export interface StudentTask {
  taskId: string;
  studentId: string;
  type: AssignmentTask['type'];
  targetId: string;
  dueDate: string;
  issuedBy: string;
  issuedAt: string;
  classSection: string;
  completedAt: string | null;
}

export interface TeacherProfile {
  teacherId: string;
  name: string;
  age: number;
  facultyId: string;
  createdAt: string;
}

export interface Section {
  sectionId: string;
  teacherId: string;
  name: string;
  gradeLevel: number;
  isActive: boolean;
  roster: string[];
}

export interface LearningProfile {
  studentId: string;
  primaryStyle: LearningStyle;
  scores: Record<Exclude<LearningStyle, 'balanced'>, number>;
  assessmentVersion: number;
  completedAt: number;
  guardianAcknowledgedAt: number | null;
}

export interface FormatHistoryEntry {
  date: string;
  format: LearningFormat;
  completed: boolean;
  scorePercentage: number;
}

export interface AdaptiveFormatProfile {
  studentId: string;
  initialAssessment: Record<LearningFormat, number> & {
    completedAt: string;
  };
  currentDefaultFormat: LearningFormat;
  manualOverride: LearningFormat | null;
  confidence: number;
  formatHistory: FormatHistoryEntry[];
  updatedAt: number;
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

export type ModuleSource =
  | 'supabase-ota'
  | 'teacher-bluetooth'
  | 'seed-bundle';
export type ReviewItemType = 'flashcard' | 'quiz-question' | 'concept-summary';
export type ReviewImportance = 'core' | 'supplementary' | 'stretch';

export interface ReviewItem {
  itemId: string;
  moduleId: string;
  moduleVersion: number;
  conceptId: string;
  type: ReviewItemType;
  importance: ReviewImportance;
  prompt: string;
  answer: string;
  formats: {
    text?: string;
    audio?: string;
    visual?: string;
  };
  authoredBy: string;
  tags: string[];
}

export interface CurriculumModuleManifest {
  moduleId: string;
  version: number;
  source: ModuleSource;
  gradeLevel: number;
  subject: string;
  content: {
    markdown: string;
    audio?: string;
  };
  assets: string[];
  checksums: Record<string, string>;
  quizId: string;
  reviewItems?: ReviewItem[];
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

export interface BundledQuizQuestion {
  questionId: string;
  type: 'multiple-choice' | 'fill-in-the-blank' | 'identification';
  prompt: string;
  options?: string[];
  correctAnswer: string;
  conceptId: string;
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
  learningFormatUsed: LearningFormat;
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

export type FlashcardRating = 0 | 1 | 2 | 3 | 4 | 5;

export interface ReviewState {
  itemId: string;
  studentId: string;
  easinessFactor: number;
  intervalDays: number;
  repetitions: number;
  dueDate: string;
  lastReviewed: string | null;
}

export interface DueReviewItem extends ReviewItem {
  state: ReviewState;
}

export interface CustomReviewSet {
  setId: string;
  createdBy: string;
  title: string;
  itemIds: string[];
  createdItems: ReviewItem[];
  visibility: 'private' | 'shared-to-class';
  createdAt: number;
}

export type StudyTechnique =
  | 'active-recall'
  | 'retrieval-quiz'
  | 'interleaved';

export interface PomodoroItemLog {
  itemId: string;
  result: 'recalled' | 'forgot';
  timeSeconds: number;
}

export interface PomodoroSession {
  sessionId: string;
  studentId: string;
  workMinutes: number;
  breakMinutes: number;
  cyclesPlanned: number;
  queueSnapshot: string[];
  startedAt: string;
  completedCycles: number;
  itemLog: PomodoroItemLog[];
}

export interface ParentDigestSummary {
  modulesCompleted: number;
  quizzesTaken: number;
  averageScorePercentage: number;
  trend: PerformanceTrend;
  flashcardsReviewed: number;
  engagementDaysActive: number;
  topStrugglingConcepts: Array<{
    conceptId: string;
    missCount: number;
  }>;
}

export interface ParentDigest {
  digestId: string;
  studentId: string;
  weekOf: string;
  summary: ParentDigestSummary;
  insightNote: string;
  scoreTrend: Array<{
    date: string;
    averageScorePercentage: number;
  }>;
  engagementDays: Array<{
    date: string;
    active: boolean;
  }>;
  generatedAt: string;
}

export interface ParentPinRecord {
  studentId: string;
  parentPinHash: string;
  pinSetAt: string;
}

export interface StudentDashboard {
  completedModules: number;
  totalModules: number;
  moduleCompletionPercentage: number;
  averageScore: number;
  dueFlashcards: number;
  dueReviews: number;
  weakTopic: string;
  strongTopic: string;
  totalAttempts: number;
  quizAttemptsToday: number;
  quizAttemptsByDay: Array<{
    date: string;
    count: number;
  }>;
  averageScoreTrend: Array<{
    date: string;
    averageScorePercentage: number;
  }>;
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
  strugglingReason: string;
  latestScore: number;
  decliningTrend: boolean;
  recommendedFormat: LearningFormat | null;
  formatConfidence: number;
}

export interface TeacherDashboard {
  classAverage: number;
  strugglingThreshold: number;
  leaderboard: TeacherLearnerRow[];
  strugglingStudents: TeacherLearnerRow[];
  learners: TeacherLearnerRow[];
}

export type PerformanceTrend = 'improving' | 'declining' | 'stable';

export interface StrugglingConcept {
  conceptId: string;
  missCount: number;
  attempts: number;
}

export interface StudentPerformanceReport {
  studentId: string;
  profile: {
    name: string;
    studentNumber: string;
    section: string;
    currentLearningFormat: LearningFormat;
  };
  quizHistory: QuizAttempt[];
  averageScorePercentage: number;
  strugglingConcepts: StrugglingConcept[];
  trend: PerformanceTrend;
}

export interface ClassPerformanceReport {
  sectionId: string;
  classAveragePercentage: number;
  leaderboard: Array<{
    studentId: string;
    averagePercentage: number;
  }>;
  strugglingStudents: string[];
  commonlyMissedConcepts: Array<{
    conceptId: string;
    percentOfClassMissing: number;
  }>;
}

export interface DiagnosticInput {
  moduleId: string;
  missedQuestionTopics: string[];
  timingPattern: 'fast-and-wrong' | 'slow-and-wrong' | 'mixed' | 'no-misses';
  learningFormatUsed: LearningFormat;
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
  mimeType:
    | 'application/vnd.wais.module+zip'
    | 'application/vnd.wais.review-set+json';
  sizeBytes: number;
  sha256: string;
  manifest: CurriculumModuleManifest;
}
