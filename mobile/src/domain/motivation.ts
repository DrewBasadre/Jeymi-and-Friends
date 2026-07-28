export function dashboardMascotMessage(input: {
  completedModules: number;
  totalModules: number;
  averageScore: number;
  dueReviews: number;
  totalAttempts: number;
}): string {
  if (input.totalAttempts === 0) {
    return 'Your offline library is ready. Finish one lesson quiz to start building your progress trail.';
  }
  if (input.dueReviews > 0) {
    return `${input.dueReviews} review item${input.dueReviews === 1 ? ' is' : 's are'} ready today. A short recall round will keep those ideas fresh.`;
  }
  if (input.averageScore >= 85) {
    return `Your quiz average is ${Math.round(input.averageScore)}%. Keep explaining why each answer works, not only which answer is right.`;
  }
  if (
    input.totalModules > 0 &&
    input.completedModules === input.totalModules
  ) {
    return 'Every available module is complete. Revisit the weakest topic and try to improve an earlier quiz.';
  }
  return 'Progress grows through short, honest practice. Take the next lesson one question at a time.';
}

export function quizMascotMessage(input: {
  correct: number;
  total: number;
  attemptNumber: number;
}): string {
  const percentage =
    input.total === 0 ? 0 : (input.correct / input.total) * 100;
  if (percentage >= 90) {
    return 'Excellent retrieval. Explain one answer in your own words to make the learning stick.';
  }
  if (percentage >= 70) {
    return 'Solid work. Review the missed concept once, then try again when it is due.';
  }
  if (input.attemptNumber > 1) {
    return 'This attempt is useful evidence. Reopen the lesson, focus on the missed ideas, and build from there.';
  }
  return 'A first attempt shows what to practice next. Review the lesson and return when you are ready.';
}
