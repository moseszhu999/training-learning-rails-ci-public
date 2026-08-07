import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LIVE_CLASSROOM_TENCENT_RECONCILIATION_DB_RUNNER,
  sanitizeLiveClassroomTencentReconciliationDatabaseFailure,
  sanitizeLiveClassroomTencentReconciliationDatabaseStatusFile,
} from '../scripts/run-live-classroom-tencent-reconciliation-db-profile.mjs';

test('F5 start diagnostics expose only fixed non-secret classes', () => {
  for (const stage of [
    'fresh-start-migration-init',
    'fresh-start-container-health',
    'fresh-start-docker-start',
    'fresh-start-port-bind',
    'fresh-start-registry-rate-limit',
    'upgrade-start-migration-init',
    'upgrade-start-container-health',
    'upgrade-start-docker-start',
    'upgrade-start-port-bind',
    'upgrade-start-registry-rate-limit',
  ]) {
    assert.equal(
      sanitizeLiveClassroomTencentReconciliationDatabaseStatusFile(`stage=${stage}\n`),
      stage,
    );
    assert.equal(
      sanitizeLiveClassroomTencentReconciliationDatabaseFailure(
        `LIVE_CLASSROOM_TENCENT_RECONCILIATION_DB status=FAIL stage=${stage}`,
      ),
      stage,
    );
  }
  assert.equal(
    sanitizeLiveClassroomTencentReconciliationDatabaseStatusFile('stage=fresh-start-private-error-text\n'),
    'unknown',
  );
});

test('F5 shell classifies start failures without printing raw start logs', () => {
  const runner = readFileSync(LIVE_CLASSROOM_TENCENT_RECONCILIATION_DB_RUNNER, 'utf8');
  for (const token of [
    'classify_start_failure',
    "printf 'migration-init'",
    "printf 'container-health'",
    "printf 'docker-start'",
    "printf 'port-bind'",
    "printf 'registry-rate-limit'",
    'sealed_start fresh-start',
    'sealed_start upgrade-start',
    'CURRENT_STAGE="$safe_stage"',
  ]) {
    assert.equal(runner.includes(token), true, token);
  }
  assert.equal(runner.includes('cat "$log"'), false);
  assert.equal(runner.includes('tail "$log"'), false);
});
