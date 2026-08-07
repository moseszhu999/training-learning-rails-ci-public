import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  LIVE_CLASSROOM_TENCENT_RECONCILIATION_DB_EXACT_FILES,
  LIVE_CLASSROOM_TENCENT_RECONCILIATION_DB_RUNNER,
  isLiveClassroomTencentReconciliationDbScope,
  liveClassroomTencentReconciliationDbCommands,
  sanitizeLiveClassroomTencentReconciliationDatabaseFailure,
  sanitizeLiveClassroomTencentReconciliationDatabaseStatusFile,
} from '../scripts/run-live-classroom-tencent-reconciliation-db-profile.mjs';

test('F5 database selector accepts exactly nine owned files', () => {
  assert.equal(LIVE_CLASSROOM_TENCENT_RECONCILIATION_DB_EXACT_FILES.size, 9);
  assert.equal(
    isLiveClassroomTencentReconciliationDbScope(LIVE_CLASSROOM_TENCENT_RECONCILIATION_DB_EXACT_FILES),
    true,
  );
  assert.equal(
    isLiveClassroomTencentReconciliationDbScope([
      ...LIVE_CLASSROOM_TENCENT_RECONCILIATION_DB_EXACT_FILES,
      'netlify.toml',
    ]),
    false,
  );
});

