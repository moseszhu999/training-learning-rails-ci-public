import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { validateInputs } from '../scripts/exact-head-inputs.mjs';
import {
  MARKETPLACE_PUBLIC_OBJECT_ROUTES_EXACT_FILES,
  isMarketplacePublicObjectRoutesScope,
  marketplacePublicObjectRoutesCommands,
} from '../scripts/run-marketplace-public-object-routes-profile.mjs';

const exactFiles = [
  'apps/training-marketplace-web/object/app.mjs',
  'apps/training-marketplace-web/object/fixture-read-model.mjs',
  'apps/training-marketplace-web/object/index.html',
  'apps/training-marketplace-web/object/read-model.mjs',
  'apps/training-marketplace-web/object/styles.css',
  'docs/product/trainingos-marketplace-public-object-routes-v1.md',
  'docs/testing/trainingos-marketplace-public-object-routes-v1-audit.md',
  'packages/training-marketplace-public-object/package.json',
  'packages/training-marketplace-public-object/src/index.d.ts',
  'packages/training-marketplace-public-object/src/index.mjs',
  'tests/test_trainingos_marketplace_public_object_routes_v1.py',
];

const profile = readFileSync(
  new URL('../scripts/run-marketplace-public-object-routes-profile.mjs', import.meta.url),
  'utf8',
);
const router = readFileSync(
  new URL('../scripts/run-marketplace-participation-profile.mjs', import.meta.url),
  'utf8',
);

test('public object routes profile owns exactly eleven non-migration files', () => {
  assert.deepEqual(
    [...MARKETPLACE_PUBLIC_OBJECT_ROUTES_EXACT_FILES].sort(),
    [...exactFiles].sort(),
  );
  assert.equal(isMarketplacePublicObjectRoutesScope(exactFiles), true);
  assert.equal(isMarketplacePublicObjectRoutesScope(exactFiles.slice(1)), false);
  assert.equal(isMarketplacePublicObjectRoutesScope([...exactFiles, 'package.json']), false);
  assert.equal(
    isMarketplacePublicObjectRoutesScope([
      ...exactFiles.slice(0, 10),
      'supabase/migrations/forbidden.sql',
    ]),
    false,
  );
});

test('profile runs syntax, focused Python, typecheck and build gates', () => {
  assert.deepEqual(
    marketplacePublicObjectRoutesCommands.map((item) => item.label),
    [
      'install',
      'object-app-syntax',
      'fixture-read-model-syntax',
      'read-model-syntax',
      'public-object-package-syntax',
      'python-static',
      'typecheck',
      'production-build',
      'bundle-verification',
    ],
  );
  for (const marker of [
    'CANONICAL_MIGRATION_COUNT = 368',
    'EXPECTED_NODE_COUNT = 0',
    'EXPECTED_PYTHON_COUNT = 16',
    'test_trainingos_marketplace_public_object_routes_v1',
    "selectedSuite: 'marketplace-public-object-routes'",
  ]) assert.ok(profile.includes(marker), marker);
  assert.doesNotMatch(profile, /database-replay/);
  assert.doesNotMatch(profile, /SUPABASE_(ACCESS_TOKEN|DB_PASSWORD)/);
  assert.doesNotMatch(profile, /deploy-site|--prod/);
});

test('participation router invokes public object routes before other generic-owned Marketplace slices', () => {
  const publicObjectIndex = router.indexOf('const publicObjectRoutes = ');
  const matchingIndex = router.indexOf('const matchingContext = ');
  assert.ok(publicObjectIndex >= 0);
  assert.ok(matchingIndex > publicObjectIndex);
});

test('generic-owned request accepts the fixed public object routes contract', () => {
  const result = validateInputs({
    privateExactSha: 'a'.repeat(40),
    expectedBaseSha: 'b'.repeat(40),
    expectedMainSha: '',
    validationProfile: 'generic-owned',
    expectedChangedFileCount: '11',
    expectedMigrationRange: 'none',
    expectedFocusedTestCounts: 'node=0;python=16',
    expectedMigrationCount: '368',
    runFreshReplay: 'false',
    runUpgradeReplay: 'false',
    runApplicationContracts: 'true',
    runTypecheck: 'true',
    runProductionBuild: 'true',
    runCriticalE2E: 'false',
  });
  assert.equal(result.ok, true);
});
