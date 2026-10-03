import { describe, expect, it } from '@jest/globals';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import QRCode from 'qrcode';
import {
  analysisIssues,
  classifyBubbles,
  encodeSheetCode,
  omrAnalysisSchema,
  parseSheetCode,
  readClassId,
  sheetMismatch,
  standardTemplate,
} from '../src/domain/omr';
import { FIXTURE_QUIZ, OMR_FIXTURE_CASES, OMR_FIXTURE_VERSION, type OmrFixtureCase } from './fixtures/omrCases';

const ROOT = join(__dirname, '..', 'omr-fixtures', `v${OMR_FIXTURE_VERSION}`);
const UPDATE = process.env.UPDATE_OMR_FIXTURES === '1';

function sheetCodeText(fixture: OmrFixtureCase): string {
  return encodeSheetCode({
    templateId: fixture.sheetCode.templateId ?? fixture.templateId,
    layoutVersion: 1,
    quizId: FIXTURE_QUIZ.quizId,
    quizVersion: fixture.sheetCode.quizVersion ?? FIXTURE_QUIZ.quizVersion,
    formCode: FIXTURE_QUIZ.formCode,
    studentId: fixture.sheetCode.studentId ?? null,
  });
}

function specFiles(): Record<string, string> {
  const files: Record<string, string> = {};
  for (const templateId of [...new Set(OMR_FIXTURE_CASES.map((fixture) => fixture.templateId))]) {
    files[`templates/${templateId}.json`] = `${JSON.stringify(standardTemplate(templateId), null, 2)}\n`;
  }
  const cases = OMR_FIXTURE_CASES.map((fixture) => {
    const text = sheetCodeText(fixture);
    const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
    const modules = Array.from({ length: qr.modules.size }, (_, row) =>
      Array.from({ length: qr.modules.size }, (_, column) => (qr.modules.get(row, column) ? '1' : '0')).join(''),
    );
    return { ...fixture, sheetCodeText: text, qrModules: modules };
  });
  files['fixtures.json'] = `${JSON.stringify({ version: OMR_FIXTURE_VERSION, cases }, null, 2)}\n`;
  return files;
}

describe('OMR fixture specification', () => {
  it('matches the committed templates and cases (shared by web, mobile, and the native engine)', () => {
    for (const [path, content] of Object.entries(specFiles())) {
      const target = join(ROOT, path);
      if (UPDATE) {
        mkdirSync(join(target, '..'), { recursive: true });
        writeFileSync(target, content);
      }
      expect(readFileSync(target, 'utf8')).toBe(content);
    }
  });
});

describe('OMR fixture measurements', () => {
  for (const fixture of OMR_FIXTURE_CASES) {
    it(fixture.name, () => {
      const path = join(ROOT, 'measurements', `${fixture.name}.json`);
      if (!existsSync(path)) {
        throw new Error(`Missing ${path}. Run "npm run omr:fixtures" to measure the fixture suite.`);
      }
      const analysis = omrAnalysisSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
      const issues = analysisIssues(analysis);
      expect(analysis.located).toBe(fixture.expect.located);
      for (const issue of fixture.expect.issuesInclude ?? []) expect(issues).toContain(issue);
      if (fixture.expect.ready) expect(issues).toEqual([]);
      if (fixture.expect.inferredMarker !== undefined) expect(analysis.inferredMarker).toBe(fixture.expect.inferredMarker);
      if (!analysis.located) return;

      const template = standardTemplate(fixture.templateId)!;
      expect(analysis.bubbleFill).toHaveLength(template.questionCount);
      const { detections, baseline } = classifyBubbles(analysis.bubbleFill);
      const byNumber = new Map(detections.map((detection) => [detection.number, detection]));

      if (fixture.expect.allStandardMarks) {
        for (const mark of fixture.marks) {
          const detection = byNumber.get(mark.question)!;
          expect({ question: mark.question, state: detection.state, choice: detection.choice }).toEqual({
            question: mark.question,
            state: 'marked',
            choice: mark.choice,
          });
          if (fixture.expect.ready) expect(detection.needsReview).toBe(false);
        }
        for (const question of fixture.blank ?? []) expect(byNumber.get(question)?.state).toBe('blank');
      }
      for (const [question, expected] of Object.entries(fixture.expect.questions ?? {})) {
        const detection = byNumber.get(Number(question))!;
        if (expected.state === 'not-marked') {
          expect({ question, state: detection.state }).not.toEqual({ question, state: 'marked' });
        } else {
          expect({ question, state: detection.state }).toEqual({ question, state: expected.state });
          if (expected.choice !== undefined) expect(detection.choice).toBe(expected.choice);
        }
      }

      if (fixture.expect.sheetCode === 'match') expect(analysis.sheetCode).toBe(sheetCodeText(fixture));
      if (fixture.expect.sheetMismatch) {
        const mismatch = sheetMismatch(parseSheetCode(analysis.sheetCode!), {
          quiz: {
            quizId: FIXTURE_QUIZ.quizId,
            version: FIXTURE_QUIZ.quizVersion,
            forms: [{ code: 'A', questionOrder: ['q1'], choiceOrders: {} }],
          },
          template,
        });
        expect(mismatch?.code).toBe(fixture.expect.sheetMismatch);
      }
      if (fixture.expect.classNumber !== undefined) {
        expect(readClassId(analysis.classIdFill, baseline).classNumber).toBe(fixture.expect.classNumber);
      }
    });
  }
});
