import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LIVE_CLASSROOM_TENCENT_PROVISIONING_EXACT_FILES,
  isLiveClassroomTencentProvisioningScope,
  liveClassroomTencentProvisioningCommands,
} from '../scripts/run-live-classroom-tencent-provisioning-profile.mjs';

test('F4 provisioning selector accepts exactly eight owned files and no migration', () => {
  assert.equal(LIVE_CLASSROOM_TENCENT_PROVISIONING_EXACT_FILES.size, 8);
  assert.equal(isLiveClassroomTencentProvisioningScope(LIVE_CLASSROOM_TENCENT_PROVISIONING_EXACT_FILES), true);
  assert.equal(
    isLiveClassroomTencentProvisioningScope([
      ...LIVE_CLASSROOM_TENCENT_PROVISIONING_EXACT_FILES,
      'supabase/migrations/20260808000000_not_allowed.sql',
    ]),
    false,
  );
});

test('F4 profile requires full F2 F3 F4 regression and production bundle gate', () => {
  assert.deepEqual(liveClassroomTencentProvisioningCommands.map((item) => item.label), [
    'install',
    'api-syntax',
    'authorization-syntax',
    'provisioning-syntax',
    'endpoint-syntax',
    'focused-node-contracts',
    'focused-python-contracts',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  const node = liveClassroomTencentProvisioningCommands.find((item) => item.label === 'focused-node-contracts');
  assert.deepEqual(node?.args, [
    '--test',
    'prototypes/trainingos-agent-mvp-v1/test/tencent-live-classroom-server-authorization.test.mjs',
    'prototypes/trainingos-agent-mvp-v1/test/tencent-live-classroom-binding.test.mjs',
    'prototypes/trainingos-agent-mvp-v1/test/tencent-live-classroom-provisioning.test.mjs',
    'prototypes/trainingos-agent-mvp-v1/test/tencent-live-classroom-provisioning-user-recovery.test.mjs',
  ]);
  const python = liveClassroomTencentProvisioningCommands.find((item) => item.label === 'focused-python-contracts');
  assert.deepEqual(python?.args, [
    '-m', 'unittest', '-v',
    'tests.test_trainingos_live_classroom_tencent_server_authorization_v1',
    'tests.test_trainingos_live_classroom_tencent_binding_v1',
    'tests.test_trainingos_live_classroom_tencent_provisioning_v1',
  ]);
  assert.equal(liveClassroomTencentProvisioningCommands.some((item) => item.label.includes('database')), false);
});

test('F4 fixed input counts are 44 Node, 39 Python, 370 canonical migrations', () => {
  const source = readFileSync(new URL('../scripts/run-live-classroom-tencent-provisioning-profile.mjs', import.meta.url), 'utf8');
  assert.ok(source.includes('EXPECTED_NODE_COUNT = 44'));
  assert.ok(source.includes('EXPECTED_PYTHON_COUNT = 39'));
  assert.ok(source.includes('EXPECTED_CHANGED_FILE_COUNT = 8'));
  assert.ok(source.includes('EXPECTED_MIGRATION_COUNT = 370'));
  assert.ok(source.includes("scope.migration_start === 'none'"));
  assert.ok(source.includes("scope.migration_end === 'none'"));
});

test('F4 selector is delegated before the original F2 exact-scope check', () => {
  const source = readFileSync(new URL('../scripts/run-live-classroom-tencent-server-authorization-profile.mjs', import.meta.url), 'utf8');
  const delegate = source.indexOf('maybeRunLiveClassroomTencentProvisioningProfile(input)');
  const f2Scope = source.indexOf('isLiveClassroomTencentServerAuthorizationScope(files)');
  assert.ok(delegate >= 0 && f2Scope > delegate);
});

test('F4 public profile performs no provider network call or deployment action itself', () => {
  const source = readFileSync(new URL('../scripts/run-live-classroom-tencent-provisioning-profile.mjs', import.meta.url), 'utf8').toLowerCase();
  for (const forbidden of ['curl ', 'wget ', 'netlify deploy', 'vercel deploy', 'createroom']) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});
