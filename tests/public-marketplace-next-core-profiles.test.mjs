import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MARKETPLACE_FUNNEL_ANALYTICS_EXACT_FILES,
  MARKETPLACE_ONBOARDING_ACTIVATION_EXACT_FILES,
  MARKETPLACE_ONBOARDING_WRITER_EXACT_FILES,
  MARKETPLACE_PUBLIC_SOURCE_EXACT_FILES,
  MARKETPLACE_TEXAS_ETPL_EXACT_FILES,
  isMarketplaceFunnelAnalyticsScope,
  isMarketplaceOnboardingActivationScope,
  isMarketplaceOnboardingWriterScope,
  isMarketplacePublicSourceScope,
  isMarketplaceTexasEtplScope,
  marketplaceNextCoreCommands,
} from '../scripts/run-marketplace-next-core-profiles.mjs';

const sourceFiles = [
  'docs/product/trainingos-marketplace-public-source-observation-core-v1.md',
  'packages/training-marketplace-public-source/package.json',
  'packages/training-marketplace-public-source/src/index.d.ts',
  'packages/training-marketplace-public-source/src/index.mjs',
  'tests/training-marketplace-public-source-observation-core-v1.test.mjs',
];

const funnelFiles = [
  'docs/product/trainingos-marketplace-funnel-analytics-core-v1.md',
  'packages/training-marketplace-funnel-analytics/package.json',
  'packages/training-marketplace-funnel-analytics/src/index.d.ts',
  'packages/training-marketplace-funnel-analytics/src/index.mjs',
  'tests/training-marketplace-funnel-analytics-core-v1.test.mjs',
];

const activationFiles = [
  'docs/product/trainingos-marketplace-onboarding-activation-intent-v1.md',
  'packages/training-marketplace-onboarding-activation/package.json',
  'packages/training-marketplace-onboarding-activation/src/index.d.ts',
  'packages/training-marketplace-onboarding-activation/src/index.mjs',
  'tests/training-marketplace-onboarding-activation-intent-v1.test.mjs',
];

const texasEtplFiles = [
  'docs/product/trainingos-texas-etpl-source-adapter-v1.md',
  'packages/training-marketplace-texas-etpl/package.json',
  'packages/training-marketplace-texas-etpl/src/index.d.ts',
  'packages/training-marketplace-texas-etpl/src/index.mjs',
  'tests/training-marketplace-texas-etpl-source-adapter-v1.test.mjs',
];

const writerFiles = [
  'docs/product/trainingos-marketplace-onboarding-writer-v1.md',
  'packages/training-marketplace-onboarding-writer/package.json',
  'packages/training-marketplace-onboarding-writer/src/index.d.ts',
  'packages/training-marketplace-onboarding-writer/src/index.mjs',
  'supabase/migrations/20260806083000_trainingos_marketplace_onboarding_writer_v1.sql',
  'tests/sql/trainingos_marketplace_onboarding_writer_v1_e2e.sql',
  'tests/test_trainingos_marketplace_onboarding_writer_v1.py',
  'tests/training-marketplace-onboarding-writer-v1.test.mjs',
];

const profileText = readFileSync(new URL('../scripts/run-marketplace-next-core-profiles.mjs', import.meta.url), 'utf8');
const databaseText = readFileSync(new URL('../scripts/run-marketplace-onboarding-writer-database.sh', import.meta.url), 'utf8');
const routerText = readFileSync(new URL('../scripts/run-private-profile.mjs', import.meta.url), 'utf8');

const sourceProfile = {
  sourcePath: 'packages/training-marketplace-public-source/src/index.mjs',
  declarationPath: 'packages/training-marketplace-public-source/src/index.d.ts',
  testPath: 'tests/training-marketplace-public-source-observation-core-v1.test.mjs',
};
const funnelProfile = {
  sourcePath: 'packages/training-marketplace-funnel-analytics/src/index.mjs',
  declarationPath: 'packages/training-marketplace-funnel-analytics/src/index.d.ts',
  testPath: 'tests/training-marketplace-funnel-analytics-core-v1.test.mjs',
};
const activationProfile = {
  sourcePath: 'packages/training-marketplace-onboarding-activation/src/index.mjs',
  declarationPath: 'packages/training-marketplace-onboarding-activation/src/index.d.ts',
  testPath: 'tests/training-marketplace-onboarding-activation-intent-v1.test.mjs',
};
const texasEtplProfile = {
  sourcePath: 'packages/training-marketplace-texas-etpl/src/index.mjs',
  declarationPath: 'packages/training-marketplace-texas-etpl/src/index.d.ts',
  testPath: 'tests/training-marketplace-texas-etpl-source-adapter-v1.test.mjs',
};
const writerProfile = {
  sourcePath: 'packages/training-marketplace-onboarding-writer/src/index.mjs',
  declarationPath: 'packages/training-marketplace-onboarding-writer/src/index.d.ts',
  testPath: 'tests/training-marketplace-onboarding-writer-v1.test.mjs',
  pythonPath: 'tests/test_trainingos_marketplace_onboarding_writer_v1.py',
  databaseScript: '/public/scripts/run-marketplace-onboarding-writer-database.sh',
};

