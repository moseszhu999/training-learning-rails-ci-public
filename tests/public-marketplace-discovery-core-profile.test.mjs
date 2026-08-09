import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  MARKETPLACE_DISCOVERY_CORE_EXACT_FILES,
  MARKETPLACE_CONTRACTS_FINDER_CORE_EXACT_FILES,
  MARKETPLACE_FIND_A_TENDER_REGISTRY_EXACT_FILES,
  MARKETPLACE_SOURCE_HEALTH_CORE_EXACT_FILES,
  MARKETPLACE_WORKSPACE_TRANSFER_CORE_EXACT_FILES,
  isMarketplaceDiscoveryCoreScope,
  isMarketplaceContractsFinderCoreScope,
  isMarketplaceFindATenderRegistryScope,
  isMarketplaceSourceHealthCoreScope,
  isMarketplaceWorkspaceTransferCoreScope,
  marketplaceDiscoveryCoreCommands,
  marketplaceContractsFinderCoreCommands,
  marketplaceFindATenderRegistryCommands,
  marketplaceSourceHealthCoreCommands,
  marketplaceWorkspaceTransferCoreCommands,
} from '../scripts/run-marketplace-discovery-core-profile.mjs';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');
const historicalFiles = [
  'docs/architecture/trainingos-marketplace-discovery-core-v1.md',
  'packages/training-marketplace-core/examples/marketplace-demo.mjs',
  'packages/training-marketplace-core/package.json',
  'packages/training-marketplace-core/src/index.mjs',
  'packages/training-marketplace-core/test/marketplace-core.test.mjs',
];
const contractsFinderFiles = [
  'packages/training-marketplace-live-ingestion/package.json',
  'packages/training-marketplace-live-ingestion/src/index.d.mts',
  'packages/training-marketplace-live-ingestion/src/index.mjs',
  'tests/training-marketplace-contracts-finder-source-trust-v1.test.mjs',
  'tests/training-marketplace-live-ingestion-v1.test.mjs',
];
const findATenderFiles = [
  'packages/training-marketplace-live-ingestion/package.json',
  'packages/training-marketplace-live-ingestion/src/find-a-tender.d.mts',
  'packages/training-marketplace-live-ingestion/src/find-a-tender.mjs',
  'packages/training-marketplace-live-ingestion/src/sources.d.mts',
  'packages/training-marketplace-live-ingestion/src/sources.mjs',
  'tests/training-marketplace-find-a-tender-v1.test.mjs',
  'tests/training-marketplace-live-ingestion-sources-v1.test.mjs',
];
const sourceHealthFiles = [
  'packages/training-marketplace-source-health/package.json',
  'packages/training-marketplace-source-health/src/index.d.ts',
  'packages/training-marketplace-source-health/src/index.mjs',
  'packages/training-marketplace-source-health/test/source-health.test.mjs',
];
const workspaceTransferFiles = [
  'packages/training-marketplace-workspace-transfer/package.json',
  'packages/training-marketplace-workspace-transfer/src/index.d.mts',
  'packages/training-marketplace-workspace-transfer/src/index.d.ts',
  'packages/training-marketplace-workspace-transfer/src/index.mjs',
  'tests/training-marketplace-workspace-agent-bridge-v1.test.mjs',
];

test('historical Marketplace discovery core remains exact and unchanged', () => {
  assert.deepEqual([...MARKETPLACE_DISCOVERY_CORE_EXACT_FILES].sort(), historicalFiles.sort());
  assert.equal(isMarketplaceDiscoveryCoreScope(historicalFiles), true);
  assert.equal(isMarketplaceContractsFinderCoreScope(historicalFiles), false);
  assert.equal(isMarketplaceFindATenderRegistryScope(historicalFiles), false);
  assert.equal(isMarketplaceSourceHealthCoreScope(historicalFiles), false);
  assert.equal(isMarketplaceWorkspaceTransferCoreScope(historicalFiles), false);
  assert.deepEqual(marketplaceDiscoveryCoreCommands.map((item) => item.label), [
    'install', 'package-syntax', 'package-tests', 'package-demo', 'typecheck', 'production-build',
  ]);
});