test('F5 profile locks thirteen stages and combined F2-F5 regression suites', () => {
  assert.deepEqual(liveClassroomTencentReconciliationDbCommands.map((item) => item.label), [
    'install',
    'api-syntax',
    'binding-syntax',
    'provisioning-syntax',
    'reconciliation-syntax',
    'endpoint-syntax',
    'focused-node-contracts',
    'focused-python-contracts',
    'database-replay',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  const node = liveClassroomTencentReconciliationDbCommands.find((item) => item.label === 'focused-node-contracts');
  assert.equal(node?.kind, 'node');
  assert.deepEqual(node?.args, [
    '--test',
    'prototypes/trainingos-agent-mvp-v1/test/tencent-live-classroom-server-authorization.test.mjs',
    'prototypes/trainingos-agent-mvp-v1/test/tencent-live-classroom-binding.test.mjs',
    'prototypes/trainingos-agent-mvp-v1/test/tencent-live-classroom-provisioning.test.mjs',
    'prototypes/trainingos-agent-mvp-v1/test/tencent-live-classroom-provisioning-user-recovery.test.mjs',
    'prototypes/trainingos-agent-mvp-v1/test/tencent-live-classroom-reconciliation.test.mjs',
  ]);
  const python = liveClassroomTencentReconciliationDbCommands.find((item) => item.label === 'focused-python-contracts');
  assert.equal(python?.kind, 'python');
  assert.deepEqual(python?.args, [
    '-m', 'unittest', '-v',
    'tests.test_trainingos_live_classroom_tencent_server_authorization_v1',
    'tests.test_trainingos_live_classroom_tencent_binding_v1',
    'tests.test_trainingos_live_classroom_tencent_provisioning_v1',
    'tests.test_trainingos_live_classroom_tencent_reconciliation_v1',
  ]);
});

test('F5 profile hard-locks counts, migration range and public absolute DB runner', () => {
  const source = readFileSync(new URL('../scripts/run-live-classroom-tencent-reconciliation-db-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    'const EXPECTED_NODE_COUNT = 59;',
    'const EXPECTED_PYTHON_COUNT = 55;',
    'const EXPECTED_CHANGED_FILE_COUNT = 9;',
    'const EXPECTED_MIGRATION_COUNT = 371;',
    "const MIGRATION_START = '20260807221000';",
    "const MIGRATION_END = '20260807221000';",
  ]) {
    assert.equal(source.includes(token), true, token);
  }
  const database = liveClassroomTencentReconciliationDbCommands.find((item) => item.label === 'database-replay');
  assert.equal(database?.kind, 'database');
  assert.equal(isAbsolute(LIVE_CLASSROOM_TENCENT_RECONCILIATION_DB_RUNNER), true);
  assert.equal(database?.args?.[0], LIVE_CLASSROOM_TENCENT_RECONCILIATION_DB_RUNNER);
  assert.equal(
    LIVE_CLASSROOM_TENCENT_RECONCILIATION_DB_RUNNER.endsWith('/scripts/run-live-classroom-tencent-reconciliation-db-profile.sh'),
    true,
  );
  assert.notEqual(database?.args?.[0], 'scripts/run-live-classroom-tencent-reconciliation-db-profile.sh');
});

test('F5 public DB runner parses as bash before private execution', () => {
  const result = spawnSync('bash', ['-n', LIVE_CLASSROOM_TENCENT_RECONCILIATION_DB_RUNNER], {
    encoding: 'utf8',
    shell: false,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('F5 runner fixes 371 head and 370 base migrations with fresh plus upgrade replay', () => {
  const runner = readFileSync(LIVE_CLASSROOM_TENCENT_RECONCILIATION_DB_RUNNER, 'utf8');
  for (const token of [
    'canonical_migration_count=371',
    'base_migration_count=370',
    'migration_file=20260807221000_trainingos_live_classroom_tencent_reconciliation_v1.sql',
    'fresh-reset-one',
    'fresh-reset-two',
    'upgrade-base-reset',
    'upgrade-copy-migration',
    'upgrade-apply',
    'trainingos_live_classroom_tencent_reconciliation_v1_e2e.sql',
    "like '8c010000-%'",
    "like '8c100000-%'",
    'zero-residue',
    'cleanup=PASS',
  ]) {
    assert.equal(runner.includes(token), true, token);
  }
});

test('F5 DB diagnostics expose only allowlisted stage and reason', () => {
  assert.equal(
    sanitizeLiveClassroomTencentReconciliationDatabaseStatusFile('stage=fresh-bootstrap\n'),
    'fresh-bootstrap',
  );
  assert.equal(
    sanitizeLiveClassroomTencentReconciliationDatabaseStatusFile(
      'stage=fresh-sql-e2e\nreason=TRAININGOS_TENCENT_RECONCILIATION_E2E_RECONCILE_FAILED:P0001\n',
    ),
    'fresh-sql-e2e:TRAININGOS_TENCENT_RECONCILIATION_E2E_RECONCILE_FAILED:P0001',
  );
  assert.equal(
    sanitizeLiveClassroomTencentReconciliationDatabaseStatusFile('stage=private-path\nreason=SECRET_TEXT:P0001\n'),
    'unknown',
  );
  assert.equal(
    sanitizeLiveClassroomTencentReconciliationDatabaseStatusFile('stage=fresh-sql-e2e\nreason=SECRET_TEXT:P0001\n'),
    'fresh-sql-e2e',
  );
  assert.equal(
    sanitizeLiveClassroomTencentReconciliationDatabaseFailure(
      'LIVE_CLASSROOM_TENCENT_RECONCILIATION_DB status=FAIL stage=upgrade-sql-e2e reason=TRAININGOS_TENCENT_RECONCILIATION_E2E_FAILED_TERMINAL_FAILED:P0001',
    ),
    'upgrade-sql-e2e:TRAININGOS_TENCENT_RECONCILIATION_E2E_FAILED_TERMINAL_FAILED:P0001',
  );
  assert.equal(
    sanitizeLiveClassroomTencentReconciliationDatabaseFailure('raw unclassified output'),
    'unknown',
  );
});

test('F5 runner never targets hosted or production Supabase', () => {
  const runner = readFileSync(LIVE_CLASSROOM_TENCENT_RECONCILIATION_DB_RUNNER, 'utf8').toLowerCase();
  const hostedEndpointMarker = ['supabase', 'com/rest'].join('.');
  for (const forbidden of [
    '--linked', '--db-url', 'supabase db push', 'supabase link',
    hostedEndpointMarker, 'curl ', 'wget ', 'ssh ', 'netlify deploy', 'vercel deploy',
  ]) {
    assert.equal(runner.includes(forbidden), false, forbidden);
  }
  assert.equal(runner.includes('db reset --local --no-seed'), true);
  assert.equal(runner.includes('migration up --local'), true);
});

test('F3 selector delegates F5 reconciliation before matching F3 scope', () => {
  const binding = readFileSync(new URL('../scripts/run-live-classroom-tencent-binding-db-profile.mjs', import.meta.url), 'utf8');
  const delegate = binding.indexOf('maybeRunLiveClassroomTencentReconciliationDbProfile(input)');
  const ownProfile = binding.indexOf("if (input.profile !== 'generic-owned') return null;");
  const ownScope = binding.indexOf('isLiveClassroomTencentBindingDbScope(files)');
  assert.ok(delegate >= 0 && ownProfile > delegate && ownScope > ownProfile);
});
