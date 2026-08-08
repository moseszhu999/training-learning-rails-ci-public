import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CANONICAL_NORTH_STAR_EXACT_FILES,
  canonicalNorthStarCommands,
  isCanonicalNorthStarScope,
} from '../scripts/run-canonical-north-star-current-main-profile.mjs';

test('selector accepts only the three canonical context files', () => {
  assert.equal(CANONICAL_NORTH_STAR_EXACT_FILES.size, 3);
  assert.equal(isCanonicalNorthStarScope(CANONICAL_NORTH_STAR_EXACT_FILES), true);
  assert.equal(isCanonicalNorthStarScope([...CANONICAL_NORTH_STAR_EXACT_FILES, 'docs/product/trainingos-project-guardrails-v1.md']), false);
});

test('profile validates canonical context and repository build gates', () => {
  assert.deepEqual(canonicalNorthStarCommands.map((item) => item.label), [
    'install',
    'canonical-context-contract',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  const contract = canonicalNorthStarCommands.find((item) => item.label === 'canonical-context-contract');
  assert.equal(contract?.executable, 'node');
  assert.equal(contract?.args.join('\n').includes('docs/product/trainingos-north-star.md'), true);
  assert.equal(contract?.args.join('\n').includes('trainingos-project-guardrails-v1.md'), true);
});

test('fixed scope and migration metadata remain locked', () => {
  const source = readFileSync(new URL('../scripts/run-canonical-north-star-current-main-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    'const EXPECTED_CHANGED_FILE_COUNT = 3;',
    'const EXPECTED_NODE_COUNT = 0;',
    'const EXPECTED_PYTHON_COUNT = 0;',
    'const EXPECTED_MIGRATION_COUNT = 369;',
    "selectedSuite: 'canonical-north-star-current-main'",
  ]) assert.equal(source.includes(token), true, token);
});

test('profile contains no deployment, database or provider execution stage', () => {
  const text = JSON.stringify(canonicalNorthStarCommands).toLowerCase();
  for (const forbidden of ['curl', 'wget', 'ssh', 'netlify deploy', 'vercel deploy', 'supabase db', 'psql', 'createroom', 'joinclass']) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
});
