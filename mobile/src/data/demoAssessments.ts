import { buildStudentQuiz, questionsForForm, scoreQuizResponses } from '@/domain/assessmentModel';
import { DEMO_PACKAGES, demoResponses } from '@/domain/demoContent';
import { buildExportBundle } from '@/domain/exportBundle';
import { standardTemplate } from '@/domain/omr';
import { buildQuizFromDraft } from '@/domain/quizAuthoring';
import { getInstalledPackage, installAuthoredArchive } from '@/services/packagesV2';
import { getAssessment, saveLocalResult } from './assessmentRepository';
import { installStudentQuiz } from './studentQuizRepository';

const DAY = 86_400_000;
const CREATED_AT = '2026-09-28T08:00:00.000Z';

/**
 * Installs the shared demo packages through the real export → install path
 * (lesson, digital mini-quiz, paper quiz with forms A and B), then records a
 * class worth of graded results so analytics and remediation have data.
 */
export async function seedDemoAssessments(args: {
  teacherId: string;
  teacherName: string;
  sectionLabel: string;
  learners: Array<{ studentId: string; skill: number }>;
  /** The demo student takes the mini-quiz live, so no result is pre-seeded for them. */
  liveStudentId: string;
  now: number;
}): Promise<void> {
  for (const [index, demo] of DEMO_PACKAGES.entries()) {
    const quiz = demo.quiz ? buildQuizFromDraft(demo.quiz, `teacher:${args.teacherId}`, CREATED_AT) : null;
    if (!(await getInstalledPackage(demo.id, 1))) {
      const bundle = await buildExportBundle({
        packageId: demo.id,
        version: 1,
        title: demo.title,
        gradeLevel: demo.gradeLevel,
        subject: demo.subject,
        author: { id: args.teacherId, name: args.teacherName },
        source: 'pavo-demo',
        createdAt: CREATED_AT,
        attribution: { authors: [args.teacherName], license: 'CC-BY-4.0', sourceUrl: null, notice: 'Original PAVO demo content.' },
        redistribution: { studentToStudent: true, teacherToTeacher: true, expiresAt: null },
        provenance: null,
        module: { lesson: demo.lesson, images: {} },
        quiz,
        paper:
          quiz?.mode === 'paper_omr'
            ? { template: standardTemplate(demo.quiz!.templateId)!, sectionLabel: args.sectionLabel }
            : null,
      });
      await installAuthoredArchive(bundle.teacherPackage.archive, 'teacher');
    }
    if (!quiz) continue;
    if (quiz.mode === 'digital_mini_quiz') {
      await installStudentQuiz({ quiz: buildStudentQuiz(quiz), packageId: demo.id });
    }
    const assessment = await getAssessment(quiz.quizId, quiz.version);
    if (!assessment) continue;
    for (const [position, learner] of args.learners.entries()) {
      if (quiz.mode === 'digital_mini_quiz' && learner.studentId === args.liveStudentId) continue;
      const formCode = quiz.forms[position % quiz.forms.length]!.code;
      const responses = demoResponses(quiz.questions, learner.skill, position * 31 + index * 7 + 1);
      const scored = scoreQuizResponses(quiz, formCode, responses);
      const answerIndex = new Map(questionsForForm(quiz, formCode).map(({ question }) => [question.id, question]));
      await saveLocalResult(assessment.guide, assessment.studentPackageId, {
        resultId: `demo_${quiz.quizId}_${learner.studentId}`,
        studentId: learner.studentId,
        quizId: quiz.quizId,
        quizVersion: quiz.version,
        formCode,
        attemptNumber: 1,
        source: quiz.mode === 'paper_omr' ? 'paper_scan' : 'result_qr',
        completedAt: args.now - (index + 1) * DAY - position * 600_000,
        score: scored.score,
        total: scored.total,
        items: scored.items.map((item) => {
          const question = answerIndex.get(item.questionId);
          const response = responses[item.questionId] ?? '';
          const choice = question ? question.choices.indexOf(response) : -1;
          return { questionId: item.questionId, outcome: item.outcome, selectedChoice: choice >= 0 ? choice : null };
        }),
      }, args.teacherId);
    }
  }
}