test('four lightweight profiles retain exact five-file scopes', () => {
  assert.deepEqual([...MARKETPLACE_PUBLIC_SOURCE_EXACT_FILES].sort(), [...sourceFiles].sort());
  assert.deepEqual([...MARKETPLACE_FUNNEL_ANALYTICS_EXACT_FILES].sort(), [...funnelFiles].sort());
  assert.deepEqual([...MARKETPLACE_ONBOARDING_ACTIVATION_EXACT_FILES].sort(), [...activationFiles].sort());
  assert.deepEqual([...MARKETPLACE_TEXAS_ETPL_EXACT_FILES].sort(), [...texasEtplFiles].sort());
  assert.equal(isMarketplacePublicSourceScope(sourceFiles), true);
  assert.equal(isMarketplaceFunnelAnalyticsScope(funnelFiles), true);
  assert.equal(isMarketplaceOnboardingActivationScope(activationFiles), true);
  assert.equal(isMarketplaceTexasEtplScope(texasEtplFiles), true);
  assert.equal(isMarketplacePublicSourceScope([...sourceFiles, 'package.json']), false);
  assert.equal(isMarketplaceTexasEtplScope([...texasEtplFiles, 'apps/training-web/x.ts']), false);
});

test('onboarding writer profile owns exactly eight files and one fixed migration', () => {
  assert.deepEqual([...MARKETPLACE_ONBOARDING_WRITER_EXACT_FILES].sort(), [...writerFiles].sort());
  assert.equal(isMarketplaceOnboardingWriterScope(writerFiles), true);
  assert.equal(isMarketplaceOnboardingWriterScope(writerFiles.slice(1)), false);
  assert.equal(isMarketplaceOnboardingWriterScope([...writerFiles, 'package.json']), false);
  assert.equal(isMarketplaceOnboardingWriterScope(writerFiles.filter((name) => !name.startsWith('supabase/migrations/'))), false);
});

test('lightweight profiles retain the same seven non-database gates', () => {
  const expected = [
    'install', 'package-syntax', 'focused-node-contracts',
    'declaration-typecheck', 'typecheck', 'production-build', 'bundle-verification',
  ];
  assert.deepEqual(marketplaceNextCoreCommands(sourceProfile).map((item) => item.label), expected);
  assert.deepEqual(marketplaceNextCoreCommands(funnelProfile).map((item) => item.label), expected);
  assert.deepEqual(marketplaceNextCoreCommands(activationProfile).map((item) => item.label), expected);
  assert.deepEqual(marketplaceNextCoreCommands(texasEtplProfile).map((item) => item.label), expected);
});

test('onboarding writer runs static, database, typecheck, build and bundle gates', () => {
  assert.deepEqual(marketplaceNextCoreCommands(writerProfile).map((item) => item.label), [
    'install',
    'package-syntax',
    'focused-node-contracts',
    'python-static',
    'database-replay',
    'declaration-typecheck',
    'typecheck',
    'production-build',
    'bundle-verification',
  ]);
});

test('fixed contracts lock writer counts, scope and migration range', () => {
  for (const marker of [
    "suite: 'marketplace-onboarding-writer'",
    'expectedChangedFileCount: 8',
    'expectedMigrationCount: 369',
    "migrationStart: '20260806083000'",
    "migrationEnd: '20260806083000'",
    'expectedNodeCount: 8',
    'expectedPythonCount: 13',
    'run-marketplace-onboarding-writer-database.sh',
  ]) assert.ok(profileText.includes(marker), marker);
});

test('database controller proves fresh twice, latest-base upgrade, E2E, ACL and cleanup', () => {
  for (const marker of [
    'canonical_migration_count=369',
    'base_migration_count=368',
    '20260806083000_trainingos_marketplace_onboarding_writer_v1.sql',
    'fresh-reset-one',
    'fresh-reset-two',
    'upgrade-copy-migration',
    'trainingos_marketplace_onboarding_writer_v1_e2e.sql',
    "grep -qx 'tables=5'",
    "grep -qx 'authenticated_public_rpc=1'",
    "grep -qx 'forbidden_public_rpc_exec=0'",
    'trap cleanup EXIT',
    'supabase@2.101.0',
  ]) assert.ok(databaseText.includes(marker), marker);
});

test('controllers contain no deployment or production credential path', () => {
  assert.doesNotMatch(profileText, /deploy-site|netlify deploy|vercel deploy|--prod/i);
  assert.doesNotMatch(databaseText, /deploy-site|netlify deploy|vercel deploy|--prod/i);
  assert.doesNotMatch(profileText + databaseText, /SUPABASE_(ACCESS_TOKEN|DB_PASSWORD)/i);
  assert.doesNotMatch(databaseText, /production|prod-db|service-role-key/i);
});

test('router dispatches next-core profiles before generic fallback', () => {
  assert.match(routerText, /run-marketplace-next-core-profiles\.mjs/);
  const nextCoreIndex = routerText.indexOf('const marketplaceNextCore = await maybeRunMarketplaceNextCoreProfile');
  const baseIndex = routerText.indexOf('const result = await runBaseProfile');
  assert.ok(nextCoreIndex >= 0);
  assert.ok(baseIndex > nextCoreIndex);
});
