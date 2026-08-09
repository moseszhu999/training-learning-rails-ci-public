import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MARKETPLACE_BROWSER_LIVE_CORE_EXACT_FILES,
  marketplaceBrowserLiveCoreCommands,
  isMarketplaceBrowserLiveCoreScope,
} from '../scripts/run-marketplace-browser-live-core-profile.mjs';

test('Marketplace browser live core selector accepts exactly four private owner files', () => {
  assert.equal(MARKETPLACE_BROWSER_LIVE_CORE_EXACT_FILES.size, 4);
  assert.equal(isMarketplaceBrowserLiveCoreScope(MARKETPLACE_BROWSER_LIVE_CORE_EXACT_FILES), true);
  assert.equal(isMarketplaceBrowserLiveCoreScope([...MARKETPLACE_BROWSER_LIVE_CORE_EXACT_FILES, 'apps/training-marketplace-web/src/app.mjs']), false);
  assert.equal(isMarketplaceBrowserLiveCoreScope([...MARKETPLACE_BROWSER_LIVE_CORE_EXACT_FILES].slice(1)), false);
  const replaced = [...MARKETPLACE_BROWSER_LIVE_CORE_EXACT_FILES];
  replaced[0] = 'supabase/migrations/20260810999999_not_allowed.sql';
  assert.equal(isMarketplaceBrowserLiveCoreScope(replaced), false);
});

test('Marketplace browser live core profile runs fixed read-only validation gates', () => {
  assert.deepEqual(marketplaceBrowserLiveCoreCommands.map((item) => item.label), [
    'install',
    'live-data-syntax',
    'source-health-syntax',
    'focused-node-contracts',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  assert.deepEqual(
    marketplaceBrowserLiveCoreCommands.find((item) => item.label === 'focused-node-contracts')?.args,
    [
      '--test',
      'tests/training-marketplace-browser-live-core-v1.test.mjs',
      'tests/training-marketplace-source-health-v1.test.mjs',
    ],
  );
});

test('Marketplace browser live core profile locks counts and zero-migration compatibility input', () => {
  const source = readFileSync(new URL('../scripts/run-marketplace-browser-live-core-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    'const EXPECTED_CHANGED_FILE_COUNT = 4;',
    'const EXPECTED_NODE_COUNT = 8;',
    'const EXPECTED_PYTHON_COUNT = 0;',
    'const EXPECTED_MIGRATION_COUNT = 373;',
    "selectedSuite: 'marketplace-browser-live-core'",
    "scope.migration_start === 'none'",
    "scope.migration_end === 'none'",
  ]) assert.equal(source.includes(token), true, token);
});

test('Marketplace browser live core public profile performs no browser, network, DB or deploy action', () => {
  const text = JSON.stringify(marketplaceBrowserLiveCoreCommands).toLowerCase();
  for (const forbidden of [
    'curl', 'wget', 'ssh', 'scp', 'netlify deploy', 'vercel deploy', 'supabase db', 'psql',
    'playwright', 'bash -c', 'sh -c',
  ]) assert.equal(text.includes(forbidden), false, forbidden);
});

test('stage15 routes Marketplace browser live core before generic fallback', () => {
  const router = readFileSync(new URL('../scripts/run-private-profile-stage15.mjs', import.meta.url), 'utf8');
  assert.equal(router.includes("import { maybeRunMarketplaceBrowserLiveCoreProfile } from './run-marketplace-browser-live-core-profile.mjs';"), true);
  const liveRuntime = router.indexOf('maybeRunMarketplaceLiveRuntimeAdapterProfile(input)');
  const browserCore = router.indexOf('maybeRunMarketplaceBrowserLiveCoreProfile(input)');
  const fallback = router.indexOf('runStage14Profile(input)');
  assert.ok(liveRuntime >= 0 && browserCore > liveRuntime && fallback > browserCore);
});
