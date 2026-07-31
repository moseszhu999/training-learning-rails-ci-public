import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { sanitizeDatabaseStage } from '../scripts/run-learning-content-resolution-db-profile.mjs';

const profile = readFileSync('scripts/run-learning-content-resolution-db-profile.mjs', 'utf8');
const runner = readFileSync('scripts/run-learning-content-resolution-db-profile.sh', 'utf8');
const controller = readFileSync('scripts/run-private-profile.mjs', 'utf8');

test('fixed suite is routed only through the existing generic-owned controller', () => {
  assert.match(controller, /maybeRunLearningContentResolutionDbProfile/);
  assert.match(profile, /input\.profile !== 'generic-owned'/);
  assert.match(profile, /learning-content-resolution-db/);
  assert.doesNotMatch(profile, /workflow_dispatch|pull_request:/);
});

test('exact private scope is four fixed files and one exact migration', () => {
  for (const file of [
    'docs/architecture/trainingos-learning-content-resolution-db-projection-v1.md',
    'supabase/migrations/20260731100000_trainingos_learning_content_resolution_projection_v1.sql',
    'tests/sql/trainingos_learning_content_resolution_projection_v1_e2e.sql',
    'tests/test_trainingos_learning_content_resolution_projection_v1.py',
  ]) assert.ok(profile.includes(file), file);
  assert.match(runner, /EXPECTED_MIGRATION_COUNT" == 353/);
  assert.match(runner, /20260731100000_trainingos_learning_content_resolution_projection_v1\.sql/);
});

test('database runner locks fresh repeat upgrade SQL E2E and zero residue', () => {
  for (const token of [
    'fresh-reset-one',
    'fresh-reset-two',
    'upgrade-base-reset',
    'upgrade-apply',
    'trainingos_learning_content_resolution_projection_v1_e2e.sql',
    "id::text like '8a010000-%'",
    'zero_residue=PASS',
  ]) assert.ok(runner.includes(token), token);
  assert.match(profile, /python-contract/);
  assert.match(profile, /typecheck/);
  assert.match(profile, /production-build/);
});

test('failure diagnostics expose only an allowlisted stage', () => {
  assert.equal(sanitizeDatabaseStage('LEARNING_CONTENT_RESOLUTION_DB status=FAIL stage=fresh-reset-one'), 'fresh-reset-one');
  assert.equal(sanitizeDatabaseStage('private SQL error stage=secret-table'), 'unknown');
  assert.match(runner, /CURRENT_STAGE="fresh-bootstrap"/);
  assert.match(runner, /CURRENT_STAGE="upgrade-sql-e2e"/);
  assert.doesNotMatch(profile, /readFile\([^)]*fresh-reset-one/);
});

test('runner is read-only to private repository and publishes no artifact or deployment', () => {
  assert.doesNotMatch(runner, /git\s+(push|commit)|gh\s+|netlify|vercel|upload-artifact/);
  assert.doesNotMatch(profile, /git\s+(push|commit)|upload-artifact|deploy/);
  assert.match(runner, /worktree add --detach/);
  assert.match(runner, /tests\/sql\/trainingos_learning_content_resolution_projection_v1_e2e\.sql/);
});

test('new shell runner passes bash syntax and shellcheck', () => {
  const bash = spawnSync('bash', ['-n', 'scripts/run-learning-content-resolution-db-profile.sh'], { encoding: 'utf8' });
  assert.equal(bash.status, 0, bash.stderr);
  const shellcheck = spawnSync('shellcheck', ['scripts/run-learning-content-resolution-db-profile.sh'], { encoding: 'utf8' });
  assert.equal(shellcheck.status, 0, shellcheck.stdout || shellcheck.stderr);
});
