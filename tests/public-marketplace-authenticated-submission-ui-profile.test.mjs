import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { validateInputs } from '../scripts/exact-head-inputs.mjs';
import {
  MARKETPLACE_AUTHENTICATED_SUBMISSION_UI_EXACT_FILES,
  isMarketplaceAuthenticatedSubmissionUiScope,
  marketplaceAuthenticatedSubmissionUiCommands,
} from '../scripts/run-marketplace-authenticated-submission-ui-profile.mjs';

const exactFiles = [
  'apps/training-marketplace-web/src/authenticated-submission-runtime.mjs',
  'apps/training-marketplace-web/src/shareable-search-state.mjs',
  'apps/training-marketplace-web/test/authenticated-submission-runtime.test.mjs',
  'docs/architecture/trainingos-marketplace-authenticated-submission-ui-v1.md',
  'tests/test_trainingos_marketplace_authenticated_submission_ui_v1.py',
];

const profile = readFileSync(
  new URL('../scripts/run-marketplace-authenticated-submission-ui-profile.mjs', import.meta.url),
  'utf8',
);
const router = readFileSync(
  new URL('../scripts/run-marketplace-participation-profile.mjs', import.meta.url),
  'utf8',
);

test('authenticated submission UI profile owns exactly five non-migration files', () => {
  assert.deepEqual(
    [...MARKETPLACE_AUTHENTICATED_SUBMISSION_UI_EXACT_FILES].sort(),
    [...exactFiles].sort(),
  );
  assert.equal(isMarketplaceAuthenticatedSubmissionUiScope(exactFiles), true);
  assert.equal(isMarketplaceAuthenticatedSubmissionUiScope(exactFiles.slice(1)), false);
  assert.equal(isMarketplaceAuthenticatedSubmissionUiScope([...exactFiles, 'package.json']), false);
  assert.equal(
    isMarketplaceAuthenticatedSubmissionUiScope([
      ...exactFiles.slice(0, 4),
      'supabase/migrations/forbidden.sql',
    ]),
    false,
  );
  assert.equal(
    isMarketplaceAuthenticatedSubmissionUiScope([
      ...exactFiles.slice(0, 4),
      'apps/training-marketplace-web/object/forbidden.mjs',
    ]),
    false,
  );
});

test('profile runs syntax, focused tests, typecheck and production build gates', () => {
  assert.deepEqual(
    marketplaceAuthenticatedSubmissionUiCommands.map((item) => item.label),
    [
      'install',
      'runtime-syntax',
      'bootstrap-syntax',
      'node-ui',
      'python-static',
      'typecheck',
      'production-build',
      'bundle-verification',
    ],
  );
  for (const marker of [
    'CANONICAL_MIGRATION_COUNT = 366',
    'EXPECTED_NODE_COUNT = 8',
    'EXPECTED_PYTHON_COUNT = 8',
    'authenticated-submission-runtime.test.mjs',
    'test_trainingos_marketplace_authenticated_submission_ui_v1',
    "selectedSuite: 'marketplace-authenticated-submission-ui'",
  ]) assert.ok(profile.includes(marker), marker);
  assert.doesNotMatch(profile, /database-replay/);
  assert.doesNotMatch(profile, /SUPABASE_(ACCESS_TOKEN|DB_PASSWORD)/);
  assert.doesNotMatch(profile, /deploy-site|--prod/);
});

test('participation router invokes authenticated UI before onboarding and database profiles', () => {
  assert.match(router, /maybeRunMarketplaceAuthenticatedSubmissionUiProfile/);
  assert.match(router, /maybeRunMarketplaceOnboardingIntakeProfile/);
  const uiIndex = router.indexOf('const authenticatedSubmissionUi = ');
  const intakeIndex = router.indexOf('const onboardingIntake = ');
  const databaseIndex = router.indexOf("if (input.profile !== 'generic-owned')");
  assert.ok(uiIndex >= 0);
  assert.ok(intakeIndex > uiIndex);
  assert.ok(databaseIndex > intakeIndex);
});

test('generic-owned request accepts the fixed UI contract', () => {
  const result = validateInputs({
    privateExactSha: 'a'.repeat(40),
    expectedBaseSha: 'b'.repeat(40),
    expectedMainSha: '',
    validationProfile: 'generic-owned',
    expectedChangedFileCount: '5',
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
