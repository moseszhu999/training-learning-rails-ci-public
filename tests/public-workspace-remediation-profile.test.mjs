import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateInputs } from '../scripts/exact-head-inputs.mjs';

const profile = readFileSync(new URL('../scripts/run-workspace-remediation-profile.mjs', import.meta.url), 'utf8');
const router = readFileSync(new URL('../scripts/run-private-profile.mjs', import.meta.url), 'utf8');
const workflow = readFileSync(new URL('../.github/workflows/trainingos-public-exact-head.yml', import.meta.url), 'utf8');

const escaped = (value) => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

test('workspace remediation profile is exact to three private files', () => {
  for (const marker of [
    'apps/training-web/src/main.tsx',
    'apps/training-web/src/trainingos-agent-native-remediation-v1.css',
    'tests/test_trainingos_agent_native_workspace_remediation_v1.py',
    'files.length === EXACT_FILES.size',
    'files.every((file) => EXACT_FILES.has(file))',
  ]) assert.match(profile, escaped(marker));
});

test('workspace remediation profile runs fixed contracts and build gates', () => {
  for (const marker of [
    "command('python-contract'",
    'tests.test_trainingos_agent_native_workspace_remediation_v1',
    "command('typecheck'",
    "command('production-build'",
    "command('bundle-verification'",
    'Number(input.expectedNodeCount) === 0',
    'Number(input.expectedPythonCount) === 3',
    'pythonTests === 3',
    "selectedSuite: 'workspace-remediation'",
  ]) assert.match(profile, escaped(marker));
  assert.doesNotMatch(profile, /service[_-]?role/i);
  assert.doesNotMatch(profile, /deploy/i);
  assert.doesNotMatch(profile, /supabase/);
});

test('workspace remediation is a reusable fixed profile', () => {
  assert.match(router, /runWorkspaceRemediationProfile/);
  assert.match(router, /input\.profile === 'workspace-remediation'/);
  assert.match(workflow, /- workspace-remediation/);
});

test('workspace remediation input contract fails closed', () => {
  const valid = {
    privateExactSha: 'a'.repeat(40),
    expectedBaseSha: 'b'.repeat(40),
    expectedMainSha: '',
    validationProfile: 'workspace-remediation',
    expectedChangedFileCount: '3',
    expectedMigrationRange: 'none',
    expectedFocusedTestCounts: 'node=0;python=3',
    expectedMigrationCount: '0',
    runFreshReplay: 'false',
    runUpgradeReplay: 'false',
    runApplicationContracts: 'false',
    runTypecheck: 'false',
    runProductionBuild: 'false',
    runCriticalE2E: 'false',
  };
  assert.equal(validateInputs(valid).ok, true);
  assert.equal(validateInputs({ ...valid, expectedChangedFileCount: '4' }).ok, false);
  assert.equal(validateInputs({ ...valid, expectedMigrationRange: '20260803000000-20260803000000' }).ok, false);
  assert.equal(validateInputs({ ...valid, expectedFocusedTestCounts: 'node=0;python=2' }).ok, false);
  assert.equal(validateInputs({ ...valid, runProductionBuild: 'true' }).ok, false);
});
