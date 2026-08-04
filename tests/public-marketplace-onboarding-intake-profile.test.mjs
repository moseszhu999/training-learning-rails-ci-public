import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { validateInputs } from '../scripts/exact-head-inputs.mjs';
import {
  MARKETPLACE_ONBOARDING_INTAKE_EXACT_FILES,
  isMarketplaceOnboardingIntakeScope,
  marketplaceOnboardingIntakeCommands,
} from '../scripts/run-marketplace-onboarding-intake-profile.mjs';

const exactFiles = [
  'docs/architecture/trainingos-marketplace-draft-onboarding-intake-adapter-v1.md',
  'packages/training-marketplace-onboarding-intake/package.json',
  'packages/training-marketplace-onboarding-intake/src/index.d.ts',
  'packages/training-marketplace-onboarding-intake/src/index.mjs',
  'packages/training-marketplace-onboarding-intake/test/onboarding-intake.test.mjs',
  'tests/test_trainingos_marketplace_draft_onboarding_intake_adapter_v1.py',
];

const profile = readFileSync(
  new URL('../scripts/run-marketplace-onboarding-intake-profile.mjs', import.meta.url),
  'utf8',
);
const router = readFileSync(
  new URL('../scripts/run-marketplace-participation-profile.mjs', import.meta.url),
  'utf8',
);

test('onboarding intake profile owns exactly six non-migration files', () => {
  assert.deepEqual([...MARKETPLACE_ONBOARDING_INTAKE_EXACT_FILES].sort(), [...exactFiles].sort());
  assert.equal(isMarketplaceOnboardingIntakeScope(exactFiles), true);
  assert.equal(isMarketplaceOnboardingIntakeScope(exactFiles.slice(1)), false);
  assert.equal(isMarketplaceOnboardingIntakeScope([...exactFiles, 'package.json']), false);
  assert.equal(isMarketplaceOnboardingIntakeScope([...exactFiles.slice(0, 5), 'supabase/migrations/forbidden.sql']), false);
});

test('profile runs focused adapter, declaration, typecheck and build gates', () => {
  assert.deepEqual(
    marketplaceOnboardingIntakeCommands.map((item) => item.label),
    [
      'install',
      'package-syntax',
      'node-adapter',
      'python-static',
      'declaration-typecheck',
      'typecheck',
      'production-build',
      'bundle-verification',
    ],
  );
  for (const marker of [
    'CANONICAL_MIGRATION_COUNT = 366',
    'EXPECTED_NODE_COUNT = 8',
    'EXPECTED_PYTHON_COUNT = 8',
    'onboarding-intake.test.mjs',
    'test_trainingos_marketplace_draft_onboarding_intake_adapter_v1',
    "selectedSuite: 'marketplace-onboarding-intake'",
  ]) assert.ok(profile.includes(marker), marker);
  assert.doesNotMatch(profile, /database-replay/);
  assert.doesNotMatch(profile, /SUPABASE_(ACCESS_TOKEN|DB_PASSWORD)/);
  assert.doesNotMatch(profile, /deploy/i);
});

test('participation router invokes onboarding intake before database owner profile', () => {
  assert.match(router, /maybeRunMarketplaceOnboardingIntakeProfile/);
  const intakeIndex = router.indexOf('const onboardingIntake = ');
  const databaseIndex = router.indexOf("if (input.profile !== 'generic-owned')");
  assert.ok(intakeIndex >= 0);
  assert.ok(databaseIndex > intakeIndex);
});

test('generic-owned request accepts the fixed intake contract', () => {
  const result = validateInputs({
    privateExactSha: 'a'.repeat(40),
    expectedBaseSha: 'b'.repeat(40),
    expectedMainSha: '',
    validationProfile: 'generic-owned',
    expectedChangedFileCount: '6',
    expectedMigrationRange: 'none',
    expectedFocusedTestCounts: 'node=8;python=8',
    expectedMigrationCount: '366',
    runFreshReplay: 'false',
    runUpgradeReplay: 'false',
    runApplicationContracts: 'true',
    runTypecheck: 'true',
    runProductionBuild: 'true',
    runCriticalE2E: 'false',
  });
  assert.equal(result.ok, true);
});
