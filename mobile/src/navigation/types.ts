import type { LearningModule, QuizAttempt } from '@/domain/types';

export type RootStackParamList = {
  Role: undefined;
  StudentLogin: undefined;
  StudentSetup: undefined;
  LearningAssessment: { studentId: string };
  StudentTabs: undefined;
  ModuleReader: { moduleId: string };
  Quiz: { moduleId: string };
  QuizResult: { module: LearningModule; attempt: QuizAttempt };
  Flashcards: undefined;
  ReviewHub: undefined;
  CustomReviewSets: undefined;
  ParentDigest: undefined;
  QuizReport: { moduleId: string; attemptId: string };
  TeacherLogin: undefined;
  TeacherTabs: undefined;
  LearnerDetail: { studentId: string };
  Transfer: { setId?: string } | undefined;
  ReceiveTransfer: undefined;
};

export type StudentTabParamList = {
  StudentHome: undefined;
  Modules: undefined;
  Reports: undefined;
  Profile: undefined;
};

export type TeacherTabParamList = {
  TeacherHome: undefined;
  RecordBook: undefined;
  Scanner: undefined;
  Gurobot: undefined;
};
