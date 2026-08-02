import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  MARKETPLACE_DISCOVERY_CORE_EXACT_FILES,
  isMarketplaceDiscoveryCoreScope,
  marketplaceDiscoveryCoreCommands,
} from '../scripts/run-marketplace-discovery-core-profile.mjs';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

const expectedFiles = [
  'docs/architecture/trainingos-marketplace-discovery-core-v1.md',
  'packages/training-marketplace-core/package.json',
  'packages/training-marketplace-core/src/index.mjs',
  'packages/training-marketplace-core/test/marketplace-core.test.mjs',
];

test('marketplace discovery core locks the exact four-file zero-migration scope', () => {
  assert.deepEqual([...MARKETPLACE_DISCOVERY_CORE_EXACT_FILES].sort(), expectedFiles.sort());
  assert.equal(isMarketplaceDiscoveryCoreScope([...MARKETPLACE_DISCOVERY_CORE_EXACT_FILES]), true);
  assert.equal(isMarketplaceDiscoveryCoreScope([
    ...MARKETPLACE_DISCOVERY_CORE_EXACT_FILES,
    'apps/training-web/src/components/Unexpected.tsx',
  ]), false);
  assert.equal(isMarketplaceDiscoveryCoreScope([
    ...MARKETPLACE_DISCOVERY_CORE_EXACT_FILES,
    'supabase/migrations/20260802110000_unexpected.sql',
  ]), false);
  assert.equal(isMarketplaceDiscoveryCoreScope([
    ...MARKETPLACE_DISCOVERY_CORE_EXACT_FILES,
    'lib/trainingos-agent-gateway/unexpected.mjs',
  ]), false);
});

test('profile runs only fixed package validation, typecheck and production build', () => {
  assert.deepEqual(marketplaceDiscoveryCoreCommands.map((item) => item.label), [
    'install',
    'package-syntax',
    'package-tests',
    'typecheck',
    'production-build',
  ]);
  const serialized = JSON.stringify(marketplaceDiscoveryCoreCommands);
  assert.match(serialized, /packages\/training-marketplace-core/);
  assert.match(serialized, /npm/);
  assert.match(serialized, /vite/);
});

test('profile contains no database, deployment, network collection or artifact stage', async () => {
  const source = await read('../scripts/run-marketplace-discovery-core-profile.mjs');
  assert.match(source, /CANONICAL_MIGRATION_COUNT = 360/);
  assert.match(source, /EXPECTED_NODE_COUNT = 12/);
  assert.match(source, /scope\.migration_start === 'none'/);
  assert.match(source, /scope\.migration_end === 'none'/);
  assert.doesNotMatch(source, /db reset|migration up|psql|supabase start/i);
  assert.doesNotMatch(source, /crawler|scrape|fetch\(|deploy|upload-artifact/i);
});

test('private profile controller routes marketplace discovery before generic fallback', async () => {
  const source = await read('../scripts/run-private-profile.mjs');
  assert.match(source, /maybeRunMarketplaceDiscoveryCoreProfile/);
  assert.match(source, /run-marketplace-discovery-core-profile/);
  assert.ok(source.indexOf('maybeRunMarketplaceDiscoveryCoreProfile(input)') < source.indexOf('runBaseProfile(input)'));
});
