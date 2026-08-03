import assert from 'node:assert/strict';
import test from 'node:test';

import { formatPublicProfileStatus } from '../scripts/run-private-profile.mjs';
import {
  sanitizeTeacherHubPlaywrightFailure,
  teacherHubPlaywrightDiagnosticContract,
} from '../scripts/sanitize-teacher-hub-playwright-diagnostics.mjs';

test('sanitizer emits only the allowlisted failed Teacher Hub case id', () => {
  const log = [
    '  ✓  1 [chromium] › teacher-operations-hub-fixture.spec.ts:14:3 › renders canonical owner context, exact links and inference boundaries',
    '  ✘  2 [chromium] › teacher-operations-hub-fixture.spec.ts:55:3 › keeps loading, empty, error, offline and unavailable states fail-closed',
    '  1) [chromium] › teacher-operations-hub-fixture.spec.ts:55:3 › keeps loading, empty, error, offline and unavailable states fail-closed',
    'private assertion body must never be published',
  ].join('\n');

  assert.equal(sanitizeTeacherHubPlaywrightFailure(log), 'fail-closed-states');
  assert.equal(teacherHubPlaywrightDiagnosticContract.rawLogPublished, false);
  assert.equal(teacherHubPlaywrightDiagnosticContract.privateSourcePublished, false);
});

test('sanitizer reports multiple safe ids deterministically and unknown otherwise', () => {
  const log = [
    '  ✘  6 [chromium] › teacher-operations-hub-fixture.spec.ts:126:5 › visual acceptance tablet-1024',
    '  2) [chromium] › teacher-operations-hub-fixture.spec.ts:126:5 › visual acceptance desktop-1440',
  ].join('\n');

  assert.equal(
    sanitizeTeacherHubPlaywrightFailure(log),
    'visual-desktop-1440+visual-tablet-1024',
  );
  assert.equal(sanitizeTeacherHubPlaywrightFailure('raw failure without an allowlisted title'), 'unknown');
});

test('public status appends the safe Playwright id only for failed teacher-hub runs', () => {
  assert.equal(formatPublicProfileStatus({
    profile: 'teacher-hub',
    selectedSuite: null,
    status: 'FAIL:playwright',
    typecheckDiagnostics: 'NOT_APPLICABLE',
    buildSubstage: 'NOT_APPLICABLE',
    playwrightFailure: 'class-change-reset',
  }), 'FAIL:playwright|pw=class-change-reset');

  assert.equal(formatPublicProfileStatus({
    profile: 'teacher-hub',
    selectedSuite: null,
    status: 'PASS',
    typecheckDiagnostics: 'NOT_APPLICABLE',
    buildSubstage: 'NOT_APPLICABLE',
    playwrightFailure: 'NOT_APPLICABLE',
  }), 'PASS');
});
