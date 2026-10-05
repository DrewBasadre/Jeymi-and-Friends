import { useMemo, useState } from 'react';
import { Square } from 'lucide-react';
import { LESSON_BLOCK_LABELS, checkAnswer } from '@pavo/domain/adaptiveLesson';
import { CHOICE_LABELS, buildStudentQuiz } from '@pavo/domain/assessmentModel';
import { buildQuizFromDraft } from '@pavo/domain/quizAuthoring';
import { readableError, syncLesson, type Project } from '../project';
import { Callout, Markdown, imageUrl } from './common';

export function PreviewTab({ project }: { project: Project }) {
  return (
    <div className="preview-grid">
      <section className="stack">
        <div className="stack tight">
          <h2>Lesson</h2>
          <p className="small muted">Tap through it the way a learner would on their phone.</p>
        </div>
        {project.lesson ? <LessonPreview project={project} /> : <Callout tone="info" title="No lesson">This package only carries an assessment.</Callout>}
      </section>
      <section className="stack">
        <div className="stack tight">
          <h2>Assessment</h2>
          <p className="small muted">Built from the student package, so it shows exactly what ships.</p>
        </div>
        <QuizPreview project={project} />
      </section>
    </div>
  );
}

function LessonPreview({ project }: { project: Project }) {
  const lesson = syncLesson(project);
  const [step, setStep] = useState(0);
  const [hints, setHints] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const block = lesson.blocks[Math.min(step, lesson.blocks.length - 1)];
  if (!block) return null;
  const go = (next: number) => {
    setStep(next);
    setHints(0);
    setPicked(null);
  };
  return (
    <div className="phone" aria-label="Phone preview of the lesson">
      <div className="phone-bar">
        <strong>{lesson.title}</strong>
        <span className="small muted">
          Step {step + 1} of {lesson.blocks.length} · {LESSON_BLOCK_LABELS[block.type]}
        </span>
      </div>
      <div className="meter thin" aria-hidden="true">
        <span style={{ width: `${((step + 1) / lesson.blocks.length) * 100}%` }} />
      </div>
      <div className={`step ${block.type === 'check' ? 'check' : ''}`}>
        <span className="block-label">{LESSON_BLOCK_LABELS[block.type]}</span>
        {block.image ? (
          <figure style={{ margin: 0 }}>
            {project.images[block.image.path] ? <img src={imageUrl(block.image.path, project.images[block.image.path]!)} alt={block.image.alt} /> : <p className="small muted">Image not attached yet.</p>}
            {block.image.caption ? <figcaption className="small muted">{block.image.caption}</figcaption> : null}
          </figure>
        ) : null}
        {block.markdown && !block.check && !block.hints && !block.items ? <Markdown source={block.markdown} images={project.images} /> : null}
        {block.hints ? (
          <>
            {block.hints.slice(0, hints).map((hint, index) => (
              <p key={index}>
                {index + 1}. {hint}
              </p>
            ))}
            {hints < block.hints.length ? (
              <button type="button" className="button secondary small" onClick={() => setHints(hints + 1)}>
                Show hint {hints + 1} of {block.hints.length}
              </button>
            ) : null}
          </>
        ) : null}
        {block.check ? (
          <>
            <strong>{block.check.prompt}</strong>
            {block.check.choices.map((choice, index) => (
              <button key={index} type="button" className="option" style={{ cursor: 'pointer', background: picked === index ? 'var(--primary-tint)' : undefined }} onClick={() => setPicked(index)}>
                <strong>{CHOICE_LABELS[index]}</strong> {choice.text}
              </button>
            ))}
            {picked !== null ? (
              checkAnswer(block, picked) ? <Callout tone="success" title="That's right">{block.check.explanation}</Callout> : <Callout tone="warning" title="Not yet">Learners see the remediation block for this concept here.</Callout>
            ) : null}
          </>
        ) : null}
        {block.items ? (
          <ul className="checklist">
            {block.items.map((item, index) => (
              <li key={index}>
                <Square size={16} aria-hidden="true" /> {item}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="row">
        <button type="button" className="button secondary small" disabled={step === 0} onClick={() => go(step - 1)}>
          Back
        </button>
        <button type="button" className="button small" disabled={step >= lesson.blocks.length - 1} onClick={() => go(step + 1)}>
          Continue
        </button>
      </div>
      <p className="small muted">On phones, PAVO may reorder steps or add review steps based on each learner's evidence, and explains why.</p>
    </div>
  );
}

function QuizPreview({ project }: { project: Project }) {
  const result = useMemo(() => {
    if (!project.quiz) return { error: 'No assessment in this package.' } as const;
    try {
      return { quiz: buildQuizFromDraft({ ...project.quiz, version: project.version }, `teacher:${project.author.id}`, new Date().toISOString()) } as const;
    } catch (error) {
      return { error: readableError(error) } as const;
    }
  }, [project]);
  if ('error' in result) return <Callout tone="warning" title="Not ready to preview">{result.error}</Callout>;
  const { quiz } = result;
  if (quiz.mode === 'paper_omr') {
    return (
      <Callout tone="info" title="Paper quiz">
        Paper quizzes are printed, not shown on phones. Open Quiz paper PDF and Answer sheet PDF in the Assessment tab to see them exactly as they will print.
      </Callout>
    );
  }
  const studentQuiz = buildStudentQuiz(quiz);
  return (
    <div className="phone" aria-label="Phone preview of the mini-quiz">
      <div className="phone-bar">
        <strong>{studentQuiz.title}</strong>
        <span className="small muted">
          {studentQuiz.questions.length} questions
          {studentQuiz.policy.timeLimitMinutes ? ` · ${studentQuiz.policy.timeLimitMinutes} min` : ''}
        </span>
      </div>
      {studentQuiz.questions.map((question) => (
        <div key={question.id} className="step check">
          <span className="small muted">
            Question {question.position} · {question.points} point{question.points === 1 ? '' : 's'}
          </span>
          <strong>{question.prompt}</strong>
          {question.choices.length ? (
            question.choices.map((choice, index) => (
              <div key={choice} className="option">
                <strong>{question.kind === 'true_false' ? (index === 0 ? 'T' : 'F') : CHOICE_LABELS[index]}</strong> {choice}
              </div>
            ))
          ) : (
            <div className="option muted">Type your answer</div>
          )}
        </div>
      ))}
      <p className="small muted">This preview is built from the student package. It contains salted answer digests, never the answer key.</p>
    </div>
  );
}
