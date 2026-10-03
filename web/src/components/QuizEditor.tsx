import { useState } from 'react';
import { CHOICE_LABELS, type AssessmentQuestion } from '@pavo/domain/assessmentModel';
import { STANDARD_TEMPLATE_OPTIONS, templateFitIssue } from '@pavo/domain/omr';
import { renderAnswerSheetPdf, renderQuizPaperPdf } from '@pavo/domain/paperPdf';
import { KINDS_FOR_MODE, KIND_LABELS, buildQuizFromDraft, newQuestion, type QuizDraftInput } from '@pavo/domain/quizAuthoring';
import { backend, requestAiDraft } from '../backend';
import { questionsFromAiDraft } from '../convert';
import { customTemplateId, newQuizDraft, readableError, resolveTemplate, rosterEntries, type Project } from '../project';
import { Callout, Chip, Field, openPdf } from './common';
import { markEdited } from './LessonEditor';

export function QuizEditor({ project, onChange }: { project: Project; onChange: (patch: Partial<Project>) => void }) {
  const quiz = project.quiz;
  if (!quiz) {
    return (
      <div className="card empty">
        <p>Add a paper quiz or a digital mini-quiz to this package.</p>
        <button type="button" className="button" onClick={() => onChange({ quiz: newQuizDraft(project) })}>
          Add an assessment
        </button>
      </div>
    );
  }
  const set = (patch: Partial<QuizDraftInput>) => onChange({ quiz: { ...quiz, ...patch }, aiDrafts: markEdited(project, 'quiz') });

  return (
    <div className="stack">
      <div className="card">
        <h2>1. Assessment type</h2>
        <p className="muted small">Pick one. Only the settings for that type are shown.</p>
        <div className="mode-choice">
          <button
            type="button"
            className="mode-card"
            aria-pressed={quiz.mode === 'paper_omr'}
            onClick={() => set({ mode: 'paper_omr', questions: quiz.questions.filter((question) => KINDS_FOR_MODE.paper_omr.includes(question.kind)), forms: null })}
          >
            <strong>Paper quiz</strong>
            <span className="small muted">Printed questions and a PAVO bubble sheet, graded offline by the teacher's phone. No student device needed.</span>
          </button>
          <button type="button" className="mode-card" aria-pressed={quiz.mode === 'digital_mini_quiz'} onClick={() => set({ mode: 'digital_mini_quiz', forms: null, masterKey: null })}>
            <strong>Digital mini-quiz</strong>
            <span className="small muted">A short check answered in the PAVO app and returned to you as a compact result QR.</span>
          </button>
        </div>
      </div>

      {quiz.mode ? (
        <>
          <div className="card">
            <h2>2. Details</h2>
            <div className="grid-2">
              <Field label="Quiz title" value={quiz.title} onChange={(title) => set({ title })} />
              <Field label="Quiz ID" value={quiz.quizId} onChange={(quizId) => set({ quizId: quizId.trim() })} hint="Stays the same across versions." />
            </div>
          </div>

          <AiQuizDraft project={project} onChange={onChange} />

          {quiz.questions.map((question, index) => (
            <QuestionCard
              key={question.id}
              index={index}
              count={quiz.questions.length}
              question={question}
              onChange={(next) => set({ questions: quiz.questions.map((item, position) => (position === index ? next : item)) })}
              onMove={(delta) => {
                const next = [...quiz.questions];
                const [item] = next.splice(index, 1);
                next.splice(index + delta, 0, item!);
                set({ questions: next, forms: null });
              }}
              onDuplicate={() => set({ questions: [...quiz.questions.slice(0, index + 1), { ...question, id: `q${Date.now().toString(36)}` }, ...quiz.questions.slice(index + 1)], forms: null })}
              onRemove={() => set({ questions: quiz.questions.filter((_, position) => position !== index), forms: null })}
            />
          ))}
          <div className="card">
            <h3>Add a question</h3>
            <div className="row">
              {KINDS_FOR_MODE[quiz.mode].map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className="button secondary small"
                  onClick={() => set({ questions: [...quiz.questions, newQuestion(kind, `q${Date.now().toString(36)}`, { topic: quiz.questions.at(-1)?.topic ?? '', competency: quiz.questions.at(-1)?.competency ?? '' })], forms: null })}
                >
                  + {KIND_LABELS[kind]}
                </button>
              ))}
            </div>
          </div>

          {quiz.mode === 'digital_mini_quiz' ? <DigitalSettings quiz={quiz} set={set} /> : <PaperSettings project={project} quiz={quiz} set={set} onChange={onChange} />}
        </>
      ) : null}
      <button type="button" className="button danger small" onClick={() => onChange({ quiz: null })}>
        Remove assessment
      </button>
    </div>
  );
}

