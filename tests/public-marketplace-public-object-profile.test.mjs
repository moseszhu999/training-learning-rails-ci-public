import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateInputs } from '../scripts/exact-head-inputs.mjs';
import {
  isMarketplacePublicObjectScope,
  MARKETPLACE_PUBLIC_OBJECT_EXACT_FILES,
} from '../scripts/run-marketplace-public-object-profile.mjs';

const profile = readFileSync(new URL('../scripts/run-marketplace-public-object-profile.mjs', import.meta.url), 'utf8');
const router = readFileSync(new URL('../scripts/run-private-profile.mjs', import.meta.url), 'utf8');

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

test('public object profile owns exactly eleven non-migration files', () => {
  assert.deepEqual([...MARKETPLACE_PUBLIC_OBJECT_EXACT_FILES].sort(), [...exactFiles].sort());
  assert.equal(isMarketplacePublicObjectScope(exactFiles), true);
  assert.equal(isMarketplacePublicObjectScope([...exactFiles, 'package.json']), false);
  assert.equal(isMarketplacePublicObjectScope(exactFiles.slice(1)), false);
});

test('public object profile runs focused, syntax, declaration, typecheck and build gates', () => {
  for (const marker of [
    'EXPECTED_PYTHON_COUNT = 18',
    'EXPECTED_MIGRATION_COUNT = 364',
    'test_trainingos_marketplace_public_object_routes_v1.py',
    "command('package-syntax'",
    "command('object-app-syntax'",
    "command('object-read-model-syntax'",
    "command('object-fixture-syntax'",
    "command('declaration-typecheck'",
    "command('typecheck'",
    "command('production-build'",
    "command('bundle-verification'",
    "selectedSuite: 'marketplace-public-object'",
  ]) assert.ok(profile.includes(marker), marker);
  assert.doesNotMatch(profile, /deploy/i);
  assert.doesNotMatch(profile, /SUPABASE_(ACCESS_TOKEN|DB_PASSWORD)/);
});

test('public object profile is routed before generic fallbacks', () => {
  assert.match(router, /maybeRunMarketplacePublicObjectProfile/);
  const publicObjectIndex = router.indexOf('const marketplacePublicObject');
  const participationIndex = router.indexOf('const marketplaceParticipation');
  assert.ok(publicObjectIndex >= 0);
  assert.ok(participationIndex > publicObjectIndex);
});

test('generic-owned request accepts the public object contract', () => {
  const result = validateInputs({
    privateExactSha: 'a'.repeat(40),
    expectedBaseSha: 'b'.repeat(40),
    expectedMainSha: '',
    validationProfile: 'generic-owned',
    expectedChangedFileCount: '11',
    expectedMigrationRange: 'none',
    expectedFocusedTestCounts: 'node=0;python=18',
    expectedMigrationCount: '364',
    runFreshReplay: 'false',
    runUpgradeReplay: 'false',
    runApplicationContracts: 'true',
    runTypecheck: 'true',
    runProductionBuild: 'true',
    runCriticalE2E: 'false',
  });
  assert.equal(result.ok, true);
});
