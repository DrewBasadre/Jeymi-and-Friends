export interface InlineRecallActivity {
  prompt: string;
  answer: string;
  sentence: string;
  selectionStart: number;
  selectionEnd: number;
}

export function createInlineRecallFromSelection(
  text: string,
  start: number,
  end: number,
): InlineRecallActivity | null {
  const lower = Math.max(0, Math.min(start, end));
  const upper = Math.min(text.length, Math.max(start, end));
  if (lower === upper) return null;

  const rawSelection = text.slice(lower, upper);
  const leadingSpace = rawSelection.length - rawSelection.trimStart().length;
  const trailingSpace = rawSelection.length - rawSelection.trimEnd().length;
  const selectionStart = lower + leadingSpace;
  const selectionEnd = upper - trailingSpace;
  const answer = text.slice(selectionStart, selectionEnd);
  if (answer.length < 2 || !/[\p{L}\p{N}]/u.test(answer)) return null;

  let sentenceStart = findSentenceStart(text, selectionStart);
  while (sentenceStart < selectionStart && /\s/.test(text[sentenceStart] ?? '')) {
    sentenceStart += 1;
  }
  const sentenceEnd = findSentenceEnd(text, selectionEnd);
  const sentence = text.slice(sentenceStart, sentenceEnd).trimEnd();
  const answerOffset = selectionStart - sentenceStart;
  const prompt = [
    sentence.slice(0, answerOffset).trimStart(),
    '_____',
    sentence.slice(answerOffset + answer.length).trimEnd(),
  ]
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    prompt,
    answer,
    sentence,
    selectionStart,
    selectionEnd,
  };
}

export function createInlineRecallForTerm(
  text: string,
  term: string,
): InlineRecallActivity | null {
  const normalizedTerm = term.trim();
  if (!normalizedTerm) return null;
  const start = text.toLocaleLowerCase().indexOf(normalizedTerm.toLocaleLowerCase());
  if (start < 0) return null;
  return createInlineRecallFromSelection(
    text,
    start,
    start + normalizedTerm.length,
  );
}

export function isInlineRecallAnswerCorrect(
  activity: Pick<InlineRecallActivity, 'answer'>,
  response: string,
): boolean {
  return normalize(response) === normalize(activity.answer);
}

function findSentenceStart(text: string, selectionStart: number): number {
  for (let index = selectionStart - 1; index >= 0; index -= 1) {
    if (/[.!?\n]/.test(text[index] ?? '')) return index + 1;
  }
  return 0;
}

function findSentenceEnd(text: string, selectionEnd: number): number {
  for (let index = selectionEnd; index < text.length; index += 1) {
    if (/[.!?\n]/.test(text[index] ?? '')) return index + 1;
  }
  return text.length;
}

function normalize(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[.,!?;:]+$/g, '')
    .replace(/\s+/g, ' ');
}
