import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { useState } from 'react';
import { LESSON_BLOCK_LABELS, LESSON_BLOCK_TYPES, type LessonBlock, type LessonBlockType } from '@pavo/domain/adaptiveLesson';
import { backend, requestAiDraft } from '../backend';
import { lessonFromAiDraft } from '../convert';
import type { Project } from '../project';
import { Callout, Chip, Field, imageUrl } from './common';

const PLACEHOLDER: Partial<Record<LessonBlockType, string>> = {
  objective: 'Learners will be able to …',
  concept: 'Explain the idea in short paragraphs. Markdown works: **bold**, lists, ![alt](images/photo.png).',
  'worked-example': 'Show one problem solved step by step.',
  'read-aloud': 'A short passage the device reads aloud.',
  'guided-practice': 'A task learners try with support.',
  practice: 'A task learners do on their own.',
  reflection: 'A question to think about.',
  remediation: 'Another way to explain the idea for learners who missed it.',
  extension: 'A challenge for learners who are ready for more.',
};

export function LessonEditor({ project, onChange }: { project: Project; onChange: (patch: Partial<Project>) => void }) {
  const [adding, setAdding] = useState<LessonBlockType>('concept');
  const lesson = project.lesson;
  if (!lesson) {
    return (
      <div className="card empty">
        <p>This package has no lesson. Assessments can stand alone, or you can add a lesson.</p>
        <button
          type="button"
          className="button"
          onClick={() =>
            onChange({
              lesson: {
                lessonId: project.id,
                title: project.title,
                gradeLevel: project.gradeLevel,
                subject: project.subject,
                competencies: project.competencies,
                estimatedMinutes: 20,
                language: 'en',
                blocks: [
                  { type: 'objective', id: 'objective-1', concept: null, markdown: '' },
                  { type: 'concept', id: 'concept-1', concept: null, markdown: '' },
                  { type: 'checkpoint', id: 'checkpoint-1', concept: null, markdown: '', items: ['I can …'] },
                ],
              },
            })
          }
        >
          Add a lesson
        </button>
      </div>
    );
  }

  const setBlocks = (blocks: LessonBlock[]) => onChange({ lesson: { ...lesson, blocks }, aiDrafts: markEdited(project, 'lesson') });
  const update = (index: number, patch: Partial<LessonBlock>) => setBlocks(lesson.blocks.map((block, position) => (position === index ? { ...block, ...patch } : block)));
  const move = (index: number, delta: number) => {
    const next = [...lesson.blocks];
    const [block] = next.splice(index, 1);
    next.splice(index + delta, 0, block!);
    setBlocks(next);
  };
  const add = () => {
    const id = `${adding}-${Date.now().toString(36)}`;
    const block: LessonBlock =
      adding === 'hints'
        ? { type: adding, id, concept: null, markdown: '', hints: ['', ''] }
        : adding === 'check'
          ? { type: adding, id, concept: null, markdown: '', check: { prompt: '', choices: [{ text: '', correct: true }, { text: '', correct: false }], answer: null, explanation: '' } }
          : adding === 'checkpoint'
            ? { type: adding, id, concept: null, markdown: '', items: ['I can …'] }
            : adding === 'visual'
              ? { type: adding, id, concept: null, markdown: '', image: { path: Object.keys(project.images)[0] ?? 'images/', alt: '', caption: '' } }
              : { type: adding, id, concept: null, markdown: '' };
    setBlocks([...lesson.blocks, block]);
  };

  async function addImage(file: File) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Use PNG, JPEG, or WebP images.');
    if (file.size > 8 * 1024 * 1024) throw new Error('Images must be 8 MB or smaller.');
    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const base = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'image';
    const path = `images/${base}-${Date.now().toString(36)}.${extension}`;
    onChange({ images: { ...project.images, [path]: { mimeType: file.type, bytes: new Uint8Array(await file.arrayBuffer()) } } });
    return path;
  }

  return (
    <div className="stack">
      <AiLessonDraft project={project} onChange={onChange} />
      <div className="card">
        <div className="row between">
          <h2>Images</h2>
          <label className="button secondary small">
            Add image
            <input
              className="visually-hidden"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void addImage(file).catch((error: Error) => alert(error.message));
                event.target.value = '';
              }}
            />
          </label>
        </div>
        {Object.keys(project.images).length ? (
          <div className="row">
            {Object.entries(project.images).map(([path, image]) => (
              <figure key={path} className="stack" style={{ margin: 0, width: 140 }}>
                <img src={imageUrl(path, image)} alt="" style={{ height: 90, objectFit: 'cover', borderRadius: 8 }} />
                <figcaption className="mono">{path}</figcaption>
                <button
                  type="button"
                  className="button ghost small"
                  onClick={() => {
                    const next = { ...project.images };
                    delete next[path];
                    onChange({ images: next });
                  }}
                >
                  Remove
                </button>
              </figure>
            ))}
          </div>
        ) : (
          <p className="muted small">Add photos or diagrams, then use them in a Visual block or as ![description](path) in Markdown.</p>
        )}
      </div>

      {lesson.blocks.map((block, index) => (
        <div key={block.id} className="card block-card">
          <div className="row between">
            <span className="block-label">
              {index + 1}. {LESSON_BLOCK_LABELS[block.type]}
            </span>
            <div className="row">
              <button type="button" className="icon-button" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={16} /></button>
              <button type="button" className="icon-button" aria-label="Move down" disabled={index === lesson.blocks.length - 1} onClick={() => move(index, 1)}><ArrowDown size={16} /></button>
              <button type="button" className="icon-button" aria-label="Remove block" onClick={() => setBlocks(lesson.blocks.filter((_, position) => position !== index))}><X size={16} /></button>
            </div>
          </div>
          {block.type !== 'objective' && block.type !== 'checkpoint' ? (
            <Field
              label={block.type === 'remediation' ? 'Remediates concept' : 'Concept tag (links checks to remediation)'}
              value={block.concept ?? ''}
              placeholder="photosynthesis"
              onChange={(value) => update(index, { concept: value.trim() || null })}
            />
          ) : null}
          <BlockBody block={block} project={project} onChange={(patch) => update(index, patch)} />
        </div>
      ))}

      <div className="card">
        <h3>Add a block</h3>
        <div className="row">
          {LESSON_BLOCK_TYPES.map((type) => (
            <Chip key={type} label={LESSON_BLOCK_LABELS[type]} pressed={adding === type} onClick={() => setAdding(type)} />
          ))}
        </div>
        <button type="button" className="button" onClick={add}>
          Add {LESSON_BLOCK_LABELS[adding]}
        </button>
      </div>
    </div>
  );
}

