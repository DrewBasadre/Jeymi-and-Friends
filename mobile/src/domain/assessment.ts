import type { LearningStyle } from './types';

export interface AssessmentOption {
  id: string;
  label: string;
  style: Exclude<LearningStyle, 'balanced'>;
}

export interface AssessmentQuestion {
  id: string;
  prompt: string;
  options: AssessmentOption[];
}

export const LEARNING_ASSESSMENT: AssessmentQuestion[] = [
  {
    id: 'learn-new',
    prompt: 'When I learn something new, I like to...',
    options: [
      { id: 'see', label: 'See a picture or diagram', style: 'visual' },
      { id: 'hear', label: 'Hear someone explain it', style: 'auditory' },
      { id: 'read', label: 'Read the steps quietly', style: 'reading' },
      { id: 'try', label: 'Try it with objects', style: 'kinesthetic' },
    ],
  },
  {
    id: 'remember',
    prompt: 'I remember a lesson best when I...',
    options: [
      { id: 'color', label: 'Use colors and shapes', style: 'visual' },
      { id: 'say', label: 'Say the idea out loud', style: 'auditory' },
      { id: 'write', label: 'Write a short note', style: 'reading' },
      { id: 'move', label: 'Act it out or build it', style: 'kinesthetic' },
    ],
  },
  {
    id: 'instructions',
    prompt: 'For a new activity, I prefer...',
    options: [
      { id: 'example', label: 'A finished example to inspect', style: 'visual' },
      { id: 'spoken', label: 'Spoken directions', style: 'auditory' },
      { id: 'list', label: 'A written checklist', style: 'reading' },
      { id: 'demo', label: 'A demonstration I can follow', style: 'kinesthetic' },
    ],
  },
  {
    id: 'review',
    prompt: 'Before a quiz, I like to...',
    options: [
      { id: 'map', label: 'Review a concept map', style: 'visual' },
      { id: 'talk', label: 'Discuss with someone', style: 'auditory' },
      { id: 'notes', label: 'Read and rewrite notes', style: 'reading' },
      { id: 'practice', label: 'Solve practice tasks', style: 'kinesthetic' },
    ],
  },
];

