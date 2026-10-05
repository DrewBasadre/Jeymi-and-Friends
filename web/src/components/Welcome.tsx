import { BookOpen, FilePlus2, FileUp, PenLine, QrCode, Radio, Sparkles, WifiOff } from 'lucide-react';

const JOURNEY = [
  { icon: PenLine, title: 'Write it here', body: 'A lesson, a paper quiz, a digital mini-quiz, or all three.' },
  { icon: BookOpen, title: 'Export once', body: 'Print files, a student package, and a teacher bundle with the key.' },
  { icon: Radio, title: 'Send phone to phone', body: 'Nearby transfer in class. No data plan, no Wi-Fi router.' },
  { icon: QrCode, title: 'Results come back', body: 'One QR per learner, or a scanned bubble sheet. Graded offline.' },
];

export function Welcome({ onDemo, onBlank, onImport }: { onDemo: () => void; onBlank: () => void; onImport: (file: File) => void }) {
  return (
    <section className="welcome" aria-labelledby="welcome-title">
      <div className="welcome-copy">
        <h1 id="welcome-title">Lessons that keep working where the signal stops.</h1>
        <p>
          PAVO Teacher Studio turns your lesson and quiz into one package that travels from your laptop to every learner's phone,
          and brings their results back, without the internet.
        </p>
        <div className="welcome-actions">
          <button type="button" className="button on-dark" onClick={onDemo}>
            <Sparkles size={18} /> Explore the demo library
          </button>
          <button type="button" className="button ghost-on-dark" onClick={onBlank}>
            <FilePlus2 size={18} /> Start a blank lesson
          </button>
          <label className="button ghost-on-dark">
            <FileUp size={18} /> Import a file
            <input
              className="visually-hidden"
              type="file"
              accept=".md,.markdown,.txt,.json,.pavo-module"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onImport(file);
                event.target.value = '';
              }}
            />
          </label>
        </div>
        <p className="welcome-note">
          <WifiOff size={14} aria-hidden="true" /> The demo library holds three Grade 5 lessons. Everything stays in this browser.
        </p>
      </div>

      <ol className="journey" aria-label="How a PAVO lesson travels">
        {JOURNEY.map(({ icon: Icon, title, body }) => (
          <li key={title}>
            <span className="journey-icon">
              <Icon size={20} aria-hidden="true" />
            </span>
            <strong>{title}</strong>
            <span>{body}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
