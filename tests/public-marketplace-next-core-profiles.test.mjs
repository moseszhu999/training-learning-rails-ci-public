import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MARKETPLACE_FUNNEL_ANALYTICS_EXACT_FILES,
  MARKETPLACE_PUBLIC_SOURCE_EXACT_FILES,
  isMarketplaceFunnelAnalyticsScope,
  isMarketplacePublicSourceScope,
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

const profileText = readFileSync(new URL('../scripts/run-marketplace-next-core-profiles.mjs', import.meta.url), 'utf8');
const routerText = readFileSync(new URL('../scripts/run-private-profile.mjs', import.meta.url), 'utf8');

const sourceProfile = {
  suite: 'marketplace-public-source-observation-core',
  sourcePath: 'packages/training-marketplace-public-source/src/index.mjs',
  declarationPath: 'packages/training-marketplace-public-source/src/index.d.ts',
  testPath: 'tests/training-marketplace-public-source-observation-core-v1.test.mjs',
};

const funnelProfile = {
  suite: 'marketplace-funnel-analytics-core',
  sourcePath: 'packages/training-marketplace-funnel-analytics/src/index.mjs',
  declarationPath: 'packages/training-marketplace-funnel-analytics/src/index.d.ts',
  testPath: 'tests/training-marketplace-funnel-analytics-core-v1.test.mjs',
};

test('public-source profile owns exactly five bounded files', () => {
  assert.deepEqual([...MARKETPLACE_PUBLIC_SOURCE_EXACT_FILES].sort(), [...sourceFiles].sort());
  assert.equal(isMarketplacePublicSourceScope(sourceFiles), true);
  assert.equal(isMarketplacePublicSourceScope(sourceFiles.slice(1)), false);
  assert.equal(isMarketplacePublicSourceScope([...sourceFiles, 'package.json']), false);
  assert.equal(isMarketplacePublicSourceScope(funnelFiles), false);
});

test('funnel profile owns exactly five bounded files', () => {
  assert.deepEqual([...MARKETPLACE_FUNNEL_ANALYTICS_EXACT_FILES].sort(), [...funnelFiles].sort());
  assert.equal(isMarketplaceFunnelAnalyticsScope(funnelFiles), true);
  assert.equal(isMarketplaceFunnelAnalyticsScope(funnelFiles.slice(1)), false);
  assert.equal(isMarketplaceFunnelAnalyticsScope([...funnelFiles, 'apps/training-web/x.ts']), false);
  assert.equal(isMarketplaceFunnelAnalyticsScope(sourceFiles), false);
});

test('both profiles run the same seven fixed non-production gates', () => {
  const expected = [
    'install',
    'package-syntax',
    'focused-node-contracts',
    'declaration-typecheck',
    'typecheck',
    'production-build',
    'bundle-verification',
  ];
  assert.deepEqual(marketplaceNextCoreCommands(sourceProfile).map((item) => item.label), expected);
  assert.deepEqual(marketplaceNextCoreCommands(funnelProfile).map((item) => item.label), expected);
});

test('fixed contracts lock migration count and distinct node counts', () => {
  for (const marker of [
    'const EXPECTED_MIGRATION_COUNT = 368',
    'expectedNodeCount: 10',
    'expectedNodeCount: 11',
    "suite: 'marketplace-public-source-observation-core'",
    "suite: 'marketplace-funnel-analytics-core'",
    "scope.expected_changed_file_count === '5'",
    "scope.migration_start === 'none'",
    "scope.migration_end === 'none'",
  ]) assert.ok(profileText.includes(marker), marker);
});

test('profile never runs database replay deployment or secrets', () => {
  assert.doesNotMatch(profileText, /database-replay|supabase db|db reset|migration up/i);
  assert.doesNotMatch(profileText, /deploy-site|netlify deploy|vercel deploy|--prod/i);
  assert.doesNotMatch(profileText, /SUPABASE_(ACCESS_TOKEN|DB_PASSWORD)|SERVICE_ROLE/i);
});

test('router dispatches next-core profiles before generic fallback', () => {
  assert.match(routerText, /run-marketplace-next-core-profiles\.mjs/);
  const nextCoreIndex = routerText.indexOf('const marketplaceNextCore = await maybeRunMarketplaceNextCoreProfile');
  const baseIndex = routerText.indexOf('const result = await runBaseProfile');
  assert.ok(nextCoreIndex >= 0);
  assert.ok(baseIndex > nextCoreIndex);
});
