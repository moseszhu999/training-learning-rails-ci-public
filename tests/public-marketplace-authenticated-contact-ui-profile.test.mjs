import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { validateInputs } from '../scripts/exact-head-inputs.mjs';
import {
  MARKETPLACE_AUTHENTICATED_CONTACT_UI_EXACT_FILES,
  isMarketplaceAuthenticatedContactUiScope,
  marketplaceAuthenticatedContactUiCommands,
} from '../scripts/run-marketplace-authenticated-contact-ui-profile.mjs';

const exactFiles = [
  'apps/training-marketplace-web/src/authenticated-contact-runtime.mjs',
  'apps/training-marketplace-web/src/shareable-search-state.mjs',
  'apps/training-marketplace-web/test/authenticated-contact-runtime.test.mjs',
  'docs/architecture/trainingos-marketplace-authenticated-contact-ui-v1.md',
  'tests/test_trainingos_marketplace_authenticated_contact_ui_v1.py',
];

const profile = readFileSync(
  new URL('../scripts/run-marketplace-authenticated-contact-ui-profile.mjs', import.meta.url),
  'utf8',
);
const router = readFileSync(
  new URL('../scripts/run-marketplace-participation-profile.mjs', import.meta.url),
  'utf8',
);

test('authenticated contact UI profile owns exactly five non-migration files', () => {
  assert.deepEqual(
    [...MARKETPLACE_AUTHENTICATED_CONTACT_UI_EXACT_FILES].sort(),
    [...exactFiles].sort(),
  );
  assert.equal(isMarketplaceAuthenticatedContactUiScope(exactFiles), true);
  assert.equal(isMarketplaceAuthenticatedContactUiScope(exactFiles.slice(1)), false);
  assert.equal(isMarketplaceAuthenticatedContactUiScope([...exactFiles, 'package.json']), false);
  assert.equal(
    isMarketplaceAuthenticatedContactUiScope([
      ...exactFiles.slice(0, 4),
      'supabase/migrations/forbidden.sql',
    ]),
    false,
  );
});

test('profile runs syntax, focused tests, typecheck and production build gates', () => {
  assert.deepEqual(
    marketplaceAuthenticatedContactUiCommands.map((item) => item.label),
    [
      'install',
      'contact-runtime-syntax',
      'bootstrap-syntax',
      'node-contact-ui',
      'python-static',
      'typecheck',
      'production-build',
      'bundle-verification',
    ],
  );
  for (const marker of [
    'CANONICAL_MIGRATION_COUNT = 367',
    'EXPECTED_NODE_COUNT = 6',
    'EXPECTED_PYTHON_COUNT = 5',
    'authenticated-contact-runtime.test.mjs',
    'test_trainingos_marketplace_authenticated_contact_ui_v1',
    "selectedSuite: 'marketplace-authenticated-contact-ui'",
  ]) assert.ok(profile.includes(marker), marker);
  assert.doesNotMatch(profile, /database-replay/);
  assert.doesNotMatch(profile, /SUPABASE_(ACCESS_TOKEN|DB_PASSWORD)/);
  assert.doesNotMatch(profile, /deploy-site|--prod/);
});

test('participation router invokes contact UI after selection intent and before legacy submission UI', () => {
  assert.match(router, /maybeRunMarketplaceSelectionIntentProfile/);
  assert.match(router, /maybeRunMarketplaceAuthenticatedContactUiProfile/);
  assert.match(router, /maybeRunMarketplaceAuthenticatedSubmissionUiProfile/);
  const selectionIndex = router.indexOf('const selectionIntent = ');
  const contactIndex = router.indexOf('const authenticatedContactUi = ');
  const submissionIndex = router.indexOf('const authenticatedSubmissionUi = ');
  assert.ok(selectionIndex >= 0);
  assert.ok(contactIndex > selectionIndex);
  assert.ok(submissionIndex > contactIndex);
});

test('generic-owned request accepts the fixed authenticated contact UI contract', () => {
  const result = validateInputs({
    privateExactSha: 'a'.repeat(40),
    expectedBaseSha: 'b'.repeat(40),
    expectedMainSha: '',
    validationProfile: 'generic-owned',
    expectedChangedFileCount: '5',
    expectedMigrationRange: 'none',
    expectedFocusedTestCounts: 'node=6;python=5',
    expectedMigrationCount: '367',
    runFreshReplay: 'false',
    runUpgradeReplay: 'false',
    runApplicationContracts: 'true',
    runTypecheck: 'true',
    runProductionBuild: 'true',
    runCriticalE2E: 'false',
  });
  assert.equal(result.ok, true);
});
