import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { classifyCommandFailure, computeFinalVerdict, finalizeControllerVerdict, releaseStatuses } from '../scripts/main-release-verdict.mjs';
import { runMainReleaseGate } from '../scripts/run-main-release-gate.mjs';

const root = process.cwd();

test('final verdict vocabulary is closed and NOT_RUN never becomes PASS', () => {
  assert.deepEqual(releaseStatuses, ['PASS', 'FAIL', 'BASELINE_FAILURE', 'INFRASTRUCTURE_BLOCKED', 'NOT_RUN']);
  const stages = { a: 'PASS', b: 'NOT_RUN' };
  assert.equal(computeFinalVerdict({ allRequested: true, stages }), 'NOT_RUN');
  assert.equal(computeFinalVerdict({ allRequested: false, stages: { a: 'PASS' } }), 'NOT_RUN');
  assert.equal(computeFinalVerdict({ allRequested: true, stages: { a: 'PASS', b: 'PASS' } }), 'PASS');
});

test('baseline and Vercel free-tier infrastructure failures are classified separately', () => {
  assert.equal(classifyCommandFailure('TypeScript error TS2322'), 'BASELINE_FAILURE');
  assert.equal(classifyCommandFailure('Vercel free-tier deployment rate limit exceeded'), 'INFRASTRUCTURE_BLOCKED');
  assert.equal(computeFinalVerdict({
    allRequested: true,
    stages: { a: 'FAIL' },
    explicitFailureClasses: ['BASELINE_FAILURE'],
  }), 'BASELINE_FAILURE');
  assert.equal(computeFinalVerdict({
    allRequested: true,
    stages: { a: 'FAIL', b: 'NOT_RUN' },
    explicitFailureClasses: ['INFRASTRUCTURE_BLOCKED'],
  }), 'INFRASTRUCTURE_BLOCKED');
  assert.equal(computeFinalVerdict({
    allRequested: true,
    stages: { a: 'FAIL', b: 'NOT_RUN' },
    explicitFailureClasses: ['BASELINE_FAILURE'],
  }), 'BASELINE_FAILURE');
});

test('controller negatives report FAIL and missing credential reports infrastructure blocked', () => {
  assert.equal(finalizeControllerVerdict({
    publicContracts: 'PASS', inputValidation: 'PASS', credential: 'PASS', scope: 'FAIL', runnerVerdict: 'NOT_RUN',
  }), 'FAIL');
  assert.equal(finalizeControllerVerdict({
    publicContracts: 'PASS', inputValidation: 'FAIL', credential: 'NOT_RUN', scope: 'NOT_RUN', runnerVerdict: 'NOT_RUN',
  }), 'FAIL');
  assert.equal(finalizeControllerVerdict({
    publicContracts: 'PASS', inputValidation: 'PASS', credential: 'FAIL', scope: 'NOT_RUN', runnerVerdict: 'NOT_RUN',
  }), 'INFRASTRUCTURE_BLOCKED');
  assert.equal(finalizeControllerVerdict({
    publicContracts: 'PASS', inputValidation: 'PASS', credential: 'PASS', scope: 'PASS', runnerVerdict: 'PASS',
  }), 'PASS');
});

test('main-release runner returns NOT_RUN when any gate is intentionally disabled', async () => {
  const result = await runMainReleaseGate({
    publicRepoPath: root,
    privateRepoPath: path.join(root, 'missing-private-repo'),
    privateExactSha: 'a'.repeat(40),
    expectedMigrationCount: '296',
    runnerTemp: path.join(root, '.tmp-main-release-test'),
    RUN_FRESH_REPLAY: 'false',
    RUN_UPGRADE_REPLAY: 'false',
    RUN_APPLICATION_CONTRACTS: 'false',
    RUN_TYPECHECK: 'false',
    RUN_PRODUCTION_BUILD: 'false',
    RUN_CRITICAL_E2E: 'false',
  });
  assert.equal(result.verdict, 'NOT_RUN');
  assert.ok(Object.values(result.stages).every((value) => value === 'NOT_RUN'));
});

test('database runner has fixed commands, syntax validity, sealed logs, and no secret/artifact publication', async () => {
  const scriptPath = path.join(root, 'scripts/run-main-release-database.sh');
  const script = await readFile(scriptPath, 'utf8');
  const syntax = spawnSync('bash', ['-n', scriptPath], { cwd: root, encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr);
  assert.match(script, /umask 077/);
  assert.match(script, /trainingos-main-release-/);
  assert.doesNotMatch(script, /upload-artifact/);
  assert.doesNotMatch(script, /PRIVATE_REPO_READ_TOKEN/);
  assert.doesNotMatch(script, /\beval\b/);
  assert.match(script, /trainingos_full_history_replay_compatibility_e2e\.sql/);
  assert.match(script, /trainingos_persistent_teacher_agent_e2e\.sql/);
  assert.match(script, /trainingos_classroom_agent_queue_integration_e2e\.sql/);
  assert.match(script, /trainingos_student_learning_canonical_reconciliation_e2e\.sql/);
  assert.match(script, /migration_fingerprint/);
});
