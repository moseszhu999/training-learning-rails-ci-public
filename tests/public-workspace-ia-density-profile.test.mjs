import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateInputs } from '../scripts/exact-head-inputs.mjs';

const profile = readFileSync(new URL('../scripts/run-workspace-ia-density-profile.mjs', import.meta.url), 'utf8');
const router = readFileSync(new URL('../scripts/run-private-profile.mjs', import.meta.url), 'utf8');

const escaped = (value) => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

test('workspace IA density runner is exact to five private files', () => {
  for (const marker of [
    'apps/training-web/src/components/TrainingOsAdvancedManagementSurface.tsx',
    'apps/training-web/src/lib/trainingos-workspace-density.ts',
    'apps/training-web/src/trainingos-agent-native-remediation-v1.css',
    'docs/product/trainingos-workspace-ia-density-v1.md',
    'tests/test_trainingos_workspace_ia_density_v1.py',
    'files.length === EXACT_FILES.size',
    'files.every((file) => EXACT_FILES.has(file))',
  ]) assert.match(profile, escaped(marker));
});

test('workspace IA density runner executes fixed contracts and build gates', () => {
  for (const marker of [
    "command('python-contract'",
    'tests.test_trainingos_workspace_ia_density_v1',
    "command('typecheck'",
    "command('production-build'",
    "command('bundle-verification'",
    'Number(input.expectedNodeCount) === 0',
    'Number(input.expectedPythonCount) === 5',
    'pythonTests === 5',
    "selectedSuite: 'workspace-ia-density'",
  ]) assert.match(profile, escaped(marker));
  assert.doesNotMatch(profile, /service[_-]?role/i);
  assert.doesNotMatch(profile, /supabase/i);
  assert.doesNotMatch(profile, /deploy/i);
});

test('workspace IA density runner is routed before inherited generic-owned handlers', () => {
  assert.match(router, /maybeRunWorkspaceIaDensityProfile/);
  assert.match(router, /const workspaceIaDensity = await maybeRunWorkspaceIaDensityProfile\(input\)/);
  assert.match(router, /if \(workspaceIaDensity\) return workspaceIaDensity/);
});

test('generic-owned dispatch inputs accept the fixed five-test contract', () => {
  const result = validateInputs({
    privateExactSha: 'a'.repeat(40),
    expectedBaseSha: 'b'.repeat(40),
    expectedMainSha: '',
    validationProfile: 'generic-owned',
    expectedChangedFileCount: '5',
    expectedMigrationRange: 'none',
    expectedFocusedTestCounts: 'node=0;python=5',
    expectedMigrationCount: '0',
    runFreshReplay: 'false',
    runUpgradeReplay: 'false',
    runApplicationContracts: 'false',
    runTypecheck: 'false',
    runProductionBuild: 'false',
    runCriticalE2E: 'false',
  });
  assert.equal(result.ok, true);
});
