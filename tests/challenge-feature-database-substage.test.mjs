import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  databaseDiagnosticLabel,
  refineChallengeDatabaseFailure,
} from '../scripts/run-private-profile-stage3.mjs';

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

test('sealed E2E diagnostics refine an existing database substage', () => {
  const result = refineChallengeDatabaseFailure(
    failedResult('FAIL:database-fresh-e2e'),
    ['CHALLENGE_DATABASE status=FAIL stage=fresh-e2e detail=proof-assertion\n'],
  );

  assert.equal(result.status, 'FAIL:database-fresh-e2e-proof-assertion');
  assert.deepEqual(result.failedLabels, ['database-fresh-e2e-proof-assertion']);
});

test('SQLSTATE diagnostics expose only a five-character safe code', () => {
  assert.equal(
    databaseDiagnosticLabel('CHALLENGE_DATABASE status=FAIL stage=fresh-e2e detail=sqlstate-23502\n'),
    'database-fresh-e2e-sqlstate-23502',
  );
  assert.equal(
    databaseDiagnosticLabel('CHALLENGE_DATABASE status=FAIL stage=upgrade-migrations detail=sqlstate-42p13\n'),
    'database-upgrade-migrations-sqlstate-42p13',
  );
});

test('upgrade migration diagnostics allow only a coarse relation category', () => {
  assert.equal(
    databaseDiagnosticLabel('CHALLENGE_DATABASE status=FAIL stage=upgrade-migrations detail=undefined-relation\n'),
    'database-upgrade-migrations-undefined-relation',
  );
});

test('unknown database detail remains the allowlisted stage', () => {
  const original = failedResult('FAIL:database-fresh-e2e');
  const result = refineChallengeDatabaseFailure(original, [
    'CHALLENGE_DATABASE status=FAIL stage=fresh-e2e detail=raw-private-text\n',
  ]);

  assert.equal(result, original);
  assert.equal(result.status, 'FAIL:database-fresh-e2e');
});

test('unknown database stage remains the coarse safe label', () => {
  const original = failedResult();
  const result = refineChallengeDatabaseFailure(original, [
    'CHALLENGE_DATABASE status=FAIL stage=arbitrary-debug-stage detail=proof-assertion\n',
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

test('database runner seals and deletes raw E2E and migration output', () => {
  const script = readFileSync(new URL('../scripts/run-challenge-runtime-database.sh', import.meta.url), 'utf8');
  assert.match(script, /chmod 600 "\$e2e_log"/);
  assert.match(script, />"\$e2e_log" 2>&1/);
  assert.match(script, /rm -f "\$RUNNER_TEMP"\/trainingos-challenge-\*-e2e\.log/);
  assert.match(script, /chmod 600 "\$upgrade_migration_log"/);
  assert.match(script, /migration up --local >"\$upgrade_migration_log" 2>&1/);
  assert.match(script, /rm -f "\$RUNNER_TEMP"\/trainingos-challenge-\*-migration\.log/);
  assert.doesNotMatch(script, /cat "?\$(?:e2e_log|upgrade_migration_log)/);
  assert.match(script, /detail=\$detail/);
  assert.match(script, /SQLSTATE/);
});
