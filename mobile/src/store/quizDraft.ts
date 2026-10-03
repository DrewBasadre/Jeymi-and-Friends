import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import {
  DEFAULT_QUIZ_POLICY,
  type AssessmentQuestion,
  type DeliveryMode,
  type QuizForm,
  type QuizPolicy,
} from '@/domain/assessmentModel';

/** The quiz being authored on this device. Saved locally after every edit. */
export interface QuizDraft {
  quizId: string;
  version: number;
  mode: DeliveryMode | null;
  title: string;
  gradeLevel: number;
  subject: string;
  questions: AssessmentQuestion[];
  policy: QuizPolicy;
  templateId: string;
  alternateForms: number;
  retainScanImages: boolean;
  /** Answer key captured from a scanned master sheet, keyed by question ID. */
  masterKey: Record<string, { answer: string; acceptedAnswers: string[] }> | null;
  forms: QuizForm[] | null;
}

const STORAGE_KEY = 'pavo.quizDraft';

export function emptyDraft(quizId: string): QuizDraft {
  return {
    quizId,
    version: 1,
    mode: null,
    title: '',
    gradeLevel: 5,
    subject: 'Science',
    questions: [],
    policy: DEFAULT_QUIZ_POLICY,
    templateId: 'pavo-std-20x4',
    alternateForms: 0,
    retainScanImages: false,
    masterKey: null,
    forms: null,
  };
}

interface DraftState {
  draft: QuizDraft | null;
  load(): Promise<QuizDraft | null>;
  set(next: QuizDraft | null): void;
  update(patch: Partial<QuizDraft>): void;
}

export const useQuizDraftStore = create<DraftState>((set, get) => ({
  draft: null,
  async load() {
    if (get().draft) return get().draft;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const draft = raw ? (JSON.parse(raw) as QuizDraft) : null;
      set({ draft });
      return draft;
    } catch {
      return null;
    }
  },
  set(next) {
    set({ draft: next });
    void (next ? AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)) : AsyncStorage.removeItem(STORAGE_KEY));
  },
  update(patch) {
    const current = get().draft;
    if (!current) return;
    get().set({ ...current, ...patch });
  },
}));
