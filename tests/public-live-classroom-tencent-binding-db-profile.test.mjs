import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  LIVE_CLASSROOM_TENCENT_BINDING_DB_EXACT_FILES,
  LIVE_CLASSROOM_TENCENT_BINDING_DB_RUNNER,
  isLiveClassroomTencentBindingDbScope,
  liveClassroomTencentBindingDbCommands,
  sanitizeLiveClassroomTencentBindingDatabaseFailure,
  sanitizeLiveClassroomTencentBindingDatabaseStatusFile,
} from '../scripts/run-live-classroom-tencent-binding-db-profile.mjs';

test('F3 database selector accepts exactly seven owned files', () => {
  assert.equal(LIVE_CLASSROOM_TENCENT_BINDING_DB_EXACT_FILES.size, 7);
  assert.equal(isLiveClassroomTencentBindingDbScope(LIVE_CLASSROOM_TENCENT_BINDING_DB_EXACT_FILES), true);
  assert.equal(
    isLiveClassroomTencentBindingDbScope([...LIVE_CLASSROOM_TENCENT_BINDING_DB_EXACT_FILES, 'netlify.toml']),
    false,
  );
});

test('F3 database profile hard-requires runtime contracts and public DB runner', () => {
  assert.deepEqual(liveClassroomTencentBindingDbCommands.map((item) => item.label), [
    'install',
    'binding-syntax',
    'endpoint-syntax',
    'focused-node-contracts',
    'focused-python-contracts',
    'database-replay',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  const node = liveClassroomTencentBindingDbCommands.find((item) => item.label === 'focused-node-contracts');
  assert.equal(node?.kind, 'node');
  assert.deepEqual(node?.args, [
    '--test',
    'prototypes/trainingos-agent-mvp-v1/test/tencent-live-classroom-binding.test.mjs',
  ]);
  const python = liveClassroomTencentBindingDbCommands.find((item) => item.label === 'focused-python-contracts');
  assert.equal(python?.kind, 'python');
  assert.deepEqual(python?.args, [
    '-m', 'unittest', '-v',
    'tests.test_trainingos_live_classroom_tencent_binding_v1',
  ]);
  const database = liveClassroomTencentBindingDbCommands.find((item) => item.label === 'database-replay');
  assert.equal(database?.kind, 'database');
  assert.equal(isAbsolute(LIVE_CLASSROOM_TENCENT_BINDING_DB_RUNNER), true);
  assert.equal(database?.args?.[0], LIVE_CLASSROOM_TENCENT_BINDING_DB_RUNNER);
  assert.equal(
    LIVE_CLASSROOM_TENCENT_BINDING_DB_RUNNER.endsWith('/scripts/run-live-classroom-tencent-binding-db-profile.sh'),
    true,
  );
  assert.notEqual(database?.args?.[0], 'scripts/run-live-classroom-tencent-binding-db-profile.sh');
});

test('F3 public DB runner parses as bash before private execution', () => {
  const result = spawnSync('bash', ['-n', LIVE_CLASSROOM_TENCENT_BINDING_DB_RUNNER], {
    encoding: 'utf8',
    shell: false,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('F3 runner fixes migration count/range and runs fresh plus upgrade replay', () => {
  const runner = readFileSync(LIVE_CLASSROOM_TENCENT_BINDING_DB_RUNNER, 'utf8');
  for (const token of [
    'canonical_migration_count=370',
    'base_migration_count=369',
    'migration_file=20260807220000_trainingos_live_classroom_tencent_binding_v1.sql',
    'fresh-reset-one',
    'fresh-reset-two',
    'upgrade-base-reset',
    'upgrade-copy-migration',
    'upgrade-apply',
    'trainingos_live_classroom_tencent_binding_v1_e2e.sql',
    'zero-residue',
    'cleanup=PASS',
  ]) {
    assert.equal(runner.includes(token), true, token);
  }
});

test('F3 DB runner records bounded stage in a dedicated runner-local status file', () => {
  const runner = readFileSync(LIVE_CLASSROOM_TENCENT_BINDING_DB_RUNNER, 'utf8');
  assert.ok(runner.includes('TRAININGOS_TENCENT_BINDING_DB_SAFE_STATUS_FILE'));
  assert.ok(runner.includes('write_status(){'));
  assert.ok(runner.includes('printf \'stage=%s\\n\''));
  assert.ok(runner.includes('chmod 600 "$safe_status_file"'));
  assert.ok(runner.includes('write_status "$CURRENT_STAGE"'));
  assert.ok(runner.includes('write_status "${label}-sql-e2e" "$reason"'));
  assert.ok(runner.includes('write_status complete'));
});

test('F3 status-file diagnostics expose only allowlisted stage and reason', () => {
  assert.equal(
    sanitizeLiveClassroomTencentBindingDatabaseStatusFile('stage=fresh-bootstrap\n'),
    'fresh-bootstrap',
  );
  assert.equal(
    sanitizeLiveClassroomTencentBindingDatabaseStatusFile(
      'stage=fresh-sql-e2e\nreason=TRAININGOS_TENCENT_BINDING_E2E_FINALIZE_FAILED:P0001\n',
    ),
    'fresh-sql-e2e:TRAININGOS_TENCENT_BINDING_E2E_FINALIZE_FAILED:P0001',
  );
  assert.equal(
    sanitizeLiveClassroomTencentBindingDatabaseStatusFile('stage=private-path\nreason=SECRET_TEXT:P0001\n'),
    'unknown',
  );
  assert.equal(
    sanitizeLiveClassroomTencentBindingDatabaseStatusFile('stage=fresh-sql-e2e\nreason=SECRET_TEXT:P0001\n'),
    'fresh-sql-e2e',
  );
});

test('F3 stdout diagnostics retain safe fallback behavior', () => {
  assert.equal(
    sanitizeLiveClassroomTencentBindingDatabaseFailure(
      'LIVE_CLASSROOM_TENCENT_BINDING_DB status=FAIL stage=fresh-bootstrap',
    ),
    'fresh-bootstrap',
  );
  assert.equal(
    sanitizeLiveClassroomTencentBindingDatabaseFailure(
      'LIVE_CLASSROOM_TENCENT_BINDING_DB status=FAIL stage=fresh-sql-e2e reason=TRAININGOS_TENCENT_BINDING_E2E_FINALIZE_FAILED:P0001',
    ),
    'fresh-sql-e2e:TRAININGOS_TENCENT_BINDING_E2E_FINALIZE_FAILED:P0001',
  );
  assert.equal(sanitizeLiveClassroomTencentBindingDatabaseFailure('raw unclassified output'), 'unknown');
});

test('F3 runner never targets hosted or production Supabase', () => {
  const runner = readFileSync(LIVE_CLASSROOM_TENCENT_BINDING_DB_RUNNER, 'utf8').toLowerCase();
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

test('F3 profile is routed before the generic Live Classroom selectors', () => {
  const controller = readFileSync(new URL('../scripts/run-private-profile.mjs', import.meta.url), 'utf8');
  const binding = controller.indexOf('maybeRunLiveClassroomTencentBindingDbProfile(input)');
  const server = controller.indexOf('maybeRunLiveClassroomTencentServerAuthorizationProfile(input)');
  const saas = controller.indexOf('maybeRunSaasMilestoneRoadmapProfile(input)');
  assert.ok(binding >= 0 && server > binding && saas > server);
});
