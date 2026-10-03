import { useCallback, useEffect, useRef, useState } from 'react';
import { backend, signIn, type TeacherSession } from './backend';
import { importFile } from './convert';
import { newProject, newQuizDraft, nextVersion, readableError, type Project } from './project';
import { projectStore } from './storage';
import { Callout, Field } from './components/common';
import { DetailsTab } from './components/DetailsTab';
import { ExportTab } from './components/ExportTab';
import { LessonEditor } from './components/LessonEditor';
import { PreviewTab } from './components/PreviewTab';
import { QuizEditor } from './components/QuizEditor';

type Tab = 'details' | 'lesson' | 'assessment' | 'preview' | 'export';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'details', label: 'Details' },
  { id: 'lesson', label: 'Lesson' },
  { id: 'assessment', label: 'Assessment' },
  { id: 'preview', label: 'Preview' },
  { id: 'export', label: 'Export' },
];
const LIFECYCLE_KEYS = new Set<keyof Project>(['status', 'sync', 'publishedAt', 'exportedAt']);

export function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('details');
  const [online, setOnline] = useState(navigator.onLine);
  const [session, setSession] = useState<TeacherSession | null>(null);
  const [mode, setMode] = useState<'choose' | 'demo' | 'signed-in'>(backend.supabaseConfigured ? 'choose' : 'demo');
  const [notice, setNotice] = useState<{ tone: 'info' | 'error' | 'success' | 'warning'; text: string } | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    void projectStore.list().then((items) => {
      const sorted = items.sort((a, b) => b.updatedAt - a.updatedAt);
      setProjects(sorted);
      setCurrentId(sorted[0]?.id ?? null);
    });
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const author = session ? { id: session.userId, name: session.email.split('@')[0] ?? 'Teacher' } : { id: 'demo-teacher', name: 'Demo Teacher' };
  const current = projects.find((project) => project.id === currentId) ?? null;

  const persist = useCallback((project: Project) => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void projectStore.save(project), 300);
  }, []);

  const update = useCallback(
    (patch: Partial<Project>) => {
      if (!current) return;
      const locked = current.status !== 'draft';
      const keys = Object.keys(patch) as Array<keyof Project>;
      if (locked && keys.some((key) => !LIFECYCLE_KEYS.has(key))) {
        setNotice({ tone: 'warning', text: `Version ${current.version} is ${current.status} and cannot change. Start a new version from the Export tab.` });
        return;
      }
      const renamed = patch.id && patch.id !== current.id;
      const next: Project = { ...current, ...patch, updatedAt: Date.now() };
      if (patch.title !== undefined && next.lesson) next.lesson = { ...next.lesson, title: patch.title };
      setProjects((items) => items.map((item) => (item.id === current.id ? next : item)));
      if (renamed) {
        void projectStore.remove(current.id);
        setCurrentId(next.id);
      }
      persist(next);
    },
    [current, persist],
  );

  function create() {
    const project = newProject(author);
    setProjects((items) => [project, ...items]);
    setCurrentId(project.id);
    setTab('details');
    void projectStore.save(project);
  }

  async function handleImport(file: File) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const base = current && current.status === 'draft' ? current : newProject(author);
      const result = importFile(file.name, bytes, base);
      let next: Project = { ...base, updatedAt: Date.now() };
      if (result.kind === 'lesson') next = { ...next, lesson: result.lesson };
      if (result.kind === 'quiz') next = { ...next, quiz: result.quiz };
      if (result.kind === 'questions') next = { ...next, quiz: { ...(next.quiz ?? newQuizDraft(next)), questions: [...(next.quiz?.questions ?? []), ...result.questions] } };
      if (result.kind === 'project') {
        next = { ...newProject(author), id: result.packageId, version: result.version, title: result.title, lesson: result.lesson, images: result.images, quiz: result.quiz };
      }
      setProjects((items) => [next, ...items.filter((item) => item.id !== next.id)]);
      setCurrentId(next.id);
      void projectStore.save(next);
      setNotice({ tone: 'success', text: result.message });
    } catch (error) {
      setNotice({ tone: 'error', text: readableError(error) });
    }
  }

  if (mode === 'choose') {
    return <SignIn onDemo={() => setMode('demo')} onSignedIn={(value) => { setSession(value); setMode('signed-in'); }} />;
  }

  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">
          PAVO <small>Teacher Studio</small>
        </span>
        <span className="spacer" />
        <span className={`pill ${online ? 'online' : 'offline'}`}>{online ? 'Online' : 'Offline — drafts save locally'}</span>
        <span className="pill online">{session ? session.email : 'Demo mode · nothing leaves this browser'}</span>
      </header>

      <nav className="sidebar" aria-label="Projects">
        <button type="button" className="button" onClick={create}>
          New lesson or quiz
        </button>
        <label className="button secondary">
          Import a file
          <input
            className="visually-hidden"
            type="file"
            accept=".md,.markdown,.txt,.json,.pavo-module"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleImport(file);
              event.target.value = '';
            }}
          />
        </label>
        <p className="small muted">Imports: Markdown or text lessons, quiz JSON, and PAVO teacher bundles.</p>
        <ul className="project-list">
          {projects.map((project) => (
            <li key={project.id}>
              <button type="button" className="project-item" aria-current={project.id === currentId} onClick={() => setCurrentId(project.id)}>
                <strong>{project.title || 'Untitled'}</strong>
                <span className="meta">
                  v{project.version} · <span className={`pill ${project.status}`}>{project.status}</span>
                  {project.sync === 'synced' ? ' · synced' : project.sync === 'syncing' ? ' · syncing' : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <main className="main">
        {notice ? (
          <div role="status">
            <Callout tone={notice.tone} title={notice.tone === 'error' ? 'Could not import' : 'Done'}>
              {notice.text}
            </Callout>
            <button type="button" className="button ghost small" onClick={() => setNotice(null)}>
              Dismiss
            </button>
          </div>
        ) : null}
        {!current ? (
          <div className="card empty">
            <h2>Create your first package</h2>
            <p>Write a lesson, a paper quiz, a digital mini-quiz, or all three, then export a package your PAVO Android app can install offline.</p>
            <button type="button" className="button" onClick={create}>
              New lesson or quiz
            </button>
          </div>
        ) : (
          <>
            <div className="row between">
              <div>
                <span className="overline">
                  {current.status === 'draft' ? 'Draft' : current.status === 'published' ? 'Published' : 'Exported'} · version {current.version}
                </span>
                <h1 className="title">{current.title || 'Untitled'}</h1>
              </div>
              <button
                type="button"
                className="button danger small"
                onClick={() => {
                  if (!window.confirm(`Delete the local draft “${current.title}”? Exported files you downloaded are not affected.`)) return;
                  void projectStore.remove(current.id);
                  setProjects((items) => items.filter((item) => item.id !== current.id));
                  setCurrentId(null);
                }}
              >
                Delete draft
              </button>
            </div>
            {current.status !== 'draft' ? (
              <Callout tone="info" title="This version is locked">
                Published versions never change, so learners and result QRs always match. Start a new version from Export to edit.
              </Callout>
            ) : null}
            <div className="tabs" role="tablist">
              {TABS.map((item) => (
                <button key={item.id} type="button" role="tab" className="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}>
                  {item.label}
                </button>
              ))}
            </div>
            {tab === 'details' ? <DetailsTab project={current} onChange={update} /> : null}
            {tab === 'lesson' ? <LessonEditor project={current} onChange={update} /> : null}
            {tab === 'assessment' ? <QuizEditor project={current} onChange={update} /> : null}
            {tab === 'preview' ? <PreviewTab project={current} /> : null}
            {tab === 'export' ? (
              <ExportTab
                project={current}
                session={session}
                online={online}
                onChange={update}
                onNewVersion={() => {
                  const next = nextVersion(current);
                  setProjects((items) => items.map((item) => (item.id === current.id ? next : item)));
                  void projectStore.save(next);
                  setTab('details');
                }}
              />
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}

function SignIn({ onDemo, onSignedIn }: { onDemo: () => void; onSignedIn: (session: TeacherSession) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <main className="main" style={{ margin: '48px auto', maxWidth: 440 }}>
      <div className="card">
        <span className="overline">PAVO Teacher Studio</span>
        <h1 className="title">Sign in</h1>
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            setBusy(true);
            setError('');
            void signIn(email, password)
              .then(onSignedIn)
              .catch((caught: Error) => setError(caught.message))
              .finally(() => setBusy(false));
          }}
        >
          <Field label="School email" type="email" value={email} onChange={setEmail} />
          <Field label="Password" type="password" value={password} onChange={setPassword} />
          {error ? <Callout tone="error" title="Sign-in failed">{error}</Callout> : null}
          <button type="submit" className="button" disabled={busy || !email || !password}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <button type="button" className="button ghost" onClick={onDemo}>
          Continue in demo mode
        </button>
        <p className="small muted">Demo mode keeps everything in this browser. Nothing is uploaded.</p>
      </div>
    </main>
  );
}
