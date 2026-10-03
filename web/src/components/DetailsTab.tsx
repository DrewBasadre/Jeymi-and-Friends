import { LICENSES } from '@pavo/domain/packageV2';
import type { Project } from '../project';
import { Chip, Field } from './common';

export function DetailsTab({ project, onChange }: { project: Project; onChange: (patch: Partial<Project>) => void }) {
  const locked = project.status !== 'draft';
  return (
    <div className="stack">
      <div className="card">
        <h2>Package</h2>
        <div className="grid-2">
          <Field label="Title" value={project.title} onChange={(title) => onChange({ title })} />
          <Field
            label="Package ID"
            value={project.id}
            onChange={(id) => (locked ? undefined : onChange({ id: id.trim() }))}
            hint={locked ? 'Fixed once published.' : 'Stays the same for every version of this package.'}
          />
          <Field label="Grade" type="number" value={project.gradeLevel} onChange={(value) => onChange({ gradeLevel: Math.max(1, Math.min(12, Number(value) || 1)) })} />
          <Field label="Subject" value={project.subject} onChange={(subject) => onChange({ subject })} />
        </div>
        <Field
          label="Competencies (comma separated, e.g. MATATAG codes)"
          value={project.competencies.join(', ')}
          onChange={(value) => onChange({ competencies: value.split(',').map((item) => item.trim()).filter(Boolean) })}
        />
        <p className="small muted">Version {project.version}. Published versions never change; edits after export start a new version.</p>
      </div>

      <div className="card">
        <h2>Attribution and license</h2>
        <div className="grid-2">
          <Field label="Authors (comma separated)" value={project.authors.join(', ')} onChange={(value) => onChange({ authors: value.split(',').map((item) => item.trim()).filter(Boolean) })} />
          <label className="field">
            License
            <select value={project.license} onChange={(event) => onChange({ license: event.target.value as Project['license'] })}>
              {LICENSES.map((license) => (
                <option key={license} value={license}>
                  {license}
                </option>
              ))}
            </select>
          </label>
          <Field label="Source URL (if adapted)" value={project.sourceUrl ?? ''} onChange={(value) => onChange({ sourceUrl: value.trim() || null })} />
          <Field label="Attribution notice" value={project.notice} onChange={(notice) => onChange({ notice })} />
        </div>
        <p className="small muted">Third-party material must keep its original attribution and license. Never label it as your own.</p>
      </div>

      <div className="card">
        <h2>Sharing</h2>
        <div className="row">
          <Chip label={project.studentToStudent ? 'Students may share with classmates' : 'Students may not re-share'} pressed={project.studentToStudent} onClick={() => onChange({ studentToStudent: !project.studentToStudent })} />
          <Chip label={project.teacherToTeacher ? 'Teachers may re-share' : 'Teachers may not re-share'} pressed={project.teacherToTeacher} onClick={() => onChange({ teacherToTeacher: !project.teacherToTeacher })} />
        </div>
        <p className="small muted">Answer keys always stay in the teacher bundle; student packages never include them.</p>
      </div>
    </div>
  );
}