test('Contracts Finder child remains exact and disjoint', () => {
  assert.deepEqual([...MARKETPLACE_CONTRACTS_FINDER_CORE_EXACT_FILES].sort(), contractsFinderFiles.sort());
  assert.equal(isMarketplaceContractsFinderCoreScope(contractsFinderFiles), true);
  assert.equal(isMarketplaceDiscoveryCoreScope(contractsFinderFiles), false);
  assert.equal(isMarketplaceFindATenderRegistryScope(contractsFinderFiles), false);
  assert.equal(isMarketplaceSourceHealthCoreScope(contractsFinderFiles), false);
  assert.equal(isMarketplaceWorkspaceTransferCoreScope(contractsFinderFiles), false);
});

test('Find-a-Tender registry child locks exact seven-file zero-migration scope', () => {
  assert.deepEqual([...MARKETPLACE_FIND_A_TENDER_REGISTRY_EXACT_FILES].sort(), findATenderFiles.sort());
  assert.equal(isMarketplaceFindATenderRegistryScope(findATenderFiles), true);
  assert.equal(isMarketplaceDiscoveryCoreScope(findATenderFiles), false);
  assert.equal(isMarketplaceContractsFinderCoreScope(findATenderFiles), false);
  assert.equal(isMarketplaceSourceHealthCoreScope(findATenderFiles), false);
  assert.equal(isMarketplaceWorkspaceTransferCoreScope(findATenderFiles), false);
  assert.equal(isMarketplaceFindATenderRegistryScope([...findATenderFiles, 'netlify.toml']), false);
  assert.equal(isMarketplaceFindATenderRegistryScope(findATenderFiles.slice(1)), false);
});

test('Find-a-Tender registry profile runs exactly eight bounded stages', () => {
  assert.deepEqual(marketplaceFindATenderRegistryCommands.map((item) => item.label), [
    'install', 'find-a-tender-syntax', 'source-registry-syntax', 'find-a-tender-registry-tests',
    'typecheck', 'production-build', 'postbuild-copy', 'bundle-verification',
  ]);
  const serialized = JSON.stringify(marketplaceFindATenderRegistryCommands);
  assert.match(serialized, /training-marketplace-find-a-tender-v1/);
  assert.match(serialized, /training-marketplace-live-ingestion-sources-v1/);
  assert.doesNotMatch(serialized, /curl|wget|playwright|supabase|psql/i);
});

test('Source Health child locks exact four-file zero-migration scope', () => {
  assert.deepEqual([...MARKETPLACE_SOURCE_HEALTH_CORE_EXACT_FILES].sort(), sourceHealthFiles.sort());
  assert.equal(isMarketplaceSourceHealthCoreScope(sourceHealthFiles), true);
  assert.equal(isMarketplaceDiscoveryCoreScope(sourceHealthFiles), false);
  assert.equal(isMarketplaceContractsFinderCoreScope(sourceHealthFiles), false);
  assert.equal(isMarketplaceFindATenderRegistryScope(sourceHealthFiles), false);
  assert.equal(isMarketplaceWorkspaceTransferCoreScope(sourceHealthFiles), false);
  assert.equal(isMarketplaceSourceHealthCoreScope([...sourceHealthFiles, 'netlify.toml']), false);
  assert.equal(isMarketplaceSourceHealthCoreScope(sourceHealthFiles.slice(1)), false);
});

test('Source Health profile runs exactly seven bounded stages', () => {
  assert.deepEqual(marketplaceSourceHealthCoreCommands.map((item) => item.label), [
    'install', 'source-health-syntax', 'source-health-tests', 'typecheck',
    'production-build', 'postbuild-copy', 'bundle-verification',
  ]);
  const serialized = JSON.stringify(marketplaceSourceHealthCoreCommands);
  assert.match(serialized, /training-marketplace-source-health/);
  assert.doesNotMatch(serialized, /curl|wget|playwright|supabase|psql/i);
});

test('Workspace Transfer child locks exact five-file zero-migration scope', () => {
  assert.deepEqual([...MARKETPLACE_WORKSPACE_TRANSFER_CORE_EXACT_FILES].sort(), workspaceTransferFiles.sort());
  assert.equal(isMarketplaceWorkspaceTransferCoreScope(workspaceTransferFiles), true);
  assert.equal(isMarketplaceDiscoveryCoreScope(workspaceTransferFiles), false);
  assert.equal(isMarketplaceContractsFinderCoreScope(workspaceTransferFiles), false);
  assert.equal(isMarketplaceFindATenderRegistryScope(workspaceTransferFiles), false);
  assert.equal(isMarketplaceSourceHealthCoreScope(workspaceTransferFiles), false);
  assert.equal(isMarketplaceWorkspaceTransferCoreScope([...workspaceTransferFiles, 'supabase/migrations/unexpected.sql']), false);
  assert.equal(isMarketplaceWorkspaceTransferCoreScope(workspaceTransferFiles.slice(1)), false);
});

