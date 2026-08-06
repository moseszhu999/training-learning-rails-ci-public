import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MARKETPLACE_FUNNEL_ANALYTICS_EXACT_FILES,
  MARKETPLACE_ONBOARDING_ACTIVATION_EXACT_FILES,
  MARKETPLACE_ONBOARDING_WRITER_EXACT_FILES,
  MARKETPLACE_OREGON_ETPL_EXACT_FILES,
  MARKETPLACE_PUBLIC_SOURCE_EXACT_FILES,
  MARKETPLACE_TEXAS_ETPL_EXACT_FILES,
  isMarketplaceFunnelAnalyticsScope,
  isMarketplaceOnboardingActivationScope,
  isMarketplaceOnboardingWriterScope,
  isMarketplaceOregonEtplScope,
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
const oregonEtplFiles = [
  'docs/product/trainingos-oregon-etpl-source-adapter-v1.md',
  'packages/training-marketplace-oregon-etpl/package.json',
  'packages/training-marketplace-oregon-etpl/src/index.d.ts',
  'packages/training-marketplace-oregon-etpl/src/index.mjs',
  'tests/training-marketplace-oregon-etpl-source-adapter-v1.test.mjs',
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

const sourceProfile = { sourcePath: 'packages/training-marketplace-public-source/src/index.mjs', declarationPath: 'packages/training-marketplace-public-source/src/index.d.ts', testPath: 'tests/training-marketplace-public-source-observation-core-v1.test.mjs' };
const funnelProfile = { sourcePath: 'packages/training-marketplace-funnel-analytics/src/index.mjs', declarationPath: 'packages/training-marketplace-funnel-analytics/src/index.d.ts', testPath: 'tests/training-marketplace-funnel-analytics-core-v1.test.mjs' };
const activationProfile = { sourcePath: 'packages/training-marketplace-onboarding-activation/src/index.mjs', declarationPath: 'packages/training-marketplace-onboarding-activation/src/index.d.ts', testPath: 'tests/training-marketplace-onboarding-activation-intent-v1.test.mjs' };
const texasEtplProfile = { sourcePath: 'packages/training-marketplace-texas-etpl/src/index.mjs', declarationPath: 'packages/training-marketplace-texas-etpl/src/index.d.ts', testPath: 'tests/training-marketplace-texas-etpl-source-adapter-v1.test.mjs' };
const oregonEtplProfile = { sourcePath: 'packages/training-marketplace-oregon-etpl/src/index.mjs', declarationPath: 'packages/training-marketplace-oregon-etpl/src/index.d.ts', testPath: 'tests/training-marketplace-oregon-etpl-source-adapter-v1.test.mjs' };
const writerProfile = { sourcePath: 'packages/training-marketplace-onboarding-writer/src/index.mjs', declarationPath: 'packages/training-marketplace-onboarding-writer/src/index.d.ts', testPath: 'tests/training-marketplace-onboarding-writer-v1.test.mjs', pythonPath: 'tests/test_trainingos_marketplace_onboarding_writer_v1.py', databaseScript: '/public/scripts/run-marketplace-onboarding-writer-database.sh' };

test('five lightweight profiles retain exact five-file scopes', () => {
  assert.deepEqual([...MARKETPLACE_PUBLIC_SOURCE_EXACT_FILES].sort(), [...sourceFiles].sort());
  assert.deepEqual([...MARKETPLACE_FUNNEL_ANALYTICS_EXACT_FILES].sort(), [...funnelFiles].sort());
  assert.deepEqual([...MARKETPLACE_ONBOARDING_ACTIVATION_EXACT_FILES].sort(), [...activationFiles].sort());
  assert.deepEqual([...MARKETPLACE_TEXAS_ETPL_EXACT_FILES].sort(), [...texasEtplFiles].sort());
  assert.deepEqual([...MARKETPLACE_OREGON_ETPL_EXACT_FILES].sort(), [...oregonEtplFiles].sort());
  assert.equal(isMarketplacePublicSourceScope(sourceFiles), true);
  assert.equal(isMarketplaceFunnelAnalyticsScope(funnelFiles), true);
  assert.equal(isMarketplaceOnboardingActivationScope(activationFiles), true);
  assert.equal(isMarketplaceTexasEtplScope(texasEtplFiles), true);
  assert.equal(isMarketplaceOregonEtplScope(oregonEtplFiles), true);
  assert.equal(isMarketplacePublicSourceScope([...sourceFiles, 'package.json']), false);
  assert.equal(isMarketplaceTexasEtplScope([...texasEtplFiles, 'apps/training-web/x.ts']), false);
  assert.equal(isMarketplaceOregonEtplScope([...oregonEtplFiles, 'apps/training-web/x.ts']), false);
  assert.equal(isMarketplaceOregonEtplScope(texasEtplFiles), false);
  assert.equal(isMarketplaceTexasEtplScope(oregonEtplFiles), false);
});

test('onboarding writer profile owns exactly eight files and one fixed migration', () => {
  assert.deepEqual([...MARKETPLACE_ONBOARDING_WRITER_EXACT_FILES].sort(), [...writerFiles].sort());
  assert.equal(isMarketplaceOnboardingWriterScope(writerFiles), true);
  assert.equal(isMarketplaceOnboardingWriterScope(writerFiles.slice(1)), false);
  assert.equal(isMarketplaceOnboardingWriterScope([...writerFiles, 'package.json']), false);
  assert.equal(isMarketplaceOnboardingWriterScope(writerFiles.filter((name) => !name.startsWith('supabase/migrations/'))), false);
});

test('lightweight profiles retain the same seven non-database gates', () => {
  const expected = ['install','package-syntax','focused-node-contracts','declaration-typecheck','typecheck','production-build','bundle-verification'];
  assert.deepEqual(marketplaceNextCoreCommands(sourceProfile).map((item) => item.label), expected);
  assert.deepEqual(marketplaceNextCoreCommands(funnelProfile).map((item) => item.label), expected);
  assert.deepEqual(marketplaceNextCoreCommands(activationProfile).map((item) => item.label), expected);
  assert.deepEqual(marketplaceNextCoreCommands(texasEtplProfile).map((item) => item.label), expected);
  assert.deepEqual(marketplaceNextCoreCommands(oregonEtplProfile).map((item) => item.label), expected);
});

test('Oregon profile locks exact scope, zero migrations and fourteen focused Node contracts', () => {
  for (const marker of [
    "suite: 'marketplace-oregon-etpl-source-adapter'",
    'files: MARKETPLACE_OREGON_ETPL_EXACT_FILES',
    'expectedChangedFileCount: 5',
    'expectedMigrationCount: 368',
    "migrationStart: 'none'",
    "migrationEnd: 'none'",
    'expectedNodeCount: 14',
    'expectedPythonCount: 0',
    "sourcePath: 'packages/training-marketplace-oregon-etpl/src/index.mjs'",
    "declarationPath: 'packages/training-marketplace-oregon-etpl/src/index.d.ts'",
    "testPath: 'tests/training-marketplace-oregon-etpl-source-adapter-v1.test.mjs'",
  ]) assert.ok(profileText.includes(marker), marker);
});

test('onboarding writer runs static, database, typecheck, build and bundle gates', () => {
  assert.deepEqual(marketplaceNextCoreCommands(writerProfile).map((item) => item.label), [
    'install','package-syntax','focused-node-contracts','python-static','database-replay','declaration-typecheck','typecheck','production-build','bundle-verification',
  ]);
});

test('fixed contracts lock writer counts, scope and migration range', () => {
  for (const marker of [
    "suite: 'marketplace-onboarding-writer'", 'expectedChangedFileCount: 8', 'expectedMigrationCount: 369',
    "migrationStart: '20260806083000'", "migrationEnd: '20260806083000'", 'expectedNodeCount: 8',
    'expectedPythonCount: 13', 'run-marketplace-onboarding-writer-database.sh',
  ]) assert.ok(profileText.includes(marker), marker);
});

test('database controller reuses the proven exact-binary empty-database architecture', () => {
  for (const marker of [
    'canonical_migration_count=369',
    'base_migration_count=368',
    'supabase_cli_version="2.101.0"',
    'https://github.com/supabase/cli/releases/download/v${supabase_cli_version}/supabase_linux_amd64.tar.gz',
    'postgres_image_primary="supabase/postgres:17.6.1.106"',
    'postgres_image_mirror="public.ecr.aws/supabase/postgres:17.6.1.106"',
    'initialize_empty_workdir "$fresh_one" fresh-one',
    'initialize_empty_workdir "$fresh_two" fresh-two',
    'initialize_empty_workdir "$upgrade" upgrade',
    'fresh-one-empty-start',
    'fresh-two-empty-start',
    'upgrade-copy-forward-migration',
    'explicit_migration_up=PASS',
    'trainingos_marketplace_onboarding_writer_v1_e2e.sql',
    'public_secured_rpcs=2',
    'forbidden_predecessor_exec=0',
    'trap cleanup EXIT',
  ]) assert.ok(databaseText.includes(marker), marker);
  assert.doesNotMatch(databaseText, /npx --yes supabase/);
  assert.doesNotMatch(databaseText, /db reset --local/);
});

test('database controller configures health timeout deterministically after init', () => {
  for (const marker of [
    'configure_health_timeout(){',
    'replacement = \'health_timeout = "5m"\'',
    'configure_health_timeout "$workdir" "$label"',
    'grep -Eq \'^health_timeout = "5m"$\'',
    'grep -Ec \'^health_timeout = \'',
  ]) assert.ok(databaseText.includes(marker), marker);
  assert.doesNotMatch(databaseText, /wait_for_health_timeout/);
  assert.doesNotMatch(databaseText, /seq 1 1800/);
  assert.ok(databaseText.indexOf('sealed "${label}-init"') < databaseText.indexOf('configure_health_timeout "$workdir" "$label"'));
});

test('controllers contain no deployment or production credential path', () => {
  assert.doesNotMatch(profileText, /deploy-site|netlify deploy|vercel deploy|--prod/i);
  assert.doesNotMatch(databaseText, /deploy-site|netlify deploy|vercel deploy|--prod/i);
  assert.doesNotMatch(profileText + databaseText, /SUPABASE_(ACCESS_TOKEN|DB_PASSWORD)/i);
  assert.doesNotMatch(databaseText, /prod-db|service-role-key/i);
});

test('router dispatches next-core profiles before generic fallback', () => {
  assert.match(routerText, /run-marketplace-next-core-profiles\.mjs/);
  const nextCoreIndex = routerText.indexOf('const marketplaceNextCore = await maybeRunMarketplaceNextCoreProfile');
  const baseIndex = routerText.indexOf('const result = await runBaseProfile');
  assert.ok(nextCoreIndex >= 0);
  assert.ok(baseIndex > nextCoreIndex);
});
