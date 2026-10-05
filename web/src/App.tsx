import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Eye,
  FileArchive,
  FilePlus2,
  FileText,
  FileUp,
  ListChecks,
  Lock,
  PackageCheck,
  PenLine,
  Settings2,
  Smartphone,
  Sparkles,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { backend, signIn, type TeacherSession } from './backend';
import { importFile } from './convert';
import { demoProjects, newProject, newQuizDraft, nextVersion, readableError, type Project } from './project';
import { projectStore } from './storage';
import { Callout, Field } from './components/common';
import { DetailsTab } from './components/DetailsTab';
import { ExportTab } from './components/ExportTab';
import { LessonEditor } from './components/LessonEditor';
import { PreviewTab } from './components/PreviewTab';
import { QuizEditor } from './components/QuizEditor';
import { Welcome } from './components/Welcome';

type Tab = 'details' | 'lesson' | 'assessment' | 'preview' | 'export';
const TABS: Array<{ id: Tab; label: string; icon: typeof Eye }> = [
  { id: 'details', label: 'Details', icon: Settings2 },
  { id: 'lesson', label: 'Lesson', icon: BookOpen },
  { id: 'assessment', label: 'Assessment', icon: ListChecks },
  { id: 'preview', label: 'Preview', icon: Eye },
  { id: 'export', label: 'Export', icon: FileArchive },
];
const LIFECYCLE_KEYS = new Set<keyof Project>(['status', 'sync', 'publishedAt', 'exportedAt']);

export function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
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
      setLoaded(true);
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

  function loadDemo() {
    const existing = new Set(projects.map((project) => project.id));
    const demos = demoProjects(author).filter((project) => !existing.has(project.id));
    setProjects((items) => [...demos, ...items]);
    setCurrentId(demos[0]?.id ?? currentId);
    setTab('preview');
    demos.forEach((project) => void projectStore.save(project));
    if (demos.length) setNotice({ tone: 'success', text: 'Three demo lessons are ready: one exported, one published, one still a draft.' });
  }

  if (mode === 'choose') {
    return <SignIn onDemo={() => setMode('demo')} onSignedIn={(value) => { setSession(value); setMode('signed-in'); }} />;
  }

  const hasDemo = projects.some((project) => project.id.startsWith('demo-'));
  const topbar = (
    <header className="topbar">
      <span className="brand">
        <PavoMark /> PAVO <small>Teacher Studio</small>
      </span>
      <span className="spacer" />
      <span className={`pill ${online ? 'online' : 'offline'}`}>
        {online ? <Wifi size={14} /> : <WifiOff size={14} />} {online ? 'Online' : 'Offline · drafts save locally'}
      </span>
      <span className="pill online identity">{session ? session.email : 'Demo mode · nothing leaves this browser'}</span>
    </header>
  );

  if (loaded && projects.length === 0) {
    return (
      <div className="shell welcome-shell">
        {topbar}
        <Welcome onDemo={loadDemo} onBlank={create} onImport={(file) => void handleImport(file)} />
      </div>
    );
  }

  return (
    <div className="shell">
      {topbar}

      <nav className="sidebar" aria-label="Projects">
        <button type="button" className="button" onClick={create}>
          <FilePlus2 size={18} /> New lesson or quiz
        </button>
        <label className="button secondary">
          <FileUp size={18} /> Import a file
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
        <h2 className="sidebar-heading">Your packages</h2>
        <ul className="project-list">
          {projects.map((project) => {
            const Icon = projectIcon(project);
            return (
              <li key={project.id}>
                <button type="button" className="project-item" aria-current={project.id === currentId} onClick={() => setCurrentId(project.id)}>
                  <span className={`project-icon ${subjectClass(project.subject)}`}>
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <span className="project-text">
                    <strong>{project.title || 'Untitled'}</strong>
                    <span className="meta">
                      {project.subject} · v{project.version}
                      {project.sync === 'synced' ? ' · synced' : project.sync === 'syncing' ? ' · syncing' : ''}
                    </span>
                  </span>
                  <span className={`dot ${project.status}`} title={project.status} aria-label={project.status} />
                </button>
              </li>
            );
          })}
        </ul>
        {!hasDemo ? (
          <button type="button" className="button ghost small sidebar-demo" onClick={loadDemo}>
            <Sparkles size={16} /> Add the demo library
          </button>
        ) : null}
      </nav>

      <main className="main">
        {notice ? (
          <div className={`toast ${notice.tone}`} role="status">
            <span>{notice.text}</span>
            <button type="button" className="icon-button" aria-label="Dismiss" onClick={() => setNotice(null)}>
              <X size={16} />
            </button>
          </div>
        ) : null}
        {!current ? (
          <div className="card empty">
            <h2>Pick a package</h2>
            <p>Choose one on the left, or start a new lesson.</p>
          </div>
        ) : (
          <>
            <div className="page-head">
              <div className="stack tight">
                <h1 className="title">{current.title || 'Untitled'}</h1>
                <div className="facts">
                  <span className={`pill ${current.status}`}>
                    {current.status === 'draft' ? <PenLine size={13} /> : current.status === 'published' ? <PackageCheck size={13} /> : <Lock size={13} />}
                    {STATUS_LABEL[current.status]}
                  </span>
                  <span>Version {current.version}</span>
                  <span>Grade {current.gradeLevel} {current.subject}</span>
                  {current.lesson ? <span>{current.lesson.blocks.length}-step lesson · {current.lesson.estimatedMinutes} min</span> : null}
                  {current.quiz?.mode ? (
                    <span>
                      {current.quiz.mode === 'paper_omr' ? 'Paper quiz' : 'Digital mini-quiz'} · {current.quiz.questions.length} questions
                    </span>
                  ) : null}
                </div>
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
                <Trash2 size={16} /> Delete
              </button>
            </div>
            {current.status !== 'draft' ? (
              <Callout tone="info" title="This version is locked">
                Published versions never change, so learners and result QRs always match. Start a new version from Export to edit.
              </Callout>
            ) : null}
            <div className="tabs" role="tablist">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" role="tab" className="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
                  <Icon size={16} aria-hidden="true" /> {label}
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

const STATUS_LABEL: Record<Project['status'], string> = { draft: 'Draft', published: 'Published', exported: 'Exported' };

function projectIcon(project: Project) {
  if (project.quiz?.mode === 'paper_omr') return FileText;
  if (project.quiz?.mode === 'digital_mini_quiz') return Smartphone;
  return BookOpen;
}

function subjectClass(subject: string): string {
  const key = subject.toLowerCase();
  if (key.startsWith('math')) return 'math';
  if (key.startsWith('english') || key.startsWith('filipino')) return 'english';
  if (key.startsWith('science')) return 'science';
  return 'other';
}

/** Peacock-eye mark: the brand's gold eye on a teal plume. */
function PavoMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <ellipse cx="12" cy="12" rx="9" ry="11" fill="#0f766e" />
      <ellipse cx="12" cy="11" rx="5.5" ry="7" fill="#0e6b93" />
      <circle cx="12" cy="10" r="3.4" fill="#e0a11b" />
      <circle cx="12" cy="10" r="1.4" fill="#0b3a38" />
    </svg>
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
        <span className="brand on-light"><PavoMark /> PAVO Teacher Studio</span>
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
