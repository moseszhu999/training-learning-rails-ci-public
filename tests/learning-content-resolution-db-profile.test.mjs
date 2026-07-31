import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import {
  sanitizeDatabaseFailure,
  sanitizeDatabaseReason,
  sanitizeDatabaseStage,
  selectLearningContentResolutionDbVariant,
} from '../scripts/run-learning-content-resolution-db-profile.mjs';

const profile = readFileSync('scripts/run-learning-content-resolution-db-profile.mjs', 'utf8');
const runner = readFileSync('scripts/run-learning-content-resolution-db-profile.sh', 'utf8');
const controller = readFileSync('scripts/run-private-profile.mjs', 'utf8');

const projectionFiles = [
  'docs/architecture/trainingos-learning-content-resolution-db-projection-v1.md',
  'supabase/migrations/20260731100000_trainingos_learning_content_resolution_projection_v1.sql',
  'tests/sql/trainingos_learning_content_resolution_projection_v1_e2e.sql',
  'tests/test_trainingos_learning_content_resolution_projection_v1.py',
];

const historyFixFiles = [
  'docs/architecture/trainingos-learning-content-resolution-db-projection-v1.md',
  'supabase/migrations/20260731110000_trainingos_lcr_historical_rights_fix_v1.sql',
  'tests/sql/trainingos_learning_content_resolution_projection_v1_e2e.sql',
  'tests/test_trainingos_learning_content_resolution_projection_v1.py',
];

test('fixed suites are routed only through the existing generic-owned controller', () => {
  assert.match(controller, /maybeRunLearningContentResolutionDbProfile/);
  assert.match(profile, /input\.profile !== 'generic-owned'/);
  assert.match(profile, /learning-content-resolution-db-history-fix/);
  assert.doesNotMatch(profile, /workflow_dispatch|pull_request:/);
});

test('projection and history variants each require an exact four-file scope', () => {
  assert.equal(selectLearningContentResolutionDbVariant(projectionFiles)?.key, 'projection-v1');
  assert.equal(selectLearningContentResolutionDbVariant(historyFixFiles)?.key, 'history-fix');
  assert.equal(selectLearningContentResolutionDbVariant(historyFixFiles.slice(1)), null);
  assert.equal(selectLearningContentResolutionDbVariant([
    ...historyFixFiles,
    'supabase/migrations/20260731110001_unowned.sql',
  ]), null);
});

test('history variant locks migration range count and nine Python contracts', () => {
  for (const token of [
    '20260731110000_trainingos_lcr_historical_rights_fix_v1.sql',
    "migrationStart: '20260731110000'",
    "migrationEnd: '20260731110000'",
    'canonicalMigrationCount: 354',
    'pythonCount: 9',
    "selectedSuite: 'learning-content-resolution-db-history-fix'",
  ]) assert.ok(profile.includes(token), token);
  assert.match(profile, /scope\.expected_changed_file_count === '4'/);
  assert.match(profile, /scope\.migration_start === variant\.migrationStart/);
  assert.match(profile, /scope\.migration_end === variant\.migrationEnd/);
  assert.match(profile, /EXPECTED_MIGRATION_COUNT\) === String\(variant\.canonicalMigrationCount\)/);
});

test('database runner preserves projection replay and adds fixed history replay', () => {
  for (const token of [
    'projection-v1)',
    'history-fix)',
    'canonical_migration_count=354',
    'base_migration_count=353',
    '20260731110000_trainingos_lcr_historical_rights_fix_v1.sql',
    'fresh-reset-one',
    'fresh-reset-two',
    'upgrade-base-reset',
    'upgrade-apply',
    'trainingos_learning_content_resolution_projection_v1_e2e.sql',
    "id::text like '8a010000-%'",
    'fresh=PASS',
    'second_replay=PASS',
    'upgrade=PASS',
    'sql_e2e=PASS',
    'zero_residue=PASS',
    'cleanup=PASS',
  ]) assert.ok(runner.includes(token), token);
  assert.match(profile, /python-contract/);
  assert.match(profile, /typecheck/);
  assert.match(profile, /production-build/);
});

test('failure diagnostics expose only allowlisted stage reason and SQLSTATE', () => {
  const safe = 'LEARNING_CONTENT_RESOLUTION_DB status=FAIL stage=fresh-sql-e2e reason=TRAININGOS_LCR_HISTORY_STATUS_ASSERTION_FAILED:23514';
  assert.equal(sanitizeDatabaseStage(safe), 'fresh-sql-e2e');
  assert.equal(sanitizeDatabaseReason(safe), 'TRAININGOS_LCR_HISTORY_STATUS_ASSERTION_FAILED:23514');
  assert.equal(sanitizeDatabaseFailure(safe), 'fresh-sql-e2e:TRAININGOS_LCR_HISTORY_STATUS_ASSERTION_FAILED:23514');
  assert.equal(sanitizeDatabaseReason(
    'LEARNING_CONTENT_RESOLUTION_DB status=FAIL stage=fresh-sql-e2e reason=TRAININGOS_LCR_PRIVATE_TABLE_FAILED:23514',
  ), '');
  assert.equal(sanitizeDatabaseStage('private SQL error stage=secret-table'), 'unknown');
  assert.match(runner, /sanitize_e2e_reason/);
  assert.match(runner, /TRAININGOS_LCR_HISTORY_STATUS_ASSERTION_FAILED/);
  assert.match(runner, /set \+e[\s\S]*psql[\s\S]*code=\$\?[\s\S]*set -e/);
  assert.doesNotMatch(profile, /readFile\([^)]*fresh-reset-one/);
});

test('runner is read-only to private repository and publishes no artifact or deployment', () => {
  assert.doesNotMatch(runner, /git\s+(push|commit)|gh\s+|netlify|vercel|upload-artifact/);
  assert.doesNotMatch(profile, /git\s+(push|commit)|upload-artifact|deploy/);
  assert.match(runner, /worktree add --detach/);
  assert.match(runner, /tests\/sql\/trainingos_learning_content_resolution_projection_v1_e2e\.sql/);
  assert.match(runner, /rm -rf "\$fresh" "\$upgrade" "\$base_worktree" "\$bin_dir"/);
});

test('database shell runner passes bash syntax and shellcheck', () => {
  const bash = spawnSync('bash', ['-n', 'scripts/run-learning-content-resolution-db-profile.sh'], { encoding: 'utf8' });
  assert.equal(bash.status, 0, bash.stderr);
  const shellcheck = spawnSync('shellcheck', ['scripts/run-learning-content-resolution-db-profile.sh'], { encoding: 'utf8' });
  assert.equal(shellcheck.status, 0, shellcheck.stdout || shellcheck.stderr);
});
