import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { getDatabase } from '@/data/database';
import { getStudent, loginStudent, saveStudent } from '@/data/repository';
import type { AppMode, Student, UserRole } from '@/domain/types';
import { detectDeviceCapability, setModeOverride } from '@/services/deviceTier';

const SESSION_KEY = 'wais.studentSession';

interface SessionState {
  ready: boolean;
  role: UserRole | null;
  student: Student | null;
  mode: AppMode;
  modeReason: string;
  canUseOnlineEnhancements: boolean;
  bootstrap(): Promise<void>;
  chooseRole(role: UserRole | null): void;
  login(identifier: string, pin: string): Promise<boolean>;
  createStudent(input: Parameters<typeof saveStudent>[0]): Promise<Student>;
  setMode(mode: AppMode): Promise<void>;
  signOut(): Promise<void>;
}

export const useSessionStore = create<SessionState>((set) => ({
  ready: false,
  role: null,
  student: null,
  mode: 'lightweight',
  modeReason: 'Checking device',
  canUseOnlineEnhancements: false,

  async bootstrap() {
    await getDatabase();
    const [capability, studentId] = await Promise.all([
      detectDeviceCapability(),
      AsyncStorage.getItem(SESSION_KEY),
    ]);
    const student = studentId ? await getStudent(studentId) : null;
    set({
      ready: true,
      student,
      role: student ? 'student' : null,
      mode: capability.mode,
      modeReason: capability.reason,
      canUseOnlineEnhancements: capability.canUseOnlineEnhancements,
    });
  },

  chooseRole(role) {
    set({ role });
  },

  async login(identifier, pin) {
    const student = await loginStudent(identifier, pin);
    if (!student) return false;
    await AsyncStorage.setItem(SESSION_KEY, student.id);
    set({ student, role: 'student' });
    return true;
  },

  async createStudent(input) {
    const student = await saveStudent(input);
    await AsyncStorage.setItem(SESSION_KEY, student.id);
    set({ student, role: 'student' });
    return student;
  },

  async setMode(mode) {
    const capability = await setModeOverride(mode);
    set({
      mode: capability.mode,
      modeReason: capability.reason,
      canUseOnlineEnhancements: capability.canUseOnlineEnhancements,
    });
  },

  async signOut() {
    await AsyncStorage.removeItem(SESSION_KEY);
    set({ student: null, role: null });
  },
}));

