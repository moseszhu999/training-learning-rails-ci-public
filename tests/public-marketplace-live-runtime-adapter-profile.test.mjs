import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MARKETPLACE_LIVE_RUNTIME_ADAPTER_EXACT_FILES,
  marketplaceLiveRuntimeAdapterCommands,
  isMarketplaceLiveRuntimeAdapterScope,
} from '../scripts/run-marketplace-live-runtime-adapter-profile.mjs';

test('Marketplace live runtime adapter selector accepts exactly five private owner files', () => {
  assert.equal(MARKETPLACE_LIVE_RUNTIME_ADAPTER_EXACT_FILES.size, 5);
  assert.equal(isMarketplaceLiveRuntimeAdapterScope(MARKETPLACE_LIVE_RUNTIME_ADAPTER_EXACT_FILES), true);
  assert.equal(isMarketplaceLiveRuntimeAdapterScope([...MARKETPLACE_LIVE_RUNTIME_ADAPTER_EXACT_FILES, 'netlify.toml']), false);
  assert.equal(isMarketplaceLiveRuntimeAdapterScope([...MARKETPLACE_LIVE_RUNTIME_ADAPTER_EXACT_FILES].slice(1)), false);
  const replaced = [...MARKETPLACE_LIVE_RUNTIME_ADAPTER_EXACT_FILES];
  replaced[0] = 'supabase/migrations/20260810999999_not_allowed.sql';
  assert.equal(isMarketplaceLiveRuntimeAdapterScope(replaced), false);
});

test('Marketplace live runtime adapter profile runs fixed non-deploy validation gates', () => {
  assert.deepEqual(marketplaceLiveRuntimeAdapterCommands.map((item) => item.label), [
    'install',
    'runtime-adapter-syntax',
    'catalog-function-syntax',
    'ingestion-function-syntax',
    'focused-node-contracts',
    'focused-python-contracts',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  assert.deepEqual(
    marketplaceLiveRuntimeAdapterCommands.find((item) => item.label === 'focused-node-contracts')?.args,
    ['--test', 'tests/training-marketplace-catalog-preview-routing-v1.test.mjs'],
  );
  assert.deepEqual(
    marketplaceLiveRuntimeAdapterCommands.find((item) => item.label === 'focused-python-contracts')?.args,
    ['-m', 'unittest', '-v', 'tests.test_trainingos_marketplace_live_runtime_adapter_v1'],
  );
});

test('Marketplace live runtime adapter profile locks counts and zero-migration compatibility input', () => {
  const source = readFileSync(new URL('../scripts/run-marketplace-live-runtime-adapter-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    'const EXPECTED_CHANGED_FILE_COUNT = 5;',
    'const EXPECTED_NODE_COUNT = 2;',
    'const EXPECTED_PYTHON_COUNT = 5;',
    'const EXPECTED_MIGRATION_COUNT = 373;',
    "selectedSuite: 'marketplace-live-runtime-adapter'",
    "scope.migration_start === 'none'",
    "scope.migration_end === 'none'",
  ]) assert.equal(source.includes(token), true, token);
});

test('Marketplace live runtime adapter public profile performs no network collection, DB or deploy action', () => {
  const text = JSON.stringify(marketplaceLiveRuntimeAdapterCommands).toLowerCase();
  for (const forbidden of [
    'curl', 'wget', 'ssh', 'scp', 'netlify deploy', 'vercel deploy', 'supabase db', 'psql',
    'playwright', 'bash -c', 'sh -c',
  ]) assert.equal(text.includes(forbidden), false, forbidden);
});

test('stage15 routes Marketplace live runtime adapter before generic fallback', () => {
  const router = readFileSync(new URL('../scripts/run-private-profile-stage15.mjs', import.meta.url), 'utf8');
  assert.equal(router.includes("import { maybeRunMarketplaceLiveRuntimeAdapterProfile } from './run-marketplace-live-runtime-adapter-profile.mjs';"), true);
  const livePersistence = router.indexOf('maybeRunLiveDiscoveryPersistenceProfile(input)');
  const liveRuntime = router.indexOf('maybeRunMarketplaceLiveRuntimeAdapterProfile(input)');
  const fallback = router.indexOf('runStage14Profile(input)');
  assert.ok(livePersistence >= 0 && liveRuntime > livePersistence && fallback > liveRuntime);
});
