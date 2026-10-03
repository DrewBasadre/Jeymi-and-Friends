import type { AdaptiveLesson, LessonBlock } from './adaptiveLesson';
import type { LearningFormat, LearningStyle } from './types';

export interface LearnerEvidence {
  preferredStyle: LearningStyle | null;
  adaptiveFormat: { current: LearningFormat; confidence: number } | null;
  /** Format chosen by the student or a parent; always wins. */
  manualFormat: LearningFormat | null;
  recentPercent: number | null;
  missedConcepts: string[];
  timingPattern: 'fast-and-wrong' | 'slow-and-wrong' | 'mixed' | 'no-misses' | null;
  dueReviews: number;
  accessibility: { screenReader: boolean; largeText: boolean };
  online: boolean;
}

export type EvidenceSignal =
  | 'manual_choice'
  | 'learning_preference'
  | 'format_confidence'
  | 'quiz_performance'
  | 'missed_concepts'
  | 'response_time'
  | 'review_history'
  | 'accessibility'
  | 'connectivity';

export interface PresentationPlan {
  format: LearningFormat;
  showReadAloud: boolean;
  expandWorkedExamples: boolean;
  hintsBeforePractice: boolean;
  includeExtension: boolean;
  pauseBeforeChecks: boolean;
  suggestReview: boolean;
  /** Remediation blocks shown up front because evidence says the concept was missed. */
  remediationShown: string[];
  blockOrder: string[];
  reasons: Array<{ signal: EvidenceSignal; effect: string }>;
}

const STYLE_TO_FORMAT: Record<Exclude<LearningStyle, 'balanced'>, LearningFormat> = {
  visual: 'visual',
  auditory: 'audio',
  reading: 'text',
  kinesthetic: 'kinesthetic',
};

/**
 * Chooses how to present a lesson. Every adaptation records the learner signal
 * that caused it, so the student, parent, or teacher can see why and change it.
 */
export function planLessonPresentation(lesson: AdaptiveLesson, evidence: LearnerEvidence): PresentationPlan {
  const reasons: PresentationPlan['reasons'] = [];
  let format: LearningFormat = 'text';
  if (evidence.manualFormat) {
    format = evidence.manualFormat;
    reasons.push({ signal: 'manual_choice', effect: `Showing the ${format} format you chose.` });
  } else if (evidence.adaptiveFormat && evidence.adaptiveFormat.confidence >= 0.5) {
    format = evidence.adaptiveFormat.current;
    reasons.push({
      signal: 'format_confidence',
      effect: `Your recent results went best in ${format} format (${Math.round(evidence.adaptiveFormat.confidence * 100)}% confidence).`,
    });
  } else if (evidence.preferredStyle && evidence.preferredStyle !== 'balanced') {
    format = STYLE_TO_FORMAT[evidence.preferredStyle];
    reasons.push({ signal: 'learning_preference', effect: `You said you learn best with ${evidence.preferredStyle} activities.` });
  }

  const lessonConcepts = new Set(lesson.blocks.map((block) => block.concept).filter((concept): concept is string => Boolean(concept)));
  const missed = evidence.missedConcepts.filter((concept) => lessonConcepts.has(concept));
  const struggling = (evidence.recentPercent !== null && evidence.recentPercent < 60) || missed.length > 0;
  const confident = evidence.recentPercent !== null && evidence.recentPercent >= 85 && missed.length === 0;

  const showReadAloud = format === 'audio' || evidence.accessibility.screenReader;
  if (format === 'audio') reasons.push({ signal: 'learning_preference', effect: 'Read-aloud starts each step.' });
  if (evidence.accessibility.screenReader && format !== 'audio') {
    reasons.push({ signal: 'accessibility', effect: 'Read-aloud is on because a screen reader is active.' });
  }
  if (evidence.accessibility.largeText) reasons.push({ signal: 'accessibility', effect: 'Text follows your larger font setting.' });
  if (missed.length) reasons.push({ signal: 'missed_concepts', effect: `Review steps added for ${missed.join(', ')}.` });
  if (evidence.recentPercent !== null && evidence.recentPercent < 60) {
    reasons.push({ signal: 'quiz_performance', effect: `Recent quiz average is ${evidence.recentPercent}%, so worked examples are expanded and hints come first.` });
  }
  if (confident) reasons.push({ signal: 'quiz_performance', effect: `Recent quiz average is ${evidence.recentPercent}%, so the extension activity is included.` });
  const pauseBeforeChecks = evidence.timingPattern === 'fast-and-wrong';
  if (pauseBeforeChecks) reasons.push({ signal: 'response_time', effect: 'Quick answers were often missed, so each check starts with a short pause.' });
  const suggestReview = evidence.dueReviews > 0;
  if (suggestReview) reasons.push({ signal: 'review_history', effect: `${evidence.dueReviews} review card${evidence.dueReviews === 1 ? ' is' : 's are'} due after this lesson.` });
  if (!evidence.online) reasons.push({ signal: 'connectivity', effect: 'You are offline: everything in this lesson works without internet.' });

  const remediationShown = lesson.blocks
    .filter((block) => block.type === 'remediation' && block.concept && missed.includes(block.concept))
    .map((block) => block.id);
  return {
    format,
    showReadAloud,
    expandWorkedExamples: struggling,
    hintsBeforePractice: struggling,
    includeExtension: confident,
    pauseBeforeChecks,
    suggestReview,
    remediationShown,
    blockOrder: orderBlocks(lesson.blocks, format, struggling, confident, remediationShown),
    reasons,
  };
}

function orderBlocks(
  blocks: LessonBlock[],
  format: LearningFormat,
  struggling: boolean,
  confident: boolean,
  remediationShown: string[],
): string[] {
  const visible = blocks.filter(
    (block) =>
      (block.type !== 'remediation' || remediationShown.includes(block.id)) &&
      (block.type !== 'extension' || confident),
  );
  const ordered = [...visible];
  // Moves each matching block before its anchor: the anchor with the same concept,
  // or for untagged blocks the nearest anchor that precedes it.
  const moveBefore = (predicate: (block: LessonBlock) => boolean, anchor: (block: LessonBlock) => boolean) => {
    for (const block of ordered.filter(predicate)) {
      const from = ordered.indexOf(block);
      const target = block.concept
        ? ordered.findIndex((candidate) => anchor(candidate) && candidate.concept === block.concept)
        : ordered.slice(0, from).map((candidate) => anchor(candidate)).lastIndexOf(true);
      if (target >= 0 && target < from) {
        ordered.splice(from, 1);
        ordered.splice(target, 0, block);
      }
    }
  };
  if (format === 'visual') moveBefore((block) => block.type === 'visual', (block) => block.type === 'concept');
  if (format === 'kinesthetic') moveBefore((block) => block.type === 'guided-practice', (block) => block.type === 'worked-example');
  if (struggling) {
    moveBefore((block) => block.type === 'hints', (block) => block.type === 'guided-practice');
    for (const id of remediationShown) {
      const block = ordered.find((candidate) => candidate.id === id)!;
      const concept = ordered.findIndex((candidate) => candidate.type === 'concept' && candidate.concept === block.concept);
      ordered.splice(ordered.indexOf(block), 1);
      ordered.splice(concept >= 0 ? concept + 1 : 1, 0, block);
    }
  }
  return ordered.map((block) => block.id);
}
