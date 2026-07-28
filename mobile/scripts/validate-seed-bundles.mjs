import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEED_ROOT = path.join(ROOT, 'seed');
const modules = [];

for (let grade = 1; grade <= 10; grade += 1) {
  for (const subject of ['science', 'math', 'english']) {
    const subjectDir = path.join(SEED_ROOT, `grade${grade}`, subject);
    const entries = await readdir(subjectDir, { withFileTypes: true });
    const moduleDirs = entries.filter((entry) => entry.isDirectory());
    if (moduleDirs.length < 5 || moduleDirs.length > 7) {
      throw new Error(
        `Grade ${grade} ${subject} has ${moduleDirs.length} modules; expected 5-7.`,
      );
    }
    for (const entry of moduleDirs) {
      modules.push(await validateModule(path.join(subjectDir, entry.name)));
    }
  }
}

if (modules.length < 150 || modules.length > 210) {
  throw new Error(`Expected 150-210 seed modules, found ${modules.length}.`);
}
console.log(
  `Validated ${modules.length} modules, ${modules.length * 2} WebP teaching aids, quizzes, review items, and checksums.`,
);

async function validateModule(moduleDir) {
  const manifest = JSON.parse(
    await readFile(path.join(moduleDir, 'manifest.json'), 'utf8'),
  );
  if (manifest.source !== 'seed-bundle') {
    throw new Error(`${manifest.moduleId} is not a seed-bundle module.`);
  }
  if (manifest.assets.length < 2 || manifest.reviewItems.length < 5) {
    throw new Error(`${manifest.moduleId} lacks teaching aids or review items.`);
  }
  const quizPath = `${manifest.quizId}.json`;
  const quiz = JSON.parse(await readFile(path.join(moduleDir, quizPath), 'utf8'));
  const allowedTypes = new Set([
    'multiple-choice',
    'fill-in-the-blank',
    'identification',
  ]);
  if (quiz.length < 5 || quiz.some((item) => !allowedTypes.has(item.type))) {
    throw new Error(`${manifest.moduleId} has an invalid quiz.`);
  }
  if (
    quiz.some(
      (item) =>
        item.type === 'multiple-choice' &&
        !item.options?.includes(item.correctAnswer),
    )
  ) {
    throw new Error(`${manifest.moduleId} has an invalid answer option.`);
  }
  const required = [
    manifest.content.markdown,
    quizPath,
    ...manifest.assets,
  ];
  for (const relativePath of required) {
    const bytes = await readFile(path.join(moduleDir, relativePath));
    const actual = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    if (manifest.checksums[relativePath] !== actual) {
      throw new Error(`${manifest.moduleId} checksum failed for ${relativePath}.`);
    }
  }
  for (const relativePath of manifest.assets) {
    const metadata = await sharp(path.join(moduleDir, relativePath)).metadata();
    if (
      metadata.format !== 'webp' ||
      !metadata.width ||
      metadata.width > 1080
    ) {
      throw new Error(`${manifest.moduleId} has an invalid WebP teaching aid.`);
    }
  }
  return manifest;
}
