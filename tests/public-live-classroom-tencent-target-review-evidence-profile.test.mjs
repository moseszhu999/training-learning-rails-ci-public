import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LIVE_CLASSROOM_TENCENT_TARGET_REVIEW_EVIDENCE_EXACT_FILES,
  isLiveClassroomTencentTargetReviewEvidenceScope,
  liveClassroomTencentTargetReviewEvidenceCommands,
} from '../scripts/run-live-classroom-tencent-target-review-evidence-profile.mjs';

test('F8 selector accepts exactly eight no-migration owned files', () => {
  assert.equal(LIVE_CLASSROOM_TENCENT_TARGET_REVIEW_EVIDENCE_EXACT_FILES.size, 8);
  for (const required of [
    'config/trainingos-live-classroom-tencent-probe-target-reviews-v1.json',
    'lib/trainingos-agent-gateway/tencent-live-classroom-probe-target-reviews.mjs',
    'tests/test_trainingos_live_classroom_tencent_readonly_probe_v1.py',
    'tests/test_trainingos_live_classroom_tencent_target_review_evidence_v1.py',
  ]) {
    assert.equal(LIVE_CLASSROOM_TENCENT_TARGET_REVIEW_EVIDENCE_EXACT_FILES.has(required), true, required);
  }
  assert.equal(
    isLiveClassroomTencentTargetReviewEvidenceScope(LIVE_CLASSROOM_TENCENT_TARGET_REVIEW_EVIDENCE_EXACT_FILES),
    true,
  );
  assert.equal(
    isLiveClassroomTencentTargetReviewEvidenceScope([
      ...LIVE_CLASSROOM_TENCENT_TARGET_REVIEW_EVIDENCE_EXACT_FILES,
      'supabase/migrations/20990101000000_forbidden.sql',
    ]),
    false,
  );
});

test('F8 locks ten command stages plus dual-empty-registry gate', () => {
  assert.deepEqual(liveClassroomTencentTargetReviewEvidenceCommands.map((item) => item.label), [
    'install',
    'review-verifier-syntax',
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
    new URL('../scripts/run-live-classroom-tencent-target-review-evidence-profile.mjs', import.meta.url),
    'utf8',
  );
  assert.equal(source.includes('liveClassroomTencentTargetReviewEvidenceCommands.length + 1'), true);
  assert.equal(source.includes("failedLabels = registriesPassed ? [] : ['target-review-registries-empty']"), true);
});

test('F8 hard-locks 8 files, 371 migrations and combined 91/89 counts', () => {
  const source = readFileSync(
    new URL('../scripts/run-live-classroom-tencent-target-review-evidence-profile.mjs', import.meta.url),
    'utf8',
  );
  for (const token of [
    'const EXPECTED_NODE_COUNT = 91;',
    'const EXPECTED_PYTHON_COUNT = 89;',
    'const EXPECTED_CHANGED_FILE_COUNT = 8;',
    'const EXPECTED_MIGRATION_COUNT = 371;',
    "scope.migration_start === 'none'",
    "scope.migration_end === 'none'",
  ]) {
    assert.equal(source.includes(token), true, token);
  }
});

test('F8 requires both F7 target and F8 review registries to stay empty', () => {
  const source = readFileSync(
    new URL('../scripts/run-live-classroom-tencent-target-review-evidence-profile.mjs', import.meta.url),
    'utf8',
  );
  for (const token of [
    "TARGET_MANIFEST = 'config/trainingos-live-classroom-tencent-probe-targets-v1.json'",
    "REVIEW_REGISTRY = 'config/trainingos-live-classroom-tencent-probe-target-reviews-v1.json'",
    "target?.schema === 'trainingos.tencent-lcic-probe-targets.v1'",
    'target.targets.length === 0',
    "review?.schema === 'trainingos.tencent-lcic-probe-target-reviews.v1'",
    'review.reviews.length === 0',
  ]) {
    assert.equal(source.includes(token), true, token);
  }
});

test('F8 mandatory dry-run carries no execute argument and proves review evidence stayed false', () => {
  const probe = liveClassroomTencentTargetReviewEvidenceCommands.find((item) => item.label === 'probe-dry-run');
  assert.equal(probe?.kind, 'probe');
  assert.deepEqual(probe?.args, ['scripts/trainingos-live-classroom-tencent-readonly-probe.mjs']);
  assert.equal(probe?.args.includes('--execute'), false);
  const source = readFileSync(
    new URL('../scripts/run-live-classroom-tencent-target-review-evidence-profile.mjs', import.meta.url),
    'utf8',
  );
  for (const token of [
    "payload?.status === 'DRY_RUN'",
    'payload?.targetAttestationVerified === false',
    'payload?.targetReviewReferencePresent === false',
    'payload?.targetReviewEvidenceVerified === false',
    'payload?.providerReadAttempted === false',
    'payload?.networkExecutionPerformed === false',
    'payload?.createRoomExecuted === false',
  ]) {
    assert.equal(source.includes(token), true, token);
  }
});

test('F8 regression set includes F2 through F8 review-evidence suites', () => {
  const node = liveClassroomTencentTargetReviewEvidenceCommands.find((item) => item.label === 'focused-node-contracts');
  const python = liveClassroomTencentTargetReviewEvidenceCommands.find((item) => item.label === 'focused-python-contracts');
  assert.equal(node.args.some((value) => value.endsWith('tencent-live-classroom-probe-target-reviews.test.mjs')), true);
  assert.equal(node.args.some((value) => value.endsWith('tencent-live-classroom-probe-targets.test.mjs')), true);
  assert.equal(node.args.some((value) => value.endsWith('tencent-live-classroom-readonly-probe.test.mjs')), true);
  assert.equal(python.args.includes('tests.test_trainingos_live_classroom_tencent_target_review_evidence_v1'), true);
  assert.equal(python.args.includes('tests.test_trainingos_live_classroom_tencent_probe_target_attestation_v1'), true);
  assert.equal(python.args.includes('tests.test_trainingos_live_classroom_tencent_readonly_probe_v1'), true);
});

test('F7 selector delegates F8 first without central router expansion', () => {
  const f7 = readFileSync(
    new URL('../scripts/run-live-classroom-tencent-probe-target-attestation-profile.mjs', import.meta.url),
    'utf8',
  );
  assert.equal(
    f7.includes("import { maybeRunLiveClassroomTencentTargetReviewEvidenceProfile } from './run-live-classroom-tencent-target-review-evidence-profile.mjs';"),
    true,
  );
  const delegation = f7.indexOf('maybeRunLiveClassroomTencentTargetReviewEvidenceProfile(input)');
  const ownScope = f7.indexOf('isLiveClassroomTencentProbeTargetAttestationScope(files)');
  assert.ok(delegation >= 0 && ownScope > delegation);
});
