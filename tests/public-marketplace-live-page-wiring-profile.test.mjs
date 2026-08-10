import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MARKETPLACE_LIVE_PAGE_WIRING_EXACT_FILES,
  marketplaceLivePageWiringCommands,
  isMarketplaceLivePageWiringScope,
} from '../scripts/run-marketplace-live-page-wiring-profile.mjs';

test('Marketplace live page wiring selector accepts exactly four private owner files', () => {
  assert.equal(MARKETPLACE_LIVE_PAGE_WIRING_EXACT_FILES.size, 4);
  assert.equal(isMarketplaceLivePageWiringScope(MARKETPLACE_LIVE_PAGE_WIRING_EXACT_FILES), true);
  assert.equal(isMarketplaceLivePageWiringScope([...MARKETPLACE_LIVE_PAGE_WIRING_EXACT_FILES, 'netlify.toml']), false);
  assert.equal(isMarketplaceLivePageWiringScope([...MARKETPLACE_LIVE_PAGE_WIRING_EXACT_FILES].slice(1)), false);
  const replaced = [...MARKETPLACE_LIVE_PAGE_WIRING_EXACT_FILES];
  replaced[0] = 'supabase/migrations/20260810999999_not_allowed.sql';
  assert.equal(isMarketplaceLivePageWiringScope(replaced), false);
});

test('Marketplace live page wiring profile runs fixed non-browser application gates', () => {
  assert.deepEqual(marketplaceLivePageWiringCommands.map((item) => item.label), [
    'install',
    'app-syntax',
    'live-page-ui-syntax',
    'focused-node-contracts',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  assert.deepEqual(
    marketplaceLivePageWiringCommands.find((item) => item.label === 'focused-node-contracts')?.args,
    ['--test', 'tests/training-marketplace-live-page-wiring-v1.test.mjs'],
  );
});

test('Marketplace live page wiring profile locks counts and zero-migration compatibility input', () => {
  const source = readFileSync(new URL('../scripts/run-marketplace-live-page-wiring-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    'const EXPECTED_CHANGED_FILE_COUNT = 4;',
    'const EXPECTED_NODE_COUNT = 4;',
    'const EXPECTED_PYTHON_COUNT = 0;',
    'const EXPECTED_MIGRATION_COUNT = 373;',
    "selectedSuite: 'marketplace-live-page-wiring'",
    "scope.migration_start === 'none'",
    "scope.migration_end === 'none'",
  ]) assert.equal(source.includes(token), true, token);
});

test('public application profile does not launch browser, network, DB or deploy actions', () => {
  const text = JSON.stringify(marketplaceLivePageWiringCommands).toLowerCase();
  for (const forbidden of [
    'playwright', 'curl', 'wget', 'ssh', 'scp', 'netlify deploy', 'vercel deploy', 'supabase db', 'psql',
    'bash -c', 'sh -c',
  ]) assert.equal(text.includes(forbidden), false, forbidden);
});

test('existing Marketplace browser-core route delegates to live page wiring before D5b scope matching', () => {
  const browserCore = readFileSync(new URL('../scripts/run-marketplace-browser-live-core-profile.mjs', import.meta.url), 'utf8');
  assert.equal(browserCore.includes("import { maybeRunMarketplaceLivePageWiringProfile } from './run-marketplace-live-page-wiring-profile.mjs';"), true);
  const pageWiring = browserCore.indexOf('maybeRunMarketplaceLivePageWiringProfile(input)');
  const browserScope = browserCore.indexOf('isMarketplaceBrowserLiveCoreScope(files)');
  assert.ok(pageWiring >= 0 && browserScope > pageWiring);
});
