import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateInputs } from '../scripts/exact-head-inputs.mjs';

const profile = readFileSync(new URL('../scripts/run-source-audit-action-receipt-profile.mjs', import.meta.url), 'utf8');
const router = readFileSync(new URL('../scripts/run-private-profile.mjs', import.meta.url), 'utf8');
const workflow = readFileSync(new URL('../.github/workflows/trainingos-public-exact-head.yml', import.meta.url), 'utf8');

const escaped = (value) => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

test('source audit action receipt profile is exact to seven private files', () => {
  for (const marker of [
    'apps/training-web/src/components/TrainingOsSourceAuditDrawer.tsx',
    'apps/training-web/src/components/TrainingOsStructuredAgentCommand.tsx',
    'apps/training-web/src/lib/trainingos-action-verification-receipt.ts',
    'apps/training-web/src/lib/trainingos-structured-agent-command.ts',
    'apps/training-web/src/trainingos-structured-agent-command.css',
    'docs/product/trainingos-source-audit-action-receipt-v1.md',
    'tests/test_trainingos_source_audit_action_receipt_v1.py',
    'files.length === EXACT_FILES.size',
    'files.every((file) => EXACT_FILES.has(file))',
  ]) assert.match(profile, escaped(marker));
});

test('source audit action receipt profile runs fixed contracts and build gates', () => {
  for (const marker of [
    "command('python-contract'",
    'tests.test_trainingos_structured_agent_preview_v1',
    'tests.test_trainingos_source_audit_action_receipt_v1',
    "command('typecheck'",
    "command('production-build'",
    "command('bundle-verification'",
    'Number(input.expectedNodeCount) === 0',
    'Number(input.expectedPythonCount) === 13',
    'pythonTests === 13',
    "selectedSuite: 'source-audit-action-receipt'",
  ]) assert.match(profile, escaped(marker));
  assert.doesNotMatch(profile, /service[_-]?role/i);
  assert.doesNotMatch(profile, /deploy/i);
  assert.doesNotMatch(profile, /supabase/);
});

test('source audit action receipt is routed and dispatchable as a reusable fixed profile', () => {
  assert.match(router, /runSourceAuditActionReceiptProfile/);
  assert.match(router, /input\.profile === 'source-audit-action-receipt'/);
  assert.match(workflow, /- source-audit-action-receipt/);
});

test('source audit action receipt input contract fails closed', () => {
  const valid = {
    privateExactSha: 'a'.repeat(40),
    expectedBaseSha: 'b'.repeat(40),
    expectedMainSha: '',
    validationProfile: 'source-audit-action-receipt',
    expectedChangedFileCount: '7',
    expectedMigrationRange: 'none',
    expectedFocusedTestCounts: 'node=0;python=13',
    expectedMigrationCount: '0',
    runFreshReplay: 'false',
    runUpgradeReplay: 'false',
    runApplicationContracts: 'false',
    runTypecheck: 'false',
    runProductionBuild: 'false',
    runCriticalE2E: 'false',
  };
  assert.equal(validateInputs(valid).ok, true);
  assert.equal(validateInputs({ ...valid, expectedChangedFileCount: '6' }).ok, false);
  assert.equal(validateInputs({ ...valid, expectedMigrationRange: '20260803000000-20260803000000' }).ok, false);
  assert.equal(validateInputs({ ...valid, expectedFocusedTestCounts: 'node=0;python=12' }).ok, false);
  assert.equal(validateInputs({ ...valid, runProductionBuild: 'true' }).ok, false);
});
