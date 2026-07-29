import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { validateRequest } from '../scripts/exact-head-request.mjs';

const root = process.cwd();
const workflowPath = path.join(root, '.github/workflows/trainingos-public-exact-head-request.yml');

const request = {
  requestId: 'challenge-proof-603ab536',
  reportIssueNumber: 92,
  privateExactSha: 'a'.repeat(40),
  expectedBaseSha: 'b'.repeat(40),
  validationProfile: 'challenge-runtime',
  expectedChangedFileCount: '11',
  expectedMigrationRange: '20260729220000-20260729225959',
  expectedFocusedTestCounts: 'node=5;python=6',
};

test('request parser accepts only fixed validated metadata', () => {
  assert.equal(validateRequest(request).ok, true);
  assert.equal(validateRequest({ ...request, requestId: '../unsafe' }).ok, false);
  assert.equal(validateRequest({ ...request, reportIssueNumber: 0 }).ok, false);
  assert.equal(validateRequest({ ...request, validationProfile: 'arbitrary-shell' }).ok, false);
  assert.equal(validateRequest({ ...request, privateExactSha: 'A'.repeat(40) }).ok, false);
});

test('request driver dispatches the reusable controller and never checks out private code', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  assert.match(workflow, /ci\/exact-head-request\/\*\*/);
  assert.match(workflow, /gh workflow run trainingos-public-exact-head\.yml/);
  assert.match(workflow, /--ref main/);
  assert.match(workflow, /actions: write/);
  assert.match(workflow, /persist-credentials: false/);
  assert.doesNotMatch(workflow, /repository:\s+moseszhu999\/training-learning-rails\b/);
  assert.doesNotMatch(workflow, /upload-artifact/);
  assert.match(workflow, /Only sanitized status and immutable identifiers are reported/);
  assert.match(workflow, /Remove sealed request files/);
});
