import { useState } from 'react';
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

  return (
    <div className="stack">
      <div className="card">
        <h2>Ready to publish?</h2>
        <ul className="checklist" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {checklist.map((item) => (
            <li key={item.label}>
              <span aria-hidden="true" style={{ color: item.ok ? 'var(--success)' : 'var(--error)', fontWeight: 800 }}>
                {item.ok ? '✓' : '✗'}
              </span>
              <span>
                {item.label}
                {item.detail ? <span className="small muted"> — {item.detail}</span> : null}
              </span>
            </li>
          ))}
        </ul>
        {project.status === 'draft' ? (
          <button type="button" className="button" disabled={!ready} onClick={() => onChange({ status: 'published', publishedAt: Date.now() })}>
            Publish version {project.version}
          </button>
        ) : (
          <Callout tone="info" title={`Version ${project.version} is ${project.status}`}>
            It can no longer change. Start a new version to make edits.
          </Callout>
        )}
      </div>

      {project.status !== 'draft' ? (
        <div className="card accent">
          <h2>Export bundle</h2>
          <p className="small muted">
            One zip with module.pdf, adaptive-lesson.md, assessment-guide.md, manifest.json, the student package to send by Nearby, the teacher bundle with the answer key, and paper PDFs when the quiz is on paper.
          </p>
          <div className="row">
            <button type="button" className="button" disabled={busy} onClick={() => void exportNow()}>
              {busy ? 'Building…' : `Export version ${project.version}`}
            </button>
            <button type="button" className="button ghost" onClick={onNewVersion}>
              Start version {project.version + 1}
            </button>
          </div>
          {error ? <Callout tone="error" title="Export problem">{error}</Callout> : null}
          {bundle ? (
            <>
              <ul className="file-list">
                {Object.entries(bundle.files).map(([path, bytes]) => (
                  <li key={path}>
                    <span className="mono">{path}</span>
                    <span className="row">
                      <span className="small muted">{formatBytes(bytes.byteLength)}</span>
                      <button type="button" className="button ghost small" onClick={() => download(bytes, path.split('/').pop()!, MIME[path.split('.').pop() ?? ''] ?? 'application/octet-stream')}>
                        Download
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
              <Callout tone="success" title="Next on Android">
                Install the teacher bundle on your phone (Install a quiz or teacher bundle file), then send the student package to learners with Send nearby. No internet is needed in class.
              </Callout>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="card">
        <h2>Synchronization</h2>
        {!backend.supabaseConfigured ? (
          <p className="small muted">Optional Supabase sync is not configured. Exports stay on this computer.</p>
        ) : !session ? (
          <p className="small muted">Sign in to keep a copy of exports in your school storage.</p>
        ) : !online ? (
          <Callout tone="warning" title="Offline">Sync resumes when you reconnect. Your work is saved locally.</Callout>
        ) : (
          <button type="button" className="button secondary" disabled={!bundle || project.sync === 'syncing'} onClick={() => void sync()}>
            {project.sync === 'syncing' ? 'Synchronizing…' : project.sync === 'synced' ? 'Synced ✓ — sync again' : 'Upload this export'}
          </button>
        )}
      </div>
    </div>
  );
}
