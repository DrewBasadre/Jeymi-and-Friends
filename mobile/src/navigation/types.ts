import type { LearningModule, QuizAttempt } from '@/domain/types';

export type RootStackParamList = {
  Landing: undefined;
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
  Sections: undefined;
  AssignmentBuilder: undefined;
  LearnerDetail: { studentId: string };
  ModuleAuthor: undefined;
  Transfer:
    | { setId?: string; packageUri?: string; displayName?: string }
    | undefined;
  ReceiveTransfer: undefined;
};

export type StudentTabParamList = {
  StudentHome: undefined;
  Modules: undefined;
  Study: undefined;
  StudentScan: undefined;
  Reports: undefined;
  Profile: undefined;
};

export type TeacherTabParamList = {
  TeacherHome: undefined;
  RecordBook: undefined;
  Scanner: undefined;
  Gurobot: undefined;
  TeacherProfile: undefined;
};
