import test from 'node:test';
import assert from 'node:assert/strict';

import {
  YOUTH_GUARDIAN_FAILED_LABEL,
  YOUTH_GUARDIAN_MISSING_LABEL,
  YOUTH_GUARDIAN_TEST_PATTERN,
  applyYouthGuardianReleaseGate,
  countYouthGuardianTests,
} from '../scripts/youth-guardian-release-gate.mjs';

const basePass = Object.freeze({
  ok: true,
  status: 'PASS',
  failedLabels: Object.freeze([]),
  stepCount: 6,
  passedStepCount: 6,
  nodeTests: 0,
  nodePassed: 0,
  pythonTests: 10,
});

test('Youth Guardian test selector is fixed and cannot accept request commands', () => {
  assert.equal(YOUTH_GUARDIAN_TEST_PATTERN, 'test_trainingos_youth_guardian_*.py');
  assert.equal(YOUTH_GUARDIAN_TEST_PATTERN.includes('$'), false);
  assert.equal(YOUTH_GUARDIAN_TEST_PATTERN.includes(';'), false);
});

test('counts executed Youth Guardian unittest evidence', () => {
  assert.equal(countYouthGuardianTests('Ran 12 tests in 0.1s\nOK'), 12);
  assert.equal(countYouthGuardianTests('Ran 3 tests\nRan 4 tests\n'), 7);
  assert.equal(countYouthGuardianTests('OK'), 0);
});

test('Challenge Web remains green only when Youth Guardian tests execute and pass', () => {
  const result = applyYouthGuardianReleaseGate(basePass, {
    ok: true,
    tests: 12,
    status: 'PASS',
    failureLabel: YOUTH_GUARDIAN_FAILED_LABEL,
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, 'PASS');
  assert.equal(result.youthGuardianGate, 'PASS');
  assert.equal(result.stepCount, 7);
  assert.equal(result.passedStepCount, 7);
  assert.equal(result.pythonTests, 22);
});

test('missing Youth Guardian contracts hard-block formal public Challenge release', () => {
  const result = applyYouthGuardianReleaseGate(basePass, {
    ok: false,
    tests: 0,
    status: 'FAIL',
    failureLabel: YOUTH_GUARDIAN_MISSING_LABEL,
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'FAIL:youth-guardian-contract-missing');
  assert.deepEqual(result.failedLabels, ['youth-guardian-contract-missing']);
  assert.equal(result.youthGuardianGate, 'FAIL');
  assert.equal(result.passedStepCount, 6);
});

test('failing Guardian tests are additive and do not erase Web failures', () => {
  const result = applyYouthGuardianReleaseGate({
    ...basePass,
    ok: false,
    status: 'FAIL:typecheck',
    failedLabels: Object.freeze(['typecheck']),
    passedStepCount: 5,
  }, {
    ok: false,
    tests: 8,
    status: 'FAIL',
    failureLabel: YOUTH_GUARDIAN_FAILED_LABEL,
  });
  assert.equal(result.status, 'FAIL:typecheck,youth-guardian-contract-failed');
  assert.deepEqual(result.failedLabels, ['typecheck', 'youth-guardian-contract-failed']);
  assert.equal(result.pythonTests, 18);
});
