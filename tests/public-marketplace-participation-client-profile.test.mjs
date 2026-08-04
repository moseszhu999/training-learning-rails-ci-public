import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { validateInputs } from '../scripts/exact-head-inputs.mjs';
import {
  MARKETPLACE_PARTICIPATION_CLIENT_EXACT_FILES,
  isMarketplaceParticipationClientScope,
  marketplaceParticipationClientCommands,
} from '../scripts/run-marketplace-participation-client-profile.mjs';

const exactFiles = [
  'docs/architecture/trainingos-marketplace-participation-client-adapter-v1.md',
  'packages/training-marketplace-participation-client/package.json',
  'packages/training-marketplace-participation-client/src/index.d.ts',
  'packages/training-marketplace-participation-client/src/index.mjs',
  'packages/training-marketplace-participation-client/test/participation-client.test.mjs',
  'tests/test_trainingos_marketplace_participation_client_adapter_v1.py',
];

const profile = readFileSync(
  new URL('../scripts/run-marketplace-participation-client-profile.mjs', import.meta.url),
  'utf8',
);
const router = readFileSync(new URL('../scripts/run-private-profile.mjs', import.meta.url), 'utf8');

test('participation client profile owns exactly six non-migration files', () => {
  assert.deepEqual([...MARKETPLACE_PARTICIPATION_CLIENT_EXACT_FILES].sort(), [...exactFiles].sort());
  assert.equal(isMarketplaceParticipationClientScope(exactFiles), true);
  assert.equal(isMarketplaceParticipationClientScope(exactFiles.slice(1)), false);
  assert.equal(isMarketplaceParticipationClientScope([...exactFiles, 'package.json']), false);
  assert.equal(isMarketplaceParticipationClientScope([...exactFiles.slice(0, 5), 'supabase/migrations/forbidden.sql']), false);
});

test('profile runs focused adapter, declaration, typecheck and build gates', () => {
  assert.deepEqual(
    marketplaceParticipationClientCommands.map((item) => item.label),
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
    'participation-client.test.mjs',
    'test_trainingos_marketplace_participation_client_adapter_v1',
    "selectedSuite: 'marketplace-participation-client'",
  ]) assert.ok(profile.includes(marker), marker);
  assert.doesNotMatch(profile, /database-replay/);
  assert.doesNotMatch(profile, /SUPABASE_(ACCESS_TOKEN|DB_PASSWORD)/);
  assert.doesNotMatch(profile, /deploy/i);
});

test('router invokes client profile before database Participation owner profile', () => {
  assert.match(router, /maybeRunMarketplaceParticipationClientProfile/);
  const clientIndex = router.indexOf('const marketplaceParticipationClient = ');
  const databaseIndex = router.indexOf('const marketplaceParticipation = ');
  assert.ok(clientIndex >= 0);
  assert.ok(databaseIndex > clientIndex);
});

test('generic-owned request accepts the fixed adapter contract', () => {
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
