import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LIVE_CLASSROOM_TENCENT_READONLY_PROBE_EXACT_FILES,
  isLiveClassroomTencentReadonlyProbeScope,
  liveClassroomTencentReadonlyProbeCommands,
} from '../scripts/run-live-classroom-tencent-readonly-probe-profile.mjs';

test('F6 selector accepts exactly four no-migration owned files', () => {
  assert.equal(LIVE_CLASSROOM_TENCENT_READONLY_PROBE_EXACT_FILES.size, 4);
  assert.equal(
    isLiveClassroomTencentReadonlyProbeScope(LIVE_CLASSROOM_TENCENT_READONLY_PROBE_EXACT_FILES),
    true,
  );
  assert.equal(
    isLiveClassroomTencentReadonlyProbeScope([
      ...LIVE_CLASSROOM_TENCENT_READONLY_PROBE_EXACT_FILES,
      'supabase/migrations/20990101000000_forbidden.sql',
    ]),
    false,
  );
});

test('F6 fixed profile locks nine stages and default dry-run command', () => {
  assert.deepEqual(liveClassroomTencentReadonlyProbeCommands.map((item) => item.label), [
    'install',
    'probe-syntax',
    'probe-dry-run',
    'focused-node-contracts',
    'focused-python-contracts',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  const probe = liveClassroomTencentReadonlyProbeCommands.find((item) => item.label === 'probe-dry-run');
  assert.equal(probe?.kind, 'probe');
  assert.deepEqual(probe?.args, ['scripts/trainingos-live-classroom-tencent-readonly-probe.mjs']);
  assert.equal(probe?.args.includes('--execute'), false);
});

test('F6 profile hard-locks files, migration count and combined F2-F6 test counts', () => {
  const source = readFileSync(new URL('../scripts/run-live-classroom-tencent-readonly-probe-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    'const EXPECTED_NODE_COUNT = 69;',
    'const EXPECTED_PYTHON_COUNT = 67;',
    'const EXPECTED_CHANGED_FILE_COUNT = 4;',
    'const EXPECTED_MIGRATION_COUNT = 371;',
    "scope.migration_start === 'none'",
    "scope.migration_end === 'none'",
  ]) {
    assert.equal(source.includes(token), true, token);
  }
});

test('F6 dry-run sealed output must prove no provider read or write execution', () => {
  const source = readFileSync(new URL('../scripts/run-live-classroom-tencent-readonly-probe-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    "payload?.status === 'DRY_RUN'",
    'payload?.executeRequested === false',
    'payload?.executionAuthorized === false',
    'payload?.providerReadAttempted === false',
    'payload?.networkExecutionPerformed === false',
    'payload?.providerWritePerformed === false',
    'payload?.createRoomExecuted === false',
    'payload?.databaseWritePerformed === false',
    'payload?.roomDetailsReturned === false',
  ]) {
    assert.equal(source.includes(token), true, token);
  }
});

test('F6 combined regressions include F2 through F6 without network test flags', () => {
  const node = liveClassroomTencentReadonlyProbeCommands.find((item) => item.label === 'focused-node-contracts');
  const python = liveClassroomTencentReadonlyProbeCommands.find((item) => item.label === 'focused-python-contracts');
  for (const path of [
    'tencent-live-classroom-server-authorization.test.mjs',
    'tencent-live-classroom-binding.test.mjs',
    'tencent-live-classroom-provisioning.test.mjs',
    'tencent-live-classroom-provisioning-user-recovery.test.mjs',
    'tencent-live-classroom-reconciliation.test.mjs',
    'tencent-live-classroom-readonly-probe.test.mjs',
  ]) {
    assert.equal(node.args.some((value) => value.endsWith(path)), true, path);
  }
  for (const module of [
    'tests.test_trainingos_live_classroom_tencent_server_authorization_v1',
    'tests.test_trainingos_live_classroom_tencent_binding_v1',
    'tests.test_trainingos_live_classroom_tencent_provisioning_v1',
    'tests.test_trainingos_live_classroom_tencent_reconciliation_v1',
    'tests.test_trainingos_live_classroom_tencent_readonly_probe_v1',
  ]) {
    assert.equal(python.args.includes(module), true, module);
  }
  assert.equal(node.args.includes('--execute'), false);
  assert.equal(python.args.includes('--execute'), false);
});

test('central router selects F6 before F3/F5 database and F2 authorization selectors', () => {
  const router = readFileSync(new URL('../scripts/run-private-profile.mjs', import.meta.url), 'utf8');
  assert.equal(router.includes("export * from './run-live-classroom-tencent-readonly-probe-profile.mjs';"), true);
  assert.equal(router.includes("import { maybeRunLiveClassroomTencentReadonlyProbeProfile } from './run-live-classroom-tencent-readonly-probe-profile.mjs';"), true);
  const probe = router.indexOf('maybeRunLiveClassroomTencentReadonlyProbeProfile(input)');
  const binding = router.indexOf('maybeRunLiveClassroomTencentBindingDbProfile(input)');
  const auth = router.indexOf('maybeRunLiveClassroomTencentServerAuthorizationProfile(input)');
  assert.ok(probe >= 0 && binding > probe && auth > binding);
});
