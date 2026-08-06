import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MARKETPLACE_FIRST_PARTY_FUNNEL_RUNTIME_EXACT_FILES,
  MARKETPLACE_FUNNEL_ANALYTICS_EXACT_FILES,
  MARKETPLACE_ONBOARDING_ACTIVATION_EXACT_FILES,
  MARKETPLACE_ONBOARDING_WRITER_EXACT_FILES,
  MARKETPLACE_OREGON_ETPL_EXACT_FILES,
  MARKETPLACE_PUBLIC_SOURCE_EXACT_FILES,
  MARKETPLACE_TEXAS_ETPL_EXACT_FILES,
  isMarketplaceFirstPartyFunnelRuntimeScope,
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

const firstPartyFiles = [
  'docs/product/trainingos-marketplace-first-party-funnel-runtime-v1.md',
  'packages/training-marketplace-funnel-runtime/package.json',
  'packages/training-marketplace-funnel-runtime/src/envelope.mjs',
  'packages/training-marketplace-funnel-runtime/src/index.d.ts',
  'packages/training-marketplace-funnel-runtime/src/index.mjs',
  'packages/training-marketplace-funnel-runtime/src/policy.mjs',
  'tests/training-marketplace-first-party-funnel-runtime-v1.test.mjs',
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

test('all source-specific scopes are exact and mutually distinct', () => {
  assert.deepEqual([...MARKETPLACE_PUBLIC_SOURCE_EXACT_FILES].sort(), [...sourceFiles].sort());
  assert.deepEqual([...MARKETPLACE_FUNNEL_ANALYTICS_EXACT_FILES].sort(), [...funnelFiles].sort());
  assert.deepEqual([...MARKETPLACE_FIRST_PARTY_FUNNEL_RUNTIME_EXACT_FILES].sort(), [...firstPartyFiles].sort());
  assert.deepEqual([...MARKETPLACE_ONBOARDING_ACTIVATION_EXACT_FILES].sort(), [...activationFiles].sort());
  assert.deepEqual([...MARKETPLACE_TEXAS_ETPL_EXACT_FILES].sort(), [...texasEtplFiles].sort());
  assert.deepEqual([...MARKETPLACE_OREGON_ETPL_EXACT_FILES].sort(), [...oregonEtplFiles].sort());

  assert.equal(isMarketplacePublicSourceScope(sourceFiles), true);
  assert.equal(isMarketplaceFunnelAnalyticsScope(funnelFiles), true);
  assert.equal(isMarketplaceFirstPartyFunnelRuntimeScope(firstPartyFiles), true);
  assert.equal(isMarketplaceOnboardingActivationScope(activationFiles), true);
  assert.equal(isMarketplaceTexasEtplScope(texasEtplFiles), true);
  assert.equal(isMarketplaceOregonEtplScope(oregonEtplFiles), true);

  assert.equal(isMarketplaceOregonEtplScope(texasEtplFiles), false);
  assert.equal(isMarketplaceTexasEtplScope(oregonEtplFiles), false);
  assert.equal(isMarketplaceOregonEtplScope([...oregonEtplFiles, 'package.json']), false);
  assert.equal(isMarketplaceOregonEtplScope([...oregonEtplFiles.slice(0, 4), 'apps/public/x.ts']), false);
  assert.equal(isMarketplaceOregonEtplScope([...oregonEtplFiles.slice(0, 4), 'supabase/migrations/20990101000000_x.sql']), false);
});

test('Oregon profile locks five files, zero migrations, fourteen Node contracts and no Python', () => {
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

test('lightweight Oregon profile retains the fixed seven non-database gates', () => {
  const commands = marketplaceNextCoreCommands({
    sourcePath: 'packages/training-marketplace-oregon-etpl/src/index.mjs',
    declarationPath: 'packages/training-marketplace-oregon-etpl/src/index.d.ts',
    testPath: 'tests/training-marketplace-oregon-etpl-source-adapter-v1.test.mjs',
  });
  assert.deepEqual(commands.map((item) => item.label), [
    'install',
    'package-syntax',
    'focused-node-contracts',
    'declaration-typecheck',
    'typecheck',
    'production-build',
    'bundle-verification',
  ]);
  assert.equal(commands.some((item) => item.kind === 'database'), false);
  assert.equal(commands.some((item) => item.kind === 'python'), false);
});

test('onboarding writer remains exactly eight files and one fixed migration', () => {
  assert.deepEqual([...MARKETPLACE_ONBOARDING_WRITER_EXACT_FILES].sort(), [...writerFiles].sort());
  assert.equal(isMarketplaceOnboardingWriterScope(writerFiles), true);
  assert.equal(isMarketplaceOnboardingWriterScope(writerFiles.slice(1)), false);
  assert.match(profileText, /tests\/test_trainingos_marketplace_onboarding_writer_v1\.py/);
});

test('controller contains no deployment, Production credential, or live-probe secret path', () => {
  assert.doesNotMatch(profileText, /deploy-site|netlify deploy|vercel deploy|--prod/i);
  assert.doesNotMatch(profileText, /SUPABASE_(ACCESS_TOKEN|DB_PASSWORD)/i);
  assert.doesNotMatch(profileText, /service-role-key|production database|curl\s+https?:\/\//i);
});