function QuestionCard({
  index,
  count,
  question,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
}: {
  index: number;
  count: number;
  question: AssessmentQuestion;
  onChange: (question: AssessmentQuestion) => void;
  onMove: (delta: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const [notes, setNotes] = useState(false);
  const set = (patch: Partial<AssessmentQuestion>) => onChange({ ...question, ...patch });
  return (
    <div className="card accent">
      <div className="row between">
        <span className="block-label">
          Q{index + 1} · {KIND_LABELS[question.kind]} · <span className="mono">{question.id}</span>
        </span>
        <div className="row">
          <button type="button" className="icon-button" aria-label="Move up" disabled={index === 0} onClick={() => onMove(-1)}>↑</button>
          <button type="button" className="icon-button" aria-label="Move down" disabled={index === count - 1} onClick={() => onMove(1)}>↓</button>
          <button type="button" className="icon-button" aria-label="Duplicate" onClick={onDuplicate}>⧉</button>
          <button type="button" className="icon-button" aria-label="Remove" onClick={onRemove}>×</button>
        </div>
      </div>
      <Field label="Question" value={question.prompt} onChange={(prompt) => set({ prompt })} />
      {question.kind === 'multiple_choice' ? (
        <div className="stack">
          {question.choices.map((choice, choiceIndex) => (
            <div key={choiceIndex} className="choice-row">
              <button type="button" className="key-dot" aria-pressed={choice !== '' && question.answer === choice} aria-label={`Mark ${CHOICE_LABELS[choiceIndex]} correct`} onClick={() => set({ answer: choice })}>
                {CHOICE_LABELS[choiceIndex]}
              </button>
              <input
                type="text"
                value={choice}
                aria-label={`Choice ${CHOICE_LABELS[choiceIndex]}`}
                onChange={(event) => {
                  const value = event.target.value;
                  set({
                    choices: question.choices.map((item, position) => (position === choiceIndex ? value : item)),
                    answer: question.answer !== '' && question.answer === choice ? value : question.answer,
                    acceptedAnswers: question.acceptedAnswers.map((accepted) => (accepted === choice ? value : accepted)),
                  });
                }}
              />
              <Chip
                label="Also correct"
                pressed={question.acceptedAnswers.includes(choice)}
                onClick={() =>
                  set({
                    acceptedAnswers: question.acceptedAnswers.includes(choice)
                      ? question.acceptedAnswers.filter((accepted) => accepted !== choice)
                      : [...question.acceptedAnswers, choice].filter((accepted) => accepted && accepted !== question.answer),
                  })
                }
              />
            </div>
          ))}
          <div className="row">
            {question.choices.length < 5 ? <button type="button" className="button ghost small" onClick={() => set({ choices: [...question.choices, ''] })}>Add a choice</button> : null}
            {question.choices.length > 2 ? <button type="button" className="button ghost small" onClick={() => set({ choices: question.choices.slice(0, -1) })}>Remove last choice</button> : null}
          </div>
        </div>
      ) : question.kind === 'true_false' ? (
        <div className="row">
          {(['True', 'False'] as const).map((value) => (
            <Chip key={value} label={value} pressed={question.answer === value} onClick={() => set({ answer: value })} />
          ))}
        </div>
      ) : (
        <div className="grid-2">
          <Field label="Answer" value={question.answer} onChange={(answer) => set({ answer })} />
          <Field label="Also accept (comma separated)" value={question.acceptedAnswers.join(', ')} onChange={(value) => set({ acceptedAnswers: value.split(',').map((item) => item.trim()).filter(Boolean) })} />
        </div>
      )}
      <div className="grid-3">
        <Field label="Topic" value={question.topic} onChange={(topic) => set({ topic })} />
        <Field label="Competency" value={question.competency} onChange={(competency) => set({ competency })} />
        <Field label="Points" type="number" value={question.points} onChange={(value) => set({ points: Math.max(1, Math.min(100, Number(value) || 1)) })} />
      </div>
      <div className="row">
        {(['easy', 'medium', 'hard'] as const).map((difficulty) => (
          <Chip key={difficulty} label={difficulty} pressed={question.difficulty === difficulty} onClick={() => set({ difficulty })} />
        ))}
        <button type="button" className="button ghost small" aria-expanded={notes} onClick={() => setNotes(!notes)}>
          {notes ? 'Hide teaching notes' : 'Teaching notes'}
        </button>
      </div>
      {notes ? (
        <div className="grid-2">
          <Field label="Rationale" value={question.rationale} onChange={(rationale) => set({ rationale })} />
          <Field label="Likely misconception" value={question.misconception} onChange={(misconception) => set({ misconception })} />
          <Field label="Recommended intervention" value={question.intervention} onChange={(intervention) => set({ intervention })} />
          <Field label="Remediation lesson or block" value={question.remediationRef} onChange={(remediationRef) => set({ remediationRef })} />
        </div>
      ) : null}
    </div>
  );
}

function DigitalSettings({ quiz, set }: { quiz: QuizDraftInput; set: (patch: Partial<QuizDraftInput>) => void }) {
  const policy = quiz.policy;
  const update = (patch: Partial<typeof policy>) => set({ policy: { ...policy, ...patch } });
  return (
    <div className="card">
      <h2>3. Mini-quiz settings</h2>
      <div className="stack">
        <span className="small muted">Attempts</span>
        <div className="row">
          {[1, 2, 3, 5, null].map((limit) => (
            <Chip key={String(limit)} label={limit === null ? 'Unlimited' : String(limit)} pressed={policy.attemptLimit === limit} onClick={() => update({ attemptLimit: limit })} />
          ))}
        </div>
        <span className="small muted">Feedback</span>
        <div className="row">
          <Chip label="After each answer" pressed={policy.feedback === 'immediate'} onClick={() => update({ feedback: 'immediate' })} />
          <Chip label="After submitting" pressed={policy.feedback === 'after_submit'} onClick={() => update({ feedback: 'after_submit' })} />
          <Chip label="Score only" pressed={policy.feedback === 'score_only'} onClick={() => update({ feedback: 'score_only' })} />
          <Chip label="Show correct answers after submitting" pressed={policy.revealAnswers} onClick={() => update({ revealAnswers: !policy.revealAnswers })} />
        </div>
        <span className="small muted">Retakes</span>
        <div className="row">
          <Chip label="None" pressed={policy.retake === 'not_allowed'} onClick={() => update({ retake: 'not_allowed' })} />
          <Chip label="Until mastery" pressed={policy.retake === 'below_mastery'} onClick={() => update({ retake: 'below_mastery' })} />
          <Chip label="Always" pressed={policy.retake === 'allowed'} onClick={() => update({ retake: 'allowed' })} />
        </div>
        <div className="grid-3">
          <Field label="Mastery %" type="number" value={policy.masteryPercent} onChange={(value) => update({ masteryPercent: Math.max(1, Math.min(100, Number(value) || 80)) })} />
          <Field label="Time limit (minutes, blank = none)" type="number" value={policy.timeLimitMinutes ?? ''} onChange={(value) => update({ timeLimitMinutes: value ? Math.max(1, Math.min(240, Number(value))) : null })} />
          <Field label="Due date" type="date" value={policy.dueDate ?? ''} onChange={(value) => update({ dueDate: value || null })} />
        </div>
      </div>
    </div>
  );
}

function PaperSettings({
  project,
  quiz,
  set,
  onChange,
}: {
  project: Project;
  quiz: QuizDraftInput;
  set: (patch: Partial<QuizDraftInput>) => void;
  onChange: (patch: Partial<Project>) => void;
}) {
  const [custom, setCustom] = useState({ questions: '20', choices: '4' });
  const [error, setError] = useState('');
  const template = resolveTemplate(quiz.templateId);
  const fit = template && quiz.questions.length ? templateFitIssue({ questions: quiz.questions }, template) : null;

  async function print(kind: 'paper' | 'sheet' | 'pack', formCode: string) {
    setError('');
    try {
      const built = buildQuizFromDraft({ ...quiz, version: project.version }, `teacher:${project.author.id}`, new Date().toISOString());
      if (!template) throw new Error('Choose an answer sheet.');
      if (kind === 'paper') {
        openPdf(await renderQuizPaperPdf(built, formCode, { sectionLabel: project.paper.sectionLabel }));
        return;
      }
      const students = kind === 'pack' ? rosterEntries(project.paper.roster) : undefined;
      if (kind === 'pack' && !students?.length) throw new Error('Paste your class list first.');
      openPdf(await renderAnswerSheetPdf(template, { quiz: built, formCode, sectionLabel: project.paper.sectionLabel, students }));
    } catch (caught) {
      setError(readableError(caught));
    }
  }

  return (
    <div className="card">
      <h2>3. Answer sheet and printing</h2>
      <div className="row">
        {STANDARD_TEMPLATE_OPTIONS.map((option) => (
          <Chip key={option.templateId} label={option.title} pressed={quiz.templateId === option.templateId} onClick={() => set({ templateId: option.templateId })} />
        ))}
      </div>
      <div className="grid-3">
        <Field label="Custom: questions" type="number" value={custom.questions} onChange={(questions) => setCustom({ ...custom, questions })} />
        <Field label="Custom: choices (2–5)" type="number" value={custom.choices} onChange={(choices) => setCustom({ ...custom, choices })} />
        <button
          type="button"
          className="button secondary"
          style={{ alignSelf: 'end' }}
          onClick={() => {
            try {
              set({ templateId: customTemplateId(Number(custom.questions), Number(custom.choices)) });
            } catch {
              setError('A custom sheet needs 1–100 questions and 2–5 choices.');
            }
          }}
        >
          Use custom sheet
        </button>
      </div>
      <p className="small">
        Sheet: <strong>{template?.title ?? quiz.templateId}</strong> · <span className="mono">{quiz.templateId}</span>
      </p>
      {fit ? <Callout tone="warning" title="Questions do not fit this sheet">{fit}</Callout> : null}
      <span className="small muted">Alternate versions (each has its own answer mapping)</span>
      <div className="row">
        {[0, 1, 2, 3].map((count) => (
          <Chip key={count} label={count === 0 ? 'Form A only' : `Forms A–${'ABCD'[count]}`} pressed={quiz.alternateForms === count} onClick={() => set({ alternateForms: count, forms: null })} />
        ))}
      </div>
      <Chip label={quiz.retainScanImages ? 'Keep scan photos for review' : 'Delete scan photos after grading'} pressed={quiz.retainScanImages} onClick={() => set({ retainScanImages: !quiz.retainScanImages })} />
      <Callout tone="info" title="Answer key">
        Mark correct answers above. To build the key from a correctly shaded master sheet, open this quiz in the PAVO Android app and choose Scan a completed master sheet.
      </Callout>
      <div className="grid-2">
        <Field label="Section label printed on sheets" value={project.paper.sectionLabel} onChange={(sectionLabel) => onChange({ paper: { ...project.paper, sectionLabel } })} />
        <Field
          label="Class list for class packs (one name per line, in class-number order)"
          multiline
          value={project.paper.roster}
          onChange={(roster) => onChange({ paper: { ...project.paper, roster } })}
        />
      </div>
      {error ? <Callout tone="error" title="Cannot print yet">{error}</Callout> : null}
      {['A', 'B', 'C', 'D'].slice(0, quiz.alternateForms + 1).map((form) => (
        <div key={form} className="row">
          <strong style={{ width: 64 }}>Form {form}</strong>
          <button type="button" className="button secondary small" onClick={() => void print('paper', form)}>Quiz paper PDF</button>
          <button type="button" className="button secondary small" onClick={() => void print('sheet', form)}>Answer sheet PDF</button>
          <button type="button" className="button secondary small" onClick={() => void print('pack', form)}>Class pack PDF</button>
        </div>
      ))}
    </div>
  );
}

function AiQuizDraft({ project, onChange }: { project: Project; onChange: (patch: Partial<Project>) => void }) {
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = project.aiDrafts.some((draft) => draft.artifact === 'quiz' && !draft.approved);
  if (!project.quiz) return null;
  const quiz = project.quiz;
  return (
    <div className={`card ${pending ? 'warning' : ''}`}>
      <div className="row between">
        <h2>AI question draft</h2>
        {pending ? <span className="pill ai">AI draft · review required</span> : null}
      </div>
      {pending ? (
        <>
          <Callout tone="warning" title="Check every AI question and answer key">
            AI drafts can be wrong. Confirm each correct answer before approving. Students never see the answer key.
          </Callout>
          <button
            type="button"
            className="button"
            onClick={() =>
              onChange({ aiDrafts: project.aiDrafts.map((draft) => (draft.artifact === 'quiz' && !draft.approved ? { ...draft, approved: true, approvedAt: new Date().toISOString() } : draft)) })
            }
          >
            I checked and approve these questions
          </button>
        </>
      ) : null}
      {backend.aiConfigured ? (
        <>
          <Field label="Approved source text to ground the questions" multiline value={source} onChange={setSource} />
          {error ? <Callout tone="error" title="AI unavailable">{error}</Callout> : null}
          <button
            type="button"
            className="button secondary"
            disabled={busy || source.trim().length < 40}
            onClick={() => {
              setBusy(true);
              setError('');
              void requestAiDraft({
                intent: 'teacher_author_quiz',
                gradeLevel: project.gradeLevel,
                subject: project.subject,
                instruction: `Draft ${quiz.mode === 'paper_omr' ? 'multiple-choice' : 'short'} questions for ${quiz.title}.`,
                source: { id: `source-${Date.now().toString(36)}`, title: quiz.title, text: source },
              })
                .then((draft) => {
                  const added = questionsFromAiDraft(draft.response, quiz.quizId, quiz.questions.at(-1)?.competency ?? project.competencies[0] ?? '');
                  onChange({
                    quiz: { ...quiz, questions: [...quiz.questions, ...added], forms: null },
                    aiDrafts: [...project.aiDrafts, { artifact: 'quiz', model: draft.model, generatedAt: draft.generatedAt, sourceIds: [quiz.title], approved: false, approvedAt: null, teacherEdited: false }],
                  });
                })
                .catch((caught: Error) => setError(caught.message))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? 'Drafting…' : 'Draft questions'}
          </button>
        </>
      ) : (
        <p className="small muted">AI drafting is off for this studio. Write questions directly, or import a question file.</p>
      )}
    </div>
  );
}

