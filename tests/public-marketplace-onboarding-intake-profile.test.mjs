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

test('onboarding intake profile owns exactly six non-migration files', () => {
  assert.deepEqual([...MARKETPLACE_ONBOARDING_INTAKE_EXACT_FILES].sort(), [...exactFiles].sort());
  assert.equal(isMarketplaceOnboardingIntakeScope(exactFiles), true);
  assert.equal(isMarketplaceOnboardingIntakeScope(exactFiles.slice(1)), false);
  assert.equal(isMarketplaceOnboardingIntakeScope([...exactFiles, 'package.json']), false);
});

test('onboarding intake profile runs fixed focused and build gates', () => {
  assert.deepEqual(marketplaceOnboardingIntakeCommands.map((item) => item.label), [
    'install', 'node-adapter', 'python-static', 'package-syntax',
    'declaration-typecheck', 'typecheck', 'production-build', 'bundle-verification',
  ]);
  const profile = readFileSync(new URL('../scripts/run-marketplace-onboarding-intake-profile.mjs', import.meta.url), 'utf8');
  for (const marker of ['EXPECTED_NODE_COUNT = 8', 'EXPECTED_PYTHON_COUNT = 8', 'EXPECTED_MIGRATION_COUNT = 366', "selectedSuite: 'marketplace-onboarding-intake'"]) assert.ok(profile.includes(marker), marker);
  assert.doesNotMatch(profile, /deploy/i);
});

test('participation router delegates onboarding intake before database fallback', () => {
  const router = readFileSync(new URL('../scripts/run-marketplace-participation-profile.mjs', import.meta.url), 'utf8');
  const intakeIndex = router.indexOf('const onboardingIntake');
  const dbIndex = router.indexOf("if (input.profile !== 'generic-owned')");
  assert.ok(intakeIndex >= 0);
  assert.ok(dbIndex > intakeIndex);
});

test('generic-owned request accepts onboarding intake contract', () => {
  const result = validateInputs({
    privateExactSha: 'a'.repeat(40), expectedBaseSha: 'b'.repeat(40), expectedMainSha: '',
    validationProfile: 'generic-owned', expectedChangedFileCount: '6', expectedMigrationRange: 'none',
    expectedFocusedTestCounts: 'node=8;python=8', expectedMigrationCount: '366',
    runFreshReplay: 'false', runUpgradeReplay: 'false', runApplicationContracts: 'true',
    runTypecheck: 'true', runProductionBuild: 'true', runCriticalE2E: 'false',
  });
  assert.equal(result.ok, true);
});
