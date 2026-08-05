import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateInputs } from '../scripts/exact-head-inputs.mjs';
import {
  isMarketplacePublicObjectScope,
  MARKETPLACE_PUBLIC_OBJECT_EXACT_FILES,
  marketplacePublicObjectCommands,
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

test('public object profile runs the canonical ten fixed gates', () => {
  assert.deepEqual(
    marketplacePublicObjectCommands.map((item) => item.label),
    [
      'install',
      'python-contract',
      'package-syntax',
      'object-app-syntax',
      'object-read-model-syntax',
      'object-fixture-syntax',
      'declaration-typecheck',
      'typecheck',
      'production-build',
      'bundle-verification',
    ],
  );
  for (const marker of [
    'EXPECTED_PYTHON_COUNT = 16',
    'EXPECTED_MIGRATION_COUNT = 368',
    'test_trainingos_marketplace_public_object_routes_v1',
    "command('declaration-typecheck'",
    "command('typecheck'",
    "command('production-build'",
    "command('bundle-verification'",
    "selectedSuite: 'marketplace-public-object'",
  ]) assert.ok(profile.includes(marker), marker);
  assert.doesNotMatch(profile, /database-replay/);
  assert.doesNotMatch(profile, /deploy-site|--prod/);
  assert.doesNotMatch(profile, /SUPABASE_(ACCESS_TOKEN|DB_PASSWORD)/);
});

test('public object profile remains the unique top-level route before participation profiles', () => {
  assert.match(router, /maybeRunMarketplacePublicObjectProfile/);
  const publicObjectIndex = router.indexOf('const marketplacePublicObject');
  const participationIndex = router.indexOf('const marketplaceParticipation');
  assert.ok(publicObjectIndex >= 0);
  assert.ok(participationIndex > publicObjectIndex);
});

test('generic-owned request accepts the current public object contract', () => {
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