function BlockBody({ block, project, onChange }: { block: LessonBlock; project: Project; onChange: (patch: Partial<LessonBlock>) => void }) {
  if (block.type === 'visual' && block.image) {
    const image = block.image;
    return (
      <div className="grid-2">
        <label className="field">
          Image
          <select value={image.path} onChange={(event) => onChange({ image: { ...image, path: event.target.value } })}>
            <option value="">Choose an image</option>
            {Object.keys(project.images).map((path) => (
              <option key={path} value={path}>
                {path}
              </option>
            ))}
          </select>
        </label>
        <Field label="Alt text (required)" value={image.alt} onChange={(alt) => onChange({ image: { ...image, alt } })} />
        <Field label="Caption" value={image.caption} onChange={(caption) => onChange({ image: { ...image, caption } })} />
      </div>
    );
  }
  if (block.hints) {
    return (
      <div className="stack">
        {block.hints.map((hint, index) => (
          <Field key={index} label={`Hint ${index + 1}`} value={hint} onChange={(value) => onChange({ hints: block.hints!.map((item, position) => (position === index ? value : item)) })} />
        ))}
        <button type="button" className="button ghost small" onClick={() => onChange({ hints: [...block.hints!, ''] })}>
          Add a hint
        </button>
      </div>
    );
  }
  if (block.check) {
    const check = block.check;
    return (
      <div className="stack">
        <Field label="Question" value={check.prompt} onChange={(prompt) => onChange({ check: { ...check, prompt } })} />
        {check.choices.map((choice, index) => (
          <div key={index} className="choice-row">
            <button
              type="button"
              className="key-dot"
              aria-pressed={choice.correct}
              aria-label={`Mark choice ${index + 1} correct`}
              onClick={() => onChange({ check: { ...check, choices: check.choices.map((item, position) => ({ ...item, correct: position === index })) } })}
            >
              {String.fromCharCode(65 + index)}
            </button>
            <input
              type="text"
              value={choice.text}
              aria-label={`Choice ${index + 1}`}
              onChange={(event) => onChange({ check: { ...check, choices: check.choices.map((item, position) => (position === index ? { ...item, text: event.target.value } : item)) } })}
            />
            <button type="button" className="icon-button" aria-label="Remove choice" onClick={() => onChange({ check: { ...check, choices: check.choices.filter((_, position) => position !== index) } })}>
              <X size={16} />
            </button>
          </div>
        ))}
        <div className="row">
          <button type="button" className="button ghost small" onClick={() => onChange({ check: { ...check, choices: [...check.choices, { text: '', correct: false }] } })}>
            Add a choice
          </button>
          {!check.choices.length ? (
            <Field label="Short answer" value={check.answer ?? ''} onChange={(answer) => onChange({ check: { ...check, answer: answer || null } })} />
          ) : null}
        </div>
        <Field label="Explanation shown after a correct answer" value={check.explanation} onChange={(explanation) => onChange({ check: { ...check, explanation } })} />
        <p className="small muted">Knowledge checks are practice inside the lesson; they are never recorded as quiz scores.</p>
      </div>
    );
  }
  if (block.items) {
    return (
      <Field
        label="“I can …” statements (one per line)"
        multiline
        value={block.items.join('\n')}
        onChange={(value) => onChange({ items: value.split('\n') })}
      />
    );
  }
  return <Field label="Content (Markdown)" multiline value={block.markdown} placeholder={PLACEHOLDER[block.type]} onChange={(markdown) => onChange({ markdown })} />;
}

