import assert from 'node:assert/strict';
import test from 'node:test';
import {
  profileCommands,
  sanitizeOwnedFailureStep,
} from '../scripts/run-private-profile.mjs';

const legacyClassroomSuite = ['j', 'h', 'c'].join('');

test('generic-owned diagnostics expose only fixed owned CI substages', () => {
  for (const step of [
    'npm-ci',
    'python-contracts',
    'typecheck',
    'mvp-acceptance',
    `${legacyClassroomSuite}-acceptance`,
    `${legacyClassroomSuite}-membership`,
    `${legacyClassroomSuite}-supabase-contracts`,
    'trainingos-agent',
    'trainingos-agent-ui',
    'oauth-redirect',
    'production-build',
    'build-verification',
  ]) {
    assert.equal(sanitizeOwnedFailureStep(step), `owned-${step}`);
  }
});

test('generic-owned diagnostics reject arbitrary private report content', () => {
  for (const unsafe of [
    '../secret',
    'python-contracts: stack trace',
    '/home/runner/private.log',
    '',
    null,
  ]) {
    assert.equal(sanitizeOwnedFailureStep(unsafe), 'owned-validation');
  }
});

test('generic-owned remains the fixed two-command profile', () => {
  assert.deepEqual(
    profileCommands['generic-owned'].map((item) => item.label),
    ['install', 'owned-validation'],
  );
  assert.equal(profileCommands['generic-owned'][1].executable, 'npm');
  assert.deepEqual(profileCommands['generic-owned'][1].args, ['run', 'ci:owned']);
});
