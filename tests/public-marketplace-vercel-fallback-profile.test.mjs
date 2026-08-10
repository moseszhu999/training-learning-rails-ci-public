import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MARKETPLACE_VERCEL_FALLBACK_EXACT_FILES,
  marketplaceVercelFallbackCommands,
  isMarketplaceVercelFallbackScope,
} from '../scripts/run-marketplace-vercel-fallback-profile.mjs';

test('Vercel fallback selector accepts exactly three bounded private files', () => {
  assert.equal(MARKETPLACE_VERCEL_FALLBACK_EXACT_FILES.size, 3);
  assert.equal(isMarketplaceVercelFallbackScope(MARKETPLACE_VERCEL_FALLBACK_EXACT_FILES), true);
  assert.equal(isMarketplaceVercelFallbackScope([...MARKETPLACE_VERCEL_FALLBACK_EXACT_FILES, 'supabase/migrations/not-allowed.sql']), false);
  assert.equal(isMarketplaceVercelFallbackScope([...MARKETPLACE_VERCEL_FALLBACK_EXACT_FILES].slice(1)), false);
});

test('Vercel fallback profile runs module-load focused contracts and build only', () => {
  assert.deepEqual(marketplaceVercelFallbackCommands.map((item) => item.label), [
    'install', 'dispatcher-module-load', 'focused-node-contracts', 'typecheck',
    'direct-vite-production-build', 'postbuild-copy', 'bundle-verification',
  ]);
  assert.deepEqual(marketplaceVercelFallbackCommands.find((item) => item.label === 'focused-node-contracts')?.args, ['--test', 'tests/trainingos-vercel-marketplace-fallback-v1.test.mjs']);
});

test('Vercel fallback profile locks exact counts and zero migration range', () => {
  const source = readFileSync(new URL('../scripts/run-marketplace-vercel-fallback-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    'const EXPECTED_CHANGED_FILE_COUNT = 3;',
    'const EXPECTED_NODE_COUNT = 6;',
    'const EXPECTED_PYTHON_COUNT = 0;',
    'const EXPECTED_MIGRATION_COUNT = 373;',
    "selectedSuite: 'marketplace-vercel-fallback'",
    "scope.migration_start === 'none'",
    "scope.migration_end === 'none'",
  ]) assert.equal(source.includes(token), true, token);
});

test('public Vercel fallback profile performs no network probe deploy or DB command', () => {
  const text = JSON.stringify(marketplaceVercelFallbackCommands).toLowerCase();
  for (const forbidden of ['playwright', 'curl', 'wget', 'ssh', 'scp', 'vercel deploy', 'netlify deploy', 'supabase db', 'psql', 'bash -c', 'sh -c']) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
});
