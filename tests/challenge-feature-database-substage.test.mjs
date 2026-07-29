import assert from 'node:assert/strict';
import test from 'node:test';

import { refineChallengeDatabaseFailure } from '../scripts/run-private-profile-stage3.mjs';

function failedResult(status = 'FAIL:database-replay') {
  return {
    ok: false,
    status,
    failedLabels: Object.freeze(
      status.slice(5).split(','),
    ),
    stepCount: 8,
    passedStepCount: 7,
    nodeTests: 5,
    nodePassed: 5,
    nodeFailed: 0,
    pythonTests: 6,
  };
}

test('Challenge feature database failures expose only an allowlisted stage', () => {
  const result = refineChallengeDatabaseFailure(failedResult(), [
    'private output remains sealed\nCHALLENGE_DATABASE status=FAIL stage=upgrade-e2e\n',
  ]);

  assert.equal(result.status, 'FAIL:database-upgrade-e2e');
  assert.deepEqual(result.failedLabels, ['database-upgrade-e2e']);
});

test('unknown database text remains the coarse safe label', () => {
  const original = failedResult();
  const result = refineChallengeDatabaseFailure(original, [
    'CHALLENGE_DATABASE status=FAIL stage=arbitrary-debug-stage\n',
  ]);

  assert.equal(result, original);
  assert.equal(result.status, 'FAIL:database-replay');
});

test('database refinement preserves other sanitized failure labels', () => {
  const result = refineChallengeDatabaseFailure(
    failedResult('FAIL:database-replay,focused-counts'),
    ['CHALLENGE_DATABASE status=FAIL stage=fresh-e2e\n'],
  );

  assert.equal(result.status, 'FAIL:database-fresh-e2e,focused-counts');
  assert.deepEqual(result.failedLabels, ['database-fresh-e2e', 'focused-counts']);
});

test('non-database failures are unchanged', () => {
  const original = {
    ...failedResult('FAIL:production-build'),
    failedLabels: Object.freeze(['production-build']),
  };
  assert.equal(refineChallengeDatabaseFailure(original, []), original);
});
