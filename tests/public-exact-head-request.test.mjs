import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { validateRequest } from '../scripts/exact-head-request.mjs';

const root = process.cwd();
const workflowPath = path.join(root, '.github/workflows/trainingos-public-exact-head-request.yml');

const request = {
  requestId: 'challenge-canonical-pr375-76badc30',
  reportIssueNumber: 95,
  privateExactSha: 'a'.repeat(40),
  expectedBaseSha: 'b'.repeat(40),
  expectedMainSha: '',
  validationProfile: 'challenge-runtime',
  expectedChangedFileCount: '24',
  expectedMigrationRange: '20260729200000-20260729205959',
  expectedFocusedTestCounts: 'node=15;python=21',
  expectedMigrationCount: '313',
  runFreshReplay: 'false',
  runUpgradeReplay: 'false',
  runApplicationContracts: 'false',
  runTypecheck: 'false',
  runProductionBuild: 'false',
  runCriticalE2E: 'false',
};

test('request parser accepts complete fixed canonical metadata only', () => {
  assert.equal(validateRequest(request).ok, true);
  assert.equal(validateRequest({ ...request, requestId: '../unsafe' }).ok, false);
  assert.equal(validateRequest({ ...request, reportIssueNumber: 0 }).ok, false);
  assert.equal(validateRequest({ ...request, validationProfile: 'arbitrary-shell' }).ok, false);
  assert.equal(validateRequest({ ...request, privateExactSha: 'A'.repeat(40) }).ok, false);
  assert.equal(validateRequest({ ...request, expectedMigrationCount: '' }).ok, false);
  assert.equal(validateRequest({ ...request, expectedMigrationRange: 'none' }).ok, false);
});

test('request driver forwards the complete reusable-controller contract and never checks out private code', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  assert.match(workflow, /ci\/exact-head-request\/\*\*/);
  assert.match(workflow, /gh workflow run trainingos-public-exact-head\.yml/);
  assert.match(workflow, /--ref main/);
  assert.match(workflow, /actions: write/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /expectedMainSha="\$EXPECTED_MAIN_SHA"/);
  assert.match(workflow, /expectedMigrationCount="\$EXPECTED_MIGRATION_COUNT"/);
  assert.match(workflow, /runFreshReplay="\$RUN_FRESH_REPLAY"/);
  assert.match(workflow, /runUpgradeReplay="\$RUN_UPGRADE_REPLAY"/);
  assert.match(workflow, /runApplicationContracts="\$RUN_APPLICATION_CONTRACTS"/);
  assert.match(workflow, /runTypecheck="\$RUN_TYPECHECK"/);
  assert.match(workflow, /runProductionBuild="\$RUN_PRODUCTION_BUILD"/);
  assert.match(workflow, /runCriticalE2E="\$RUN_CRITICAL_E2E"/);
  assert.doesNotMatch(workflow, /repository:\s+moseszhu999\/training-learning-rails\b/);
  assert.doesNotMatch(workflow, /upload-artifact/);
  assert.match(workflow, /Only sanitized status and immutable identifiers are reported/);
  assert.match(workflow, /Remove sealed request files/);
});
