import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LIVE_CLASSROOM_TENCENT_PROBE_TARGET_ATTESTATION_EXACT_FILES,
  isLiveClassroomTencentProbeTargetAttestationScope,
  liveClassroomTencentProbeTargetAttestationCommands,
} from '../scripts/run-live-classroom-tencent-probe-target-attestation-profile.mjs';

test('F7 selector accepts exactly seven no-migration owned files', () => {
  assert.equal(LIVE_CLASSROOM_TENCENT_PROBE_TARGET_ATTESTATION_EXACT_FILES.size, 7);
  assert.equal(
    isLiveClassroomTencentProbeTargetAttestationScope(
      LIVE_CLASSROOM_TENCENT_PROBE_TARGET_ATTESTATION_EXACT_FILES,
    ),
    true,
  );
  assert.equal(
    isLiveClassroomTencentProbeTargetAttestationScope([
      ...LIVE_CLASSROOM_TENCENT_PROBE_TARGET_ATTESTATION_EXACT_FILES,
      'supabase/migrations/20990101000000_forbidden.sql',
    ]),
    false,
  );
});

test('F7 profile locks ten command stages plus mandatory empty-manifest gate', () => {
  assert.deepEqual(liveClassroomTencentProbeTargetAttestationCommands.map((item) => item.label), [
    'install',
    'target-verifier-syntax',
    'probe-syntax',
    'probe-dry-run',
    'focused-node-contracts',
    'focused-python-contracts',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  const source = readFileSync(
    new URL('../scripts/run-live-classroom-tencent-probe-target-attestation-profile.mjs', import.meta.url),
    'utf8',
  );
  assert.equal(source.includes('liveClassroomTencentProbeTargetAttestationCommands.length + 1'), true);
  assert.equal(source.includes("failedLabels = manifestPassed ? [] : ['target-manifest-empty']"), true);
});

test('F7 profile hard-locks files, migration count and combined F2-F7 counts', () => {
  const source = readFileSync(
    new URL('../scripts/run-live-classroom-tencent-probe-target-attestation-profile.mjs', import.meta.url),
    'utf8',
  );
  for (const token of [
    'const EXPECTED_NODE_COUNT = 79;',
    'const EXPECTED_PYTHON_COUNT = 77;',
    'const EXPECTED_CHANGED_FILE_COUNT = 7;',
    'const EXPECTED_MIGRATION_COUNT = 371;',
    "scope.migration_start === 'none'",
    "scope.migration_end === 'none'",
  ]) {
    assert.equal(source.includes(token), true, token);
  }
});

test('F7 current exact profile requires repository target manifest to stay empty', () => {
  const source = readFileSync(
    new URL('../scripts/run-live-classroom-tencent-probe-target-attestation-profile.mjs', import.meta.url),
    'utf8',
  );
  for (const token of [
    "TARGET_MANIFEST_RELATIVE_PATH = 'config/trainingos-live-classroom-tencent-probe-targets-v1.json'",
    "payload?.schema === 'trainingos.tencent-lcic-probe-targets.v1'",
    "payload?.policy === 'explicit-reviewed-isolated-non-production-only'",
    'Array.isArray(payload?.targets)',
    'payload.targets.length === 0',
    'const manifestPassed = await targetManifestIsEmpty(input.privateRepoPath)',
  ]) {
    assert.equal(source.includes(token), true, token);
  }
});

test('F7 mandatory dry-run has no execute argument and proves target attestation stayed false', () => {
  const probe = liveClassroomTencentProbeTargetAttestationCommands.find(
    (item) => item.label === 'probe-dry-run',
  );
  assert.equal(probe?.kind, 'probe');
  assert.deepEqual(probe?.args, ['scripts/trainingos-live-classroom-tencent-readonly-probe.mjs']);
  assert.equal(probe?.args.includes('--execute'), false);

  const source = readFileSync(
    new URL('../scripts/run-live-classroom-tencent-probe-target-attestation-profile.mjs', import.meta.url),
    'utf8',
  );
  for (const token of [
    "payload?.status === 'DRY_RUN'",
    'payload?.targetAttestationVerified === false',
    'payload?.targetReviewReferencePresent === false',
    'payload?.providerReadAttempted === false',
    'payload?.networkExecutionPerformed === false',
    'payload?.createRoomExecuted === false',
    'payload?.databaseWritePerformed === false',
  ]) {
    assert.equal(source.includes(token), true, token);
  }
});

test('F7 regressions include F2 through F7 target policy suites', () => {
  const node = liveClassroomTencentProbeTargetAttestationCommands.find(
    (item) => item.label === 'focused-node-contracts',
  );
  const python = liveClassroomTencentProbeTargetAttestationCommands.find(
    (item) => item.label === 'focused-python-contracts',
  );
  for (const path of [
    'tencent-live-classroom-server-authorization.test.mjs',
    'tencent-live-classroom-binding.test.mjs',
    'tencent-live-classroom-provisioning.test.mjs',
    'tencent-live-classroom-provisioning-user-recovery.test.mjs',
    'tencent-live-classroom-reconciliation.test.mjs',
    'tencent-live-classroom-readonly-probe.test.mjs',
    'tencent-live-classroom-probe-targets.test.mjs',
  ]) {
    assert.equal(node.args.some((value) => value.endsWith(path)), true, path);
  }
  for (const module of [
    'tests.test_trainingos_live_classroom_tencent_server_authorization_v1',
    'tests.test_trainingos_live_classroom_tencent_binding_v1',
    'tests.test_trainingos_live_classroom_tencent_provisioning_v1',
    'tests.test_trainingos_live_classroom_tencent_reconciliation_v1',
    'tests.test_trainingos_live_classroom_tencent_readonly_probe_v1',
    'tests.test_trainingos_live_classroom_tencent_probe_target_attestation_v1',
  ]) {
    assert.equal(python.args.includes(module), true, module);
  }
});

test('central router selects F7 before F6 and earlier Tencent selectors', () => {
  const router = readFileSync(new URL('../scripts/run-private-profile.mjs', import.meta.url), 'utf8');
  assert.equal(
    router.includes("export * from './run-live-classroom-tencent-probe-target-attestation-profile.mjs';"),
    true,
  );
  assert.equal(
    router.includes("import { maybeRunLiveClassroomTencentProbeTargetAttestationProfile } from './run-live-classroom-tencent-probe-target-attestation-profile.mjs';"),
    true,
  );
  const f7 = router.indexOf('maybeRunLiveClassroomTencentProbeTargetAttestationProfile(input)');
  const f6 = router.indexOf('maybeRunLiveClassroomTencentReadonlyProbeProfile(input)');
  const binding = router.indexOf('maybeRunLiveClassroomTencentBindingDbProfile(input)');
  const auth = router.indexOf('maybeRunLiveClassroomTencentServerAuthorizationProfile(input)');
  assert.ok(f7 >= 0 && f6 > f7 && binding > f6 && auth > binding);
});
