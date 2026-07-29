import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateInputs } from '../scripts/exact-head-inputs.mjs';
import {
  educationEcosystemProfileCommands,
  isEducationEcosystemFiles,
} from '../scripts/run-private-profile-stage6.mjs';

const exactFiles = [
  'docs/architecture/trainingos-education-ecosystem-capability-adapter-v1.md',
  'docs/testing/trainingos-education-ecosystem-capability-adapter-v1.md',
  'lib/trainingos-agent-gateway/education-ecosystem-adapter.mjs',
  'packages/training-education-ecosystem/src/index.d.mts',
  'packages/training-education-ecosystem/src/index.mjs',
  'packages/training-education-ecosystem/src/marble-mock.mjs',
  'packages/training-education-ecosystem/src/openmaic-mock.mjs',
  'tests/training-education-ecosystem/education-ecosystem-adapter.test.mjs',
];

test('education ecosystem is an accepted fixed exact-head profile', () => {
  const result = validateInputs({
    privateExactSha: '1'.repeat(40),
    expectedBaseSha: '2'.repeat(40),
    validationProfile: 'education-ecosystem',
    expectedChangedFileCount: '8',
    expectedMigrationRange: 'none',
    expectedFocusedTestCounts: 'node=19;python=0',
    expectedMigrationCount: '0',
  });
  assert.equal(result.ok, true, result.failures.join(','));
  assert.equal(result.normalized.expectedNodeCount, '19');
  assert.equal(result.normalized.expectedPythonCount, '0');
});

test('education ecosystem scope accepts only its exclusive owner paths', () => {
  assert.equal(isEducationEcosystemFiles(exactFiles), true);
  assert.equal(isEducationEcosystemFiles([
    ...exactFiles,
    'packages/training-challenge/src/index.mjs',
  ]), false);
  assert.equal(isEducationEcosystemFiles([
    ...exactFiles,
    'supabase/migrations/20260729000000_unrelated.sql',
  ]), false);
  assert.equal(isEducationEcosystemFiles([
    ...exactFiles,
    'lib/trainingos-agent-gateway/index.mjs',
  ]), false);
});

test('education ecosystem profile is fixed to syntax, focused contracts and typecheck', () => {
  assert.deepEqual(
    educationEcosystemProfileCommands.map((item) => item.label),
    [
      'install',
      'syntax-core',
      'syntax-openmaic',
      'syntax-marble',
      'syntax-gateway',
      'node-contract',
      'typecheck',
    ],
  );
  const nodeCommand = educationEcosystemProfileCommands.find((item) => item.label === 'node-contract');
  assert.ok(nodeCommand.args.includes('tests/training-education-ecosystem/education-ecosystem-adapter.test.mjs'));
});

test('profile keeps sealed runner-local logs and adds no workflow', async () => {
  const source = await readFile(new URL('../scripts/run-private-profile-stage6.mjs', import.meta.url), 'utf8');
  const entrypoint = await readFile(new URL('../scripts/run-private-profile.mjs', import.meta.url), 'utf8');
  assert.match(source, /openSync\(logPath, 'w', 0o600\)/);
  assert.match(source, /education-ecosystem-scope/);
  assert.doesNotMatch(source, /actions\/upload-artifact/);
  assert.match(entrypoint, /run-private-profile-stage6\.mjs/);
});
