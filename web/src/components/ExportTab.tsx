import { useState } from 'react';
import { CircleCheck, CircleX, CloudUpload, Download, FileArchive, FileText, GitBranchPlus, Lock, PackageCheck, Printer, Send, Smartphone } from 'lucide-react';
import { buildExportBundle, type ExportBundle } from '@pavo/domain/exportBundle';
import { backend, uploadExport, type TeacherSession } from '../backend';
import { canPublish, exportInput, publishChecklist, readableError, type Project } from '../project';
import { Callout, download, formatBytes } from './common';

const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  md: 'text/markdown',
  json: 'application/json',
  'pavo-module': 'application/vnd.pavo.package+zip',
};

/** What each exported file is for, in the teacher's words. */
function describeFile(path: string): { label: string; audience: 'Students' | 'Teacher' | 'Print'; icon: typeof FileText } {
  if (path.endsWith('-teacher-v1.pavo-module') || /-teacher-v\d+\.pavo-module$/.test(path)) {
    return { label: 'Teacher bundle with answer key', audience: 'Teacher', icon: Lock };
  }
  if (path.endsWith('.pavo-module')) return { label: 'Student package for Nearby', audience: 'Students', icon: Smartphone };
  if (path.startsWith('paper/answer-sheet')) return { label: `Answer sheet, form ${path.at(-5)}`, audience: 'Print', icon: Printer };
  if (path.startsWith('paper/quiz-paper')) return { label: `Question paper, form ${path.at(-5)}`, audience: 'Print', icon: Printer };
  if (path === 'module.pdf') return { label: 'Printable lesson module', audience: 'Print', icon: Printer };
  if (path === 'assessment-guide.md') return { label: 'Answer key and remediation guide', audience: 'Teacher', icon: Lock };
  if (path === 'adaptive-lesson.md') return { label: 'Lesson source', audience: 'Teacher', icon: FileText };
  if (path === 'answer-sheet-template.json') return { label: 'Scanner template', audience: 'Teacher', icon: FileText };
  return { label: 'Package manifest', audience: 'Teacher', icon: FileText };
}

export function ExportTab({
  project,
  session,
  online,
  onChange,
  onNewVersion,
}: {
  project: Project;
  session: TeacherSession | null;
  online: boolean;
  onChange: (patch: Partial<Project>) => void;
  onNewVersion: () => void;
}) {
  const [bundle, setBundle] = useState<ExportBundle | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const checklist = publishChecklist(project);
  const ready = canPublish(project);
  const done = checklist.filter((item) => item.ok).length;

  async function exportNow() {
    setBusy(true);
    setError('');
    try {
      const built = await buildExportBundle(exportInput(project));
      setBundle(built);
      download(built.zip, built.fileName, 'application/zip');
      onChange({ status: 'exported', exportedAt: Date.now() });
    } catch (caught) {
      setError(readableError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function sync() {
    if (!bundle || !session) return;
    onChange({ sync: 'syncing' });
    try {
      await uploadExport(session, bundle.fileName, bundle.zip);
      onChange({ sync: 'synced' });
    } catch (caught) {
      setError(readableError(caught));
      onChange({ sync: 'error' });
    }
  }

  const files = bundle ? Object.entries(bundle.files).sort(([a], [b]) => describeFile(a).audience.localeCompare(describeFile(b).audience)) : [];

  return (
    <div className="stack gap-lg">
      <section className="card">
        <div className="row between">
          <h2>Ready to publish?</h2>
          <span className={`pill ${ready ? 'exported' : 'draft'}`}>
            {done} of {checklist.length} checks pass
          </span>
        </div>
        <div className="meter" aria-hidden="true">
          <span style={{ width: `${(done / checklist.length) * 100}%` }} />
        </div>
        <ul className="checklist">
          {checklist.map((item) => (
            <li key={item.label} className={item.ok ? 'ok' : 'fail'}>
              {item.ok ? <CircleCheck size={18} aria-label="Passes" /> : <CircleX size={18} aria-label="Needs work" />}
              <span>
                {item.label}
                {item.detail ? <span className="small muted"> — {item.detail}</span> : null}
              </span>
            </li>
          ))}
        </ul>
        {project.status === 'draft' ? (
          <div className="row">
            <button type="button" className="button" disabled={!ready} onClick={() => onChange({ status: 'published', publishedAt: Date.now() })}>
              <PackageCheck size={18} /> Publish version {project.version}
            </button>
            {!ready ? <span className="small muted">Fix the items marked above to publish.</span> : null}
          </div>
        ) : (
          <p className="small muted row">
            <Lock size={14} /> Version {project.version} is {project.status} and can no longer change.
          </p>
        )}
      </section>

      {project.status !== 'draft' ? (
        <section className="card">
          <div className="row between">
            <div className="stack tight">
              <h2>Export bundle</h2>
              <p className="small muted">One zip with everything this lesson needs: print files, the student package to send over Nearby, and the teacher bundle with the answer key.</p>
            </div>
          </div>
          <div className="row">
            <button type="button" className="button" disabled={busy} onClick={() => void exportNow()}>
              <FileArchive size={18} /> {busy ? 'Building bundle…' : `Export version ${project.version}`}
            </button>
            <button type="button" className="button ghost" onClick={onNewVersion}>
              <GitBranchPlus size={18} /> Start version {project.version + 1}
            </button>
          </div>
          {error ? <Callout tone="error" title="Export problem">{error}</Callout> : null}
          {bundle ? (
            <>
              <ul className="file-list">
                {files.map(([path, bytes]) => {
                  const info = describeFile(path);
                  const Icon = info.icon;
                  return (
                    <li key={path}>
                      <span className={`file-icon ${info.audience.toLowerCase()}`}>
                        <Icon size={16} />
                      </span>
                      <span className="file-name">
                        <strong>{info.label}</strong>
                        <code>{path}</code>
                      </span>
                      <span className="tag">{info.audience}</span>
                      <span className="small muted file-size">{formatBytes(bytes.byteLength)}</span>
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`Download ${path}`}
                        onClick={() => download(bytes, path.split('/').pop()!, MIME[path.split('.').pop() ?? ''] ?? 'application/octet-stream')}
                      >
                        <Download size={16} />
                      </button>
                    </li>
                  );
                })}
              </ul>
              <ol className="next-steps">
                <li>
                  <strong>Install the teacher bundle</strong> on your phone: Quizzes → Install a quiz or teacher bundle file.
                </li>
                <li>
                  <strong>Send the student package</strong> with <Send size={14} aria-hidden="true" /> Send nearby. No internet needed in class.
                </li>
                <li>
                  <strong>Collect results</strong> by scanning each learner's result QR, or by scanning paper answer sheets.
                </li>
              </ol>
            </>
          ) : null}
        </section>
      ) : null}

      <section className="card">
        <h2>Synchronization</h2>
        {!backend.supabaseConfigured ? (
          <p className="small muted">Optional school sync is not configured. Exports stay on this computer.</p>
        ) : !session ? (
          <p className="small muted">Sign in to keep a copy of exports in your school storage.</p>
        ) : !online ? (
          <Callout tone="warning" title="Offline">Sync resumes when you reconnect. Your work is saved locally.</Callout>
        ) : (
          <button type="button" className="button secondary" disabled={!bundle || project.sync === 'syncing'} onClick={() => void sync()}>
            <CloudUpload size={18} /> {project.sync === 'syncing' ? 'Synchronizing…' : project.sync === 'synced' ? 'Synced. Upload again' : 'Upload this export'}
          </button>
        )}
      </section>
    </div>
  );
}
