import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateInputs } from '../scripts/exact-head-inputs.mjs';

const profile = readFileSync(new URL('../scripts/run-structured-agent-preview-profile.mjs', import.meta.url), 'utf8');
const router = readFileSync(new URL('../scripts/run-private-profile.mjs', import.meta.url), 'utf8');
const workflow = readFileSync(new URL('../.github/workflows/trainingos-public-exact-head.yml', import.meta.url), 'utf8');

const escaped = (value) => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

test('structured Agent preview profile is exact to six private files', () => {
  for (const marker of [
    'apps/training-web/src/components/TrainingOsStructuredAgentCommand.tsx',
    'apps/training-web/src/lib/trainingos-structured-agent-command.ts',
    'apps/training-web/src/main.tsx',
    'apps/training-web/src/trainingos-structured-agent-command.css',
    'docs/product/trainingos-structured-agent-preview-v1.md',
    'tests/test_trainingos_structured_agent_preview_v1.py',
    'files.length === EXACT_FILES.size',
    'files.every((file) => EXACT_FILES.has(file))',
  ]) assert.match(profile, escaped(marker));
});

test('structured Agent preview profile runs fixed contracts and build gates', () => {
  for (const marker of [
    "command('python-contract'",
    'tests.test_trainingos_structured_agent_preview_v1',
    "command('typecheck'",
    "command('production-build'",
    "command('bundle-verification'",
    'Number(input.expectedNodeCount) === 0',
    'Number(input.expectedPythonCount) === 6',
    'pythonTests === 6',
    "selectedSuite: 'structured-agent-preview'",
  ]) assert.match(profile, escaped(marker));
  assert.doesNotMatch(profile, /service[_-]?role/i);
  assert.doesNotMatch(profile, /deploy/i);
  assert.doesNotMatch(profile, /supabase/);
});

test('structured Agent preview is routed and dispatchable as a reusable fixed profile', () => {
  assert.match(router, /runStructuredAgentPreviewProfile/);
  assert.match(router, /input\.profile === 'structured-agent-preview'/);
  assert.match(workflow, /- structured-agent-preview/);
});

test('structured Agent preview input contract fails closed', () => {
  const valid = {
    privateExactSha: 'a'.repeat(40),
    expectedBaseSha: 'b'.repeat(40),
    expectedMainSha: '',
    validationProfile: 'structured-agent-preview',
    expectedChangedFileCount: '6',
    expectedMigrationRange: 'none',
    expectedFocusedTestCounts: 'node=0;python=6',
    expectedMigrationCount: '0',
    runFreshReplay: 'false',
    runUpgradeReplay: 'false',
    runApplicationContracts: 'false',
    runTypecheck: 'false',
    runProductionBuild: 'false',
    runCriticalE2E: 'false',
  };
  assert.equal(validateInputs(valid).ok, true);
  assert.equal(validateInputs({ ...valid, expectedChangedFileCount: '5' }).ok, false);
  assert.equal(validateInputs({ ...valid, expectedMigrationRange: '20260803000000-20260803000000' }).ok, false);
  assert.equal(validateInputs({ ...valid, expectedFocusedTestCounts: 'node=0;python=5' }).ok, false);
  assert.equal(validateInputs({ ...valid, runProductionBuild: 'true' }).ok, false);
});
