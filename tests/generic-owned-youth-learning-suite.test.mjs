import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isYouthLearningFiles,
  youthLearningProfileCommands,
} from '../scripts/run-private-profile-stage5.mjs';

const exactYouthFiles = Object.freeze([
  'apps/training-web/src/youth-mode/YouthHome.tsx',
  'apps/training-web/src/youth-mode/YouthLearningPrototype.tsx',
  'apps/training-web/src/youth-mode/fixtures.ts',
  'apps/training-web/src/youth-mode/index.ts',
  'apps/training-web/src/youth-mode/youth-mode.css',
  'packages/training-youth-learning/src/contracts.ts',
  'packages/training-youth-learning/src/index.ts',
  'packages/training-youth-learning/src/logic.ts',
  'packages/training-youth-learning/src/session.ts',
  'docs/product/trainingos-youth-learning-loop-v1.md',
  'docs/testing/trainingos-youth-learning-loop-v1.md',
  'tests/test_trainingos_youth_learning_product_v1.py',
]);

test('selects a closed Youth Learning owned diff', () => {
  assert.equal(isYouthLearningFiles(exactYouthFiles), true);
});

test('requires both the Youth package and focused contract', () => {
  assert.equal(
    isYouthLearningFiles(exactYouthFiles.filter((name) => !name.startsWith('packages/'))),
    false,
  );
  assert.equal(
    isYouthLearningFiles(exactYouthFiles.filter((name) => !name.startsWith('tests/'))),
    false,
  );
});

test('rejects shared routes, package config, migrations and neighboring owners', () => {
  for (const forbidden of [
    'apps/training-web/src/RootApp.tsx',
    'apps/training-web/src/main.tsx',
    'apps/training-web/src/invite-challenge/routes.ts',
    'package.json',
    'playwright.config.ts',
    'supabase/migrations/20260729230000_youth.sql',
    'packages/training-challenge/src/runtime.mjs',
  ]) {
    assert.equal(isYouthLearningFiles([...exactYouthFiles, forbidden]), false, forbidden);
  }
});

test('uses only fixed install, Youth contract, typecheck and direct Vite commands', () => {
  assert.deepEqual(
    youthLearningProfileCommands.map(({ label }) => label),
    ['install', 'owned-python-contracts', 'typecheck', 'production-build'],
  );
  const python = youthLearningProfileCommands[1];
  assert.equal(python.executable, 'python');
  assert.deepEqual(python.args, [
    '-m',
    'unittest',
    '-v',
    'tests.test_trainingos_youth_learning_product_v1',
  ]);
  const build = youthLearningProfileCommands[3];
  assert.equal(build.executable, 'npx');
  assert.deepEqual(build.args, ['vite', 'build', '--config', 'vite.config.ts']);
});

test('contains no request-controlled command surface', () => {
  const serialized = JSON.stringify(youthLearningProfileCommands);
  for (const forbidden of [
    'process.env.COMMAND',
    'bash -c',
    'sh -c',
    'eval',
    'supabase db',
    'vercel deploy',
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});