test('Workspace Transfer profile runs exactly seven bounded stages and no execution tools', () => {
  assert.deepEqual(marketplaceWorkspaceTransferCoreCommands.map((item) => item.label), [
    'install', 'workspace-transfer-syntax', 'workspace-transfer-tests', 'typecheck',
    'production-build', 'postbuild-copy', 'bundle-verification',
  ]);
  const serialized = JSON.stringify(marketplaceWorkspaceTransferCoreCommands);
  assert.match(serialized, /training-marketplace-workspace-agent-bridge-v1/);
  assert.doesNotMatch(serialized, /curl|wget|playwright|supabase|psql|storage write|agent execute/i);
});

test('all five metadata contracts remain independently fixed', async () => {
  const source = await read('../scripts/run-marketplace-discovery-core-profile.mjs');
  assert.match(source, /CANONICAL_MIGRATION_COUNT = 360/);
  assert.match(source, /EXPECTED_NODE_COUNT = 13/);
  assert.match(source, /CONTRACTS_FINDER_CANONICAL_MIGRATION_COUNT = 371/);
  assert.match(source, /CONTRACTS_FINDER_EXPECTED_NODE_COUNT = 7/);
  assert.match(source, /FIND_A_TENDER_CANONICAL_MIGRATION_COUNT = 371/);
  assert.match(source, /FIND_A_TENDER_EXPECTED_NODE_COUNT = 10/);
  assert.match(source, /SOURCE_HEALTH_CANONICAL_MIGRATION_COUNT = 371/);
  assert.match(source, /SOURCE_HEALTH_EXPECTED_NODE_COUNT = 5/);
  assert.match(source, /WORKSPACE_TRANSFER_CANONICAL_MIGRATION_COUNT = 371/);
  assert.match(source, /WORKSPACE_TRANSFER_EXPECTED_NODE_COUNT = 9/);
  assert.match(source, /selectedSuite: 'marketplace-discovery-core'/);
  assert.match(source, /selectedSuite: 'marketplace-contracts-finder-core'/);
  assert.match(source, /selectedSuite: 'marketplace-find-a-tender-registry'/);
  assert.match(source, /selectedSuite: 'marketplace-source-health-core'/);
  assert.match(source, /selectedSuite: 'marketplace-workspace-transfer-core'/);
  assert.doesNotMatch(source, /db reset|migration up|psql|supabase start/i);
  assert.doesNotMatch(source, /crawler|scrape|fetch\(|upload-artifact/i);
});

test('all scopes reject migration, product UI and gateway expansion', () => {
  for (const suffix of [
    'supabase/migrations/20260809999999_unexpected.sql',
    'apps/training-web/src/components/Unexpected.tsx',
    'lib/trainingos-agent-gateway/unexpected.mjs',
  ]) {
    assert.equal(isMarketplaceDiscoveryCoreScope([...historicalFiles, suffix]), false);
    assert.equal(isMarketplaceContractsFinderCoreScope([...contractsFinderFiles, suffix]), false);
    assert.equal(isMarketplaceFindATenderRegistryScope([...findATenderFiles, suffix]), false);
    assert.equal(isMarketplaceSourceHealthCoreScope([...sourceHealthFiles, suffix]), false);
    assert.equal(isMarketplaceWorkspaceTransferCoreScope([...workspaceTransferFiles, suffix]), false);
  }
});

test('private profile controller still routes one Marketplace discovery owner before fallback', async () => {
  const source = await read('../scripts/run-private-profile.mjs');
  assert.match(source, /maybeRunMarketplaceDiscoveryCoreProfile/);
  assert.match(source, /run-marketplace-discovery-core-profile/);
  assert.ok(source.indexOf('maybeRunMarketplaceDiscoveryCoreProfile(input)') < source.indexOf('runBaseProfile(input)'));
});
