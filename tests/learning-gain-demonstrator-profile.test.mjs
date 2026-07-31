import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const profile = readFileSync(new URL('../scripts/run-learning-gain-demonstrator-profile.mjs', import.meta.url), 'utf8');
const router = readFileSync(new URL('../scripts/run-private-profile.mjs', import.meta.url), 'utf8');

const escaped = (value) => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

test('learning gain profile is fixed to eight private files', () => {
  for (const marker of [
    'apps/training-web/src/RootApp.tsx',
    'apps/training-web/src/components/TrainingOsLearningGainDemonstrator.tsx',
    'apps/training-web/src/lib/trainingos-learning-gain-projection.test.ts',
    'apps/training-web/src/lib/trainingos-learning-gain-projection.ts',
    'apps/training-web/src/lib/trainingos-learning-gain-read-adapter.ts',
    'apps/training-web/src/trainingos-learning-gain-demonstrator.css',
    'docs/product/trainingos-learning-gain-demonstrator-v1.md',
    'tests/test_trainingos_learning_gain_demonstrator_v1_contract.py',
    'files.length === EXACT_FILES.size',
    'files.every((file) => EXACT_FILES.has(file))',
  ]) assert.match(profile, escaped(marker));
});

test('learning gain profile executes fixed Node Python typecheck and build gates', () => {
  for (const marker of [
    "command('node-projection'",
    'trainingos-learning-gain-projection.test.ts',
    "command('python-contract'",
    'test_trainingos_learning_gain_demonstrator_v1_contract.py',
    "command('typecheck'",
    "command('production-build'",
    'Number(input.expectedNodeCount) === 7',
    'Number(input.expectedPythonCount) === 14',
    'nodeTests === 7',
    'nodePassed === 7',
    'pythonTests === 14',
    "selectedSuite: 'learning-gain-demonstrator'",
  ]) assert.match(profile, escaped(marker));
  assert.doesNotMatch(profile, /pytest/);
  assert.doesNotMatch(profile, /service[_-]?role/i);
  assert.doesNotMatch(profile, /deploy/i);
});

test('generic-owned router selects learning gain before broad fallback', () => {
  assert.match(router, /maybeRunLearningGainDemonstratorProfile/);
  const fixed = router.indexOf('const learningGainDemonstrator');
  const base = router.indexOf('const result = await runBaseProfile');
  assert.ok(fixed >= 0 && base > fixed);
});
