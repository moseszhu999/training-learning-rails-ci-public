import test from 'node:test';
import assert from 'node:assert/strict';

import { formatPublicProfileStatus } from '../scripts/run-private-profile.mjs';

test('student chill exposes only sanitized typecheck coordinates', () => {
  assert.equal(
    formatPublicProfileStatus({
      profile: 'generic-owned',
      selectedSuite: 'student-chill-learning',
      status: 'FAIL:typecheck',
      typecheckDiagnostics: 'apps/training-web/src/example.ts:12:TS2322',
      buildSubstage: 'NOT_APPLICABLE',
    }),
    'FAIL:typecheck|ts=apps/training-web/src/example.ts:12:TS2322|build=NOT_APPLICABLE',
  );
});

test('passing status remains compact', () => {
  assert.equal(
    formatPublicProfileStatus({
      profile: 'generic-owned',
      selectedSuite: 'student-chill-learning',
      status: 'PASS',
      typecheckDiagnostics: 'NOT_APPLICABLE',
      buildSubstage: 'NOT_APPLICABLE',
    }),
    'PASS',
  );
});
