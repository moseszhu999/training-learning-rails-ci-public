import assert from 'node:assert/strict';
import test from 'node:test';

import { formatPublicProfileStatus } from '../scripts/run-private-profile.mjs';
import { sanitizeTypeScriptDiagnostics } from '../scripts/sanitize-challenge-web-diagnostics.mjs';

test('adds sanitized diagnostics to the selected Youth Learning owned suite', () => {
  assert.equal(
    formatPublicProfileStatus({
      profile: 'generic-owned',
      selectedSuite: 'youth-learning',
      status: 'FAIL:typecheck',
      typecheckDiagnostics: 'packages/training-youth-learning/src/session.ts:44:TS2322',
      buildSubstage: 'NOT_APPLICABLE',
    }),
    'FAIL:typecheck|ts=packages/training-youth-learning/src/session.ts:44:TS2322|build=NOT_APPLICABLE',
  );
});

test('does not alter unrelated generic-owned status', () => {
  assert.equal(
    formatPublicProfileStatus({
      profile: 'generic-owned',
      selectedSuite: null,
      status: 'FAIL:owned-python-contracts',
      typecheckDiagnostics: 'unknown',
      buildSubstage: 'unknown',
    }),
    'FAIL:owned-python-contracts',
  );
});

test('preserves PASS without diagnostic suffixes', () => {
  assert.equal(
    formatPublicProfileStatus({
      profile: 'generic-owned',
      selectedSuite: 'youth-learning',
      status: 'PASS',
      typecheckDiagnostics: 'NOT_APPLICABLE',
      buildSubstage: 'NOT_APPLICABLE',
    }),
    'PASS',
  );
});

test('keeps existing Challenge Web diagnostic behavior', () => {
  assert.equal(
    formatPublicProfileStatus({
      profile: 'challenge-web',
      selectedSuite: null,
      status: 'FAIL:typecheck',
      typecheckDiagnostics: 'apps/training-web/src/example.tsx:10:TS2345',
      buildSubstage: 'NOT_APPLICABLE',
    }),
    'FAIL:typecheck|ts=apps/training-web/src/example.tsx:10:TS2345|build=NOT_APPLICABLE',
  );
});

test('sanitizer publishes only relative file line and TS code', () => {
  const sanitized = sanitizeTypeScriptDiagnostics(`
packages/training-youth-learning/src/session.ts(44,7): error TS2322: private compiler message
/home/runner/work/private/apps/training-web/src/youth-mode/YouthLearningPrototype.tsx(100,3): error TS2769: another private message
`);
  assert.equal(
    sanitized,
    'packages/training-youth-learning/src/session.ts:44:TS2322,apps/training-web/src/youth-mode/YouthLearningPrototype.tsx:100:TS2769',
  );
  assert.equal(sanitized.includes('private compiler message'), false);
  assert.equal(sanitized.includes('/home/runner'), false);
});
