import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  NETLIFY_PRODUCTION_RELEASE_GATE_EXACT_FILES,
  isNetlifyProductionReleaseGateScope,
  netlifyProductionReleaseGateCommands,
} from '../scripts/run-netlify-production-release-gate-profile.mjs';

test('release gate selector accepts exactly five no-migration owned files', () => {
  assert.equal(NETLIFY_PRODUCTION_RELEASE_GATE_EXACT_FILES.size, 5);
  for (const required of [
    'netlify.toml',
    'scripts/trainingos-netlify-production-release-gate.mjs',
    'prototypes/trainingos-agent-mvp-v1/test/netlify-production-release-gate.test.mjs',
    'tests/test_trainingos_netlify_production_release_gate_v1.py',
    'docs/deployment/trainingos-netlify-production-release-gate-v1.md',
  ]) {
    assert.equal(NETLIFY_PRODUCTION_RELEASE_GATE_EXACT_FILES.has(required), true, required);
  }
  assert.equal(isNetlifyProductionReleaseGateScope(NETLIFY_PRODUCTION_RELEASE_GATE_EXACT_FILES), true);
  assert.equal(
    isNetlifyProductionReleaseGateScope([
      ...NETLIFY_PRODUCTION_RELEASE_GATE_EXACT_FILES,
      'supabase/migrations/20990101000000_forbidden.sql',
    ]),
    false,
  );
});

test('release gate profile locks ten stages and exact 10/12/368 contract', () => {
  assert.deepEqual(netlifyProductionReleaseGateCommands.map((item) => item.label), [
    'install',
    'gate-syntax',
    'production-default-skip',
    'deploy-preview-continues',
    'focused-node-contracts',
    'focused-python-contracts',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  const source = readFileSync(
    new URL('../scripts/run-netlify-production-release-gate-profile.mjs', import.meta.url),
    'utf8',
  );
  for (const token of [
    'const EXPECTED_NODE_COUNT = 10;',
    'const EXPECTED_PYTHON_COUNT = 12;',
    'const EXPECTED_CHANGED_FILE_COUNT = 5;',
    'const EXPECTED_MIGRATION_COUNT = 368;',
    'actualMigrationCount === EXPECTED_MIGRATION_COUNT',
    "scope.migration_start === 'none'",
    "scope.migration_end === 'none'",
  ]) {
    assert.equal(source.includes(token), true, token);
  }
});

test('production simulation proves ordinary exact head is skipped with no authorization', () => {
  const command = netlifyProductionReleaseGateCommands.find((item) => item.label === 'production-default-skip');
  assert.equal(command.kind, 'production-skip');
  assert.deepEqual(command.args, ['scripts/trainingos-netlify-production-release-gate.mjs']);
  const source = readFileSync(
    new URL('../scripts/run-netlify-production-release-gate-profile.mjs', import.meta.url),
    'utf8',
  );
  for (const token of [
    "CONTEXT: kind === 'production-skip' ? 'production' : 'deploy-preview'",
    "[PROMOTION_AUTH_ENV]: ''",
    "[PROMOTION_SHA_ENV]: ''",
    "result.status === 0",
    'decision=SKIP_PRODUCTION reason=authorization-disabled',
  ]) {
    assert.equal(source.includes(token), true, token);
  }
});

test('deploy preview simulation proves non-production continues with exit one', () => {
  const command = netlifyProductionReleaseGateCommands.find((item) => item.label === 'deploy-preview-continues');
  assert.equal(command.kind, 'preview-continue');
  assert.deepEqual(command.args, ['scripts/trainingos-netlify-production-release-gate.mjs']);
  const source = readFileSync(
    new URL('../scripts/run-netlify-production-release-gate-profile.mjs', import.meta.url),
    'utf8',
  );
  assert.equal(source.includes("result.status === 1"), true);
  assert.equal(source.includes('decision=CONTINUE_NON_PRODUCTION reason=non-production-context'), true);
});

test('profile contains no Netlify deployment command or production mutation', () => {
  for (const item of netlifyProductionReleaseGateCommands) {
    assert.notEqual(item.executable, 'netlify');
    assert.equal(item.args.includes('--prod'), false);
    assert.equal(item.args.some((value) => String(value).includes('deploy-site')), false);
  }
  const source = readFileSync(
    new URL('../scripts/run-netlify-production-release-gate-profile.mjs', import.meta.url),
    'utf8',
  );
  assert.equal(source.includes('netlify-deploy-services-updater'), false);
  assert.equal(source.includes('TRAININGOS_PRODUCTION_PROMOTION_AUTHORIZED=1'), false);
});

test('focused suites contain only release-gate private contracts', () => {
  const node = netlifyProductionReleaseGateCommands.find((item) => item.label === 'focused-node-contracts');
  const python = netlifyProductionReleaseGateCommands.find((item) => item.label === 'focused-python-contracts');
  assert.deepEqual(node.args, [
    '--test',
    'prototypes/trainingos-agent-mvp-v1/test/netlify-production-release-gate.test.mjs',
  ]);
  assert.deepEqual(python.args, [
    '-m', 'unittest', '-v',
    'tests.test_trainingos_netlify_production_release_gate_v1',
  ]);
});

test('central router selects release gate before other generic-owned scopes', () => {
  const router = readFileSync(new URL('../scripts/run-private-profile.mjs', import.meta.url), 'utf8');
  assert.equal(
    router.includes("export * from './run-netlify-production-release-gate-profile.mjs';"),
    true,
  );
  assert.equal(
    router.includes("import { maybeRunNetlifyProductionReleaseGateProfile } from './run-netlify-production-release-gate-profile.mjs';"),
    true,
  );
  const releaseGate = router.indexOf('maybeRunNetlifyProductionReleaseGateProfile(input)');
  const workspace = router.indexOf('maybeRunWorkspaceIaDensityProfile(input)');
  const marketplace = router.indexOf('maybeRunMarketplaceReviewerAuthorityProfile(input)');
  const liveClassroom = router.indexOf('maybeRunLiveClassroomTencentProbeTargetAttestationProfile(input)');
  assert.ok(releaseGate >= 0 && workspace > releaseGate && marketplace > releaseGate && liveClassroom > releaseGate);
});
