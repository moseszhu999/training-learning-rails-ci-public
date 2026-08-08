import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  MARKETPLACE_DISCOVERY_CORE_EXACT_FILES,
  MARKETPLACE_CONTRACTS_FINDER_CORE_EXACT_FILES,
  isMarketplaceDiscoveryCoreScope,
  isMarketplaceContractsFinderCoreScope,
  marketplaceDiscoveryCoreCommands,
  marketplaceContractsFinderCoreCommands,
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

test('historical marketplace discovery core remains exact and unchanged', () => {
  assert.deepEqual([...MARKETPLACE_DISCOVERY_CORE_EXACT_FILES].sort(), historicalFiles.sort());
  assert.equal(isMarketplaceDiscoveryCoreScope(historicalFiles), true);
  assert.equal(isMarketplaceContractsFinderCoreScope(historicalFiles), false);
  assert.deepEqual(marketplaceDiscoveryCoreCommands.map((item) => item.label), [
    'install', 'package-syntax', 'package-tests', 'package-demo', 'typecheck', 'production-build',
  ]);
});

test('Contracts Finder child locks exact five-file zero-migration scope', () => {
  assert.deepEqual([...MARKETPLACE_CONTRACTS_FINDER_CORE_EXACT_FILES].sort(), contractsFinderFiles.sort());
  assert.equal(isMarketplaceContractsFinderCoreScope(contractsFinderFiles), true);
  assert.equal(isMarketplaceDiscoveryCoreScope(contractsFinderFiles), false);
  assert.equal(isMarketplaceContractsFinderCoreScope([...contractsFinderFiles, 'netlify.toml']), false);
  assert.equal(isMarketplaceContractsFinderCoreScope(contractsFinderFiles.slice(1)), false);
});

test('Contracts Finder profile runs exactly seven bounded stages', () => {
  assert.deepEqual(marketplaceContractsFinderCoreCommands.map((item) => item.label), [
    'install',
    'contracts-finder-syntax',
    'contracts-finder-tests',
    'typecheck',
    'production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  const serialized = JSON.stringify(marketplaceContractsFinderCoreCommands);
  assert.match(serialized, /training-marketplace-live-ingestion/);
  assert.match(serialized, /training-marketplace-contracts-finder-source-trust-v1/);
  assert.doesNotMatch(serialized, /curl|wget|playwright|supabase|psql/i);
});

test('historical and current migration/test metadata are separate', async () => {
  const source = await read('../scripts/run-marketplace-discovery-core-profile.mjs');
  assert.match(source, /CANONICAL_MIGRATION_COUNT = 360/);
  assert.match(source, /EXPECTED_NODE_COUNT = 13/);
  assert.match(source, /CONTRACTS_FINDER_CANONICAL_MIGRATION_COUNT = 371/);
  assert.match(source, /CONTRACTS_FINDER_EXPECTED_NODE_COUNT = 7/);
  assert.match(source, /selectedSuite: 'marketplace-discovery-core'/);
  assert.match(source, /selectedSuite: 'marketplace-contracts-finder-core'/);
  assert.doesNotMatch(source, /db reset|migration up|psql|supabase start/i);
  assert.doesNotMatch(source, /crawler|scrape|fetch\(|upload-artifact/i);
});

test('both scopes reject migrations, product UI and gateway expansion', () => {
  for (const suffix of [
    'supabase/migrations/20260809999999_unexpected.sql',
    'apps/training-web/src/components/Unexpected.tsx',
    'lib/trainingos-agent-gateway/unexpected.mjs',
  ]) {
    assert.equal(isMarketplaceDiscoveryCoreScope([...historicalFiles, suffix]), false);
    assert.equal(isMarketplaceContractsFinderCoreScope([...contractsFinderFiles, suffix]), false);
  }
});

test('private profile controller still routes one marketplace discovery owner before fallback', async () => {
  const source = await read('../scripts/run-private-profile.mjs');
  assert.match(source, /maybeRunMarketplaceDiscoveryCoreProfile/);
  assert.match(source, /run-marketplace-discovery-core-profile/);
  assert.ok(source.indexOf('maybeRunMarketplaceDiscoveryCoreProfile(input)') < source.indexOf('runBaseProfile(input)'));
});
