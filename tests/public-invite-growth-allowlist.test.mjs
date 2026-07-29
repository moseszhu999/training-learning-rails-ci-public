import assert from 'node:assert/strict';
import test from 'node:test';
import { profileAllowlist } from '../scripts/verify-private-scope.mjs';

const allowed = (name) => profileAllowlist['challenge-runtime'].some((rule) => rule.test(name));

test('Challenge runtime allows only the fixed Invite Growth concurrency harness path', () => {
  assert.equal(allowed('scripts/run-trainingos-invite-growth-concurrency-e2e.sh'), true);
  assert.equal(allowed('scripts/run-trainingos-invite-growth-concurrency-e2e.mjs'), false);
  assert.equal(allowed('scripts/run-trainingos-invite-growth-debug.sh'), false);
  assert.equal(allowed('scripts/arbitrary.sh'), false);
});
