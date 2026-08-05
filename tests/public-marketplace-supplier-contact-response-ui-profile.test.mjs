import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { validateInputs } from '../scripts/exact-head-inputs.mjs';
import {
  MARKETPLACE_SUPPLIER_CONTACT_RESPONSE_UI_EXACT_FILES,
  isMarketplaceSupplierContactResponseUiScope,
  marketplaceSupplierContactResponseUiCommands,
} from '../scripts/run-marketplace-supplier-contact-response-ui-profile.mjs';

const exactFiles = [
  'apps/training-marketplace-web/src/shareable-search-state.mjs',
  'apps/training-marketplace-web/src/supplier-contact-response-runtime.mjs',
  'apps/training-marketplace-web/test/supplier-contact-response-runtime.test.mjs',
  'docs/architecture/trainingos-marketplace-supplier-contact-response-ui-v1.md',
  'tests/test_trainingos_marketplace_supplier_contact_response_ui_v1.py',
];

const profile = readFileSync(
  new URL('../scripts/run-marketplace-supplier-contact-response-ui-profile.mjs', import.meta.url),
  'utf8',
);
const router = readFileSync(
  new URL('../scripts/run-marketplace-participation-profile.mjs', import.meta.url),
  'utf8',
);

test('supplier contact response UI profile owns exactly five non-migration files', () => {
  assert.deepEqual(
    [...MARKETPLACE_SUPPLIER_CONTACT_RESPONSE_UI_EXACT_FILES].sort(),
    [...exactFiles].sort(),
  );
  assert.equal(isMarketplaceSupplierContactResponseUiScope(exactFiles), true);
  assert.equal(isMarketplaceSupplierContactResponseUiScope(exactFiles.slice(1)), false);
  assert.equal(isMarketplaceSupplierContactResponseUiScope([...exactFiles, 'package.json']), false);
  assert.equal(
    isMarketplaceSupplierContactResponseUiScope([
      ...exactFiles.slice(0, 4),
      'supabase/migrations/forbidden.sql',
    ]),
    false,
  );
});

test('profile runs syntax, focused tests, typecheck and production build gates', () => {
  assert.deepEqual(
    marketplaceSupplierContactResponseUiCommands.map((item) => item.label),
    [
      'install',
      'supplier-response-runtime-syntax',
      'bootstrap-syntax',
      'node-supplier-response-ui',
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
    'supplier-contact-response-runtime.test.mjs',
    'test_trainingos_marketplace_supplier_contact_response_ui_v1',
    "selectedSuite: 'marketplace-supplier-contact-response-ui'",
  ]) assert.ok(profile.includes(marker), marker);
  assert.doesNotMatch(profile, /database-replay/);
  assert.doesNotMatch(profile, /SUPABASE_(ACCESS_TOKEN|DB_PASSWORD)/);
  assert.doesNotMatch(profile, /deploy-site|--prod/);
});

test('participation router invokes supplier response after contact UI and before legacy submission UI', () => {
  const contactIndex = router.indexOf('const authenticatedContactUi = ');
  const supplierIndex = router.indexOf('const supplierContactResponseUi = ');
  const submissionIndex = router.indexOf('const authenticatedSubmissionUi = ');
  assert.ok(contactIndex >= 0);
  assert.ok(supplierIndex > contactIndex);
  assert.ok(submissionIndex > supplierIndex);
});

test('generic-owned request accepts the fixed supplier response UI contract', () => {
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
