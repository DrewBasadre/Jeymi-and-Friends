import type {
  ClassPerformanceReport,
  PerformanceTrend,
  QuizAttempt,
  StudentPerformanceReport,
} from './types';

function attemptPercentage(attempt: Pick<QuizAttempt, 'score' | 'totalItems'>): number {
  return attempt.totalItems > 0 ? (attempt.score / attempt.totalItems) * 100 : 0;
}

export function performanceTrend(
  attempts: Array<Pick<QuizAttempt, 'score' | 'totalItems' | 'submittedAt'>>,
): PerformanceTrend {
  const recent = [...attempts]
    .sort((a, b) => b.submittedAt - a.submittedAt)
    .slice(0, 3);
  if (recent.length < 2) return 'stable';

  const delta =
    attemptPercentage(recent[0]!) -
    attemptPercentage(recent[recent.length - 1]!);
  if (delta > 2) return 'improving';
  if (delta < -2) return 'declining';
  return 'stable';
}

export function buildClassPerformanceReport(
  sectionId: string,
  reports: StudentPerformanceReport[],
  strugglingThreshold = 60,
): ClassPerformanceReport {
  const leaderboard = reports
    .map((report) => ({
      studentId: report.studentId,
      averagePercentage: report.averageScorePercentage,
    }))
    .sort(
      (a, b) =>
        b.averagePercentage - a.averagePercentage ||
        a.studentId.localeCompare(b.studentId),
    );
  const classAveragePercentage =
    reports.length === 0
      ? 0
      : Math.round(
          (reports.reduce(
            (sum, report) => sum + report.averageScorePercentage,
            0,
          ) /
            reports.length) *
            10,
        ) / 10;
  const conceptStudentCounts = new Map<string, number>();
  for (const report of reports) {
    for (const conceptId of new Set(
      report.strugglingConcepts.map((concept) => concept.conceptId),
    )) {
      conceptStudentCounts.set(
        conceptId,
        (conceptStudentCounts.get(conceptId) ?? 0) + 1,
      );
    }
  }

  return {
    sectionId,
    classAveragePercentage,
    leaderboard,
    strugglingStudents: reports
      .filter((report) => {
        const latest = [...report.quizHistory].sort(
          (a, b) => b.submittedAt - a.submittedAt,
        )[0];
        return (
          report.trend === 'declining' ||
          (latest !== undefined &&
            attemptPercentage(latest) < strugglingThreshold)
        );
      })
      .map((report) => report.studentId),
    commonlyMissedConcepts: [...conceptStudentCounts.entries()]
      .map(([conceptId, count]) => ({
        conceptId,
        percentOfClassMissing:
          reports.length === 0
            ? 0
            : Math.round((count / reports.length) * 100),
      }))
      .sort(
        (a, b) =>
          b.percentOfClassMissing - a.percentOfClassMissing ||
          a.conceptId.localeCompare(b.conceptId),
      ),
  };
}