function AiLessonDraft({ project, onChange }: { project: Project; onChange: (patch: Partial<Project>) => void }) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState('');
  const [sourceTitle, setSourceTitle] = useState('');
  const [instruction, setInstruction] = useState('Draft a short lesson with one worked example and two knowledge checks.');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = project.aiDrafts.filter((draft) => draft.artifact === 'lesson' && !draft.approved);

  return (
    <div className={`card ${pending.length ? 'warning' : ''}`}>
      <div className="row between">
        <h2>AI drafting</h2>
        {pending.length ? <span className="pill ai">AI draft · review required</span> : null}
      </div>
      {pending.length ? (
        <>
          <Callout tone="warning" title="Review this AI draft before publishing">
            Check every fact against your source and edit freely. The package cannot be exported until you approve it. Your edits are recorded in the package provenance.
          </Callout>
          <button
            type="button"
            className="button"
            onClick={() =>
              onChange({
                aiDrafts: project.aiDrafts.map((draft) =>
                  draft.artifact === 'lesson' && !draft.approved ? { ...draft, approved: true, approvedAt: new Date().toISOString() } : draft,
                ),
              })
            }
          >
            I reviewed and approve this lesson draft
          </button>
        </>
      ) : null}
      {!backend.aiConfigured ? (
        <p className="small muted">AI drafting is off for this studio (no server configured). Everything else works without it.</p>
      ) : !open ? (
        <button type="button" className="button secondary" onClick={() => setOpen(true)}>
          Draft from a source with AI
        </button>
      ) : (
        <div className="stack">
          <p className="small muted">
            Paste an approved, licensed source. The AI only drafts from it; it does not add citations or curriculum claims, and it never sees learner data.
          </p>
          <Field label="Source title" value={sourceTitle} onChange={setSourceTitle} />
          <Field label="Source text" multiline value={source} onChange={setSource} />
          <Field label="What should the draft include?" value={instruction} onChange={setInstruction} />
          {error ? <Callout tone="error" title="AI unavailable">{error}</Callout> : null}
          <div className="row">
            <button
              type="button"
              className="button"
              disabled={busy || source.trim().length < 40}
              onClick={() => {
                setBusy(true);
                setError('');
                void requestAiDraft({
                  intent: 'teacher_author_module',
                  gradeLevel: project.gradeLevel,
                  subject: project.subject,
                  instruction,
                  source: { id: `source-${Date.now().toString(36)}`, title: sourceTitle || project.title, text: source },
                })
                  .then((draft) => {
                    onChange({
                      lesson: lessonFromAiDraft(draft.response, project),
                      aiDrafts: [
                        ...project.aiDrafts,
                        { artifact: 'lesson', model: draft.model, generatedAt: draft.generatedAt, sourceIds: [sourceTitle || 'teacher-source'], approved: false, approvedAt: null, teacherEdited: false },
                      ],
                    });
                    setOpen(false);
                  })
                  .catch((caught: Error) => setError(caught.message))
                  .finally(() => setBusy(false));
              }}
            >
              {busy ? 'Drafting…' : 'Create editable draft'}
            </button>
            <button type="button" className="button ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function markEdited(project: Project, artifact: 'lesson' | 'quiz'): Project['aiDrafts'] {
  return project.aiDrafts.map((draft) => (draft.artifact === artifact ? { ...draft, teacherEdited: true } : draft));
}

export { markEdited };
