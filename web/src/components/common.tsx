import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { useMemo, type ReactNode } from 'react';

export function Field({
  label,
  value,
  onChange,
  type = 'text',
  multiline,
  placeholder,
  hint,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: 'text' | 'number' | 'date' | 'email' | 'password';
  multiline?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="field">
      {label}
      {multiline ? (
        <textarea value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      )}
      {hint ? <span className="small muted">{hint}</span> : null}
    </label>
  );
}

export function Chip({ label, pressed, onClick }: { label: string; pressed?: boolean; onClick: () => void }) {
  return (
    <button type="button" className="chip" aria-pressed={Boolean(pressed)} onClick={onClick}>
      {label}
    </button>
  );
}

export function Callout({ tone, title, children }: { tone: 'info' | 'warning' | 'error' | 'success'; title: string; children?: ReactNode }) {
  return (
    <div className={`callout ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <strong>{title}</strong>
      {children ? <p>{children}</p> : null}
    </div>
  );
}

/** Teacher and AI Markdown, rendered safely: scripts and event handlers are stripped. */
export function Markdown({ source, images }: { source: string; images?: Record<string, { mimeType: string; bytes: Uint8Array }> }) {
  const html = useMemo(() => {
    const raw = marked.parse(source, { async: false }) as string;
    const clean = DOMPurify.sanitize(raw);
    if (!images) return clean;
    return clean.replace(/src="([^"]+)"/g, (match, path: string) => {
      const image = images[path];
      return image ? `src="${imageUrl(path, image)}"` : match;
    });
  }, [images, source]);
  return <div className="markdown" dangerouslySetInnerHTML={{ __html: html }} />;
}

const urlCache = new Map<string, string>();
export function imageUrl(path: string, image: { mimeType: string; bytes: Uint8Array }): string {
  const key = `${path}:${image.bytes.byteLength}`;
  if (!urlCache.has(key)) {
    urlCache.set(key, URL.createObjectURL(new Blob([image.bytes as BlobPart], { type: image.mimeType })));
  }
  return urlCache.get(key)!;
}

export function download(bytes: Uint8Array, fileName: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function openPdf(bytes: Uint8Array): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function formatBytes(value: number): string {
  if (value < 1_024) return `${value} B`;
  if (value < 1_048_576) return `${(value / 1_024).toFixed(1)} KB`;
  return `${(value / 1_048_576).toFixed(1)} MB`;
}
