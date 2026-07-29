import assert from 'node:assert/strict';
import test from 'node:test';
import { formatPublicProfileStatus } from '../../scripts/run-private-profile.mjs';

test('Challenge Web failure status carries only sanitized location fields', () => {
  assert.equal(
    formatPublicProfileStatus({
      profile: 'challenge-web',
      status: 'FAIL:typecheck,production-build',
      typecheckDiagnostics: 'apps/training-web/src/components/InviteChallengeProduct.tsx:123:TS2345',
      buildSubstage: 'learning-workspace-validation',
    }),
    'FAIL:typecheck,production-build|ts=apps/training-web/src/components/InviteChallengeProduct.tsx:123:TS2345|build=learning-workspace-validation',
  );
});

test('PASS and non-Challenge profiles retain the established status format', () => {
  assert.equal(formatPublicProfileStatus({
    profile: 'challenge-web',
    status: 'PASS',
    typecheckDiagnostics: 'NOT_APPLICABLE',
    buildSubstage: 'NOT_APPLICABLE',
  }), 'PASS');
  assert.equal(formatPublicProfileStatus({
    profile: 'teacher-hub',
    status: 'FAIL:typecheck',
    typecheckDiagnostics: 'hidden',
    buildSubstage: 'hidden',
  }), 'FAIL:typecheck');
});
