import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MARKETPLACE_FIRST_PARTY_FUNNEL_RUNTIME_EXACT_FILES,
  isMarketplaceFirstPartyFunnelRuntimeScope,
  marketplaceNextCoreCommands,
} from '../scripts/run-marketplace-next-core-profiles.mjs';

const runtimeFiles = [
  'docs/product/trainingos-marketplace-first-party-funnel-runtime-v1.md',
  'packages/training-marketplace-funnel-runtime/package.json',
  'packages/training-marketplace-funnel-runtime/src/envelope.mjs',
  'packages/training-marketplace-funnel-runtime/src/index.d.ts',
  'packages/training-marketplace-funnel-runtime/src/index.mjs',
  'packages/training-marketplace-funnel-runtime/src/policy.mjs',
  'tests/training-marketplace-first-party-funnel-runtime-v1.test.mjs',
];

const runtimeProfile = {
  sourcePath: 'packages/training-marketplace-funnel-runtime/src/index.mjs',
  declarationPath: 'packages/training-marketplace-funnel-runtime/src/index.d.ts',
  testPath: 'tests/training-marketplace-first-party-funnel-runtime-v1.test.mjs',
};

const profileText = readFileSync(new URL('../scripts/run-marketplace-next-core-profiles.mjs', import.meta.url), 'utf8');

test('first-party funnel runtime profile owns exactly seven new non-migration files', () => {
  assert.deepEqual([...MARKETPLACE_FIRST_PARTY_FUNNEL_RUNTIME_EXACT_FILES].sort(), [...runtimeFiles].sort());
  assert.equal(isMarketplaceFirstPartyFunnelRuntimeScope(runtimeFiles), true);
  assert.equal(isMarketplaceFirstPartyFunnelRuntimeScope(runtimeFiles.slice(1)), false);
  assert.equal(isMarketplaceFirstPartyFunnelRuntimeScope([...runtimeFiles, 'package.json']), false);
  assert.equal(isMarketplaceFirstPartyFunnelRuntimeScope([...runtimeFiles, 'apps/training-marketplace-web/app.mjs']), false);
});

test('first-party funnel runtime receives the seven fixed non-database gates', () => {
  assert.deepEqual(marketplaceNextCoreCommands(runtimeProfile).map((item) => item.label), [
    'install',
    'package-syntax',
    'focused-node-contracts',
    'declaration-typecheck',
    'typecheck',
    'production-build',
    'bundle-verification',
  ]);
});

test('fixed profile locks exact counts and no database replay', () => {
  for (const marker of [
    "suite: 'marketplace-first-party-funnel-runtime'",
    'expectedChangedFileCount: 7',
    'expectedMigrationCount: 368',
    "migrationStart: 'none'",
    "migrationEnd: 'none'",
    'expectedNodeCount: 15',
    'expectedPythonCount: 0',
    'training-marketplace-first-party-funnel-runtime-v1.test.mjs',
  ]) assert.ok(profileText.includes(marker), marker);
  assert.doesNotMatch(profileText, /marketplace-first-party-funnel-runtime[\s\S]{0,800}databaseScript/);
});

test('controller contains no deployment or production credential path', () => {
  assert.doesNotMatch(profileText, /deploy-site|netlify deploy|vercel deploy|--prod/i);
  assert.doesNotMatch(profileText, /SUPABASE_(ACCESS_TOKEN|DB_PASSWORD)/i);
});
