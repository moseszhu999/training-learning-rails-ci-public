import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MARKETPLACE_SOURCE_REFRESH_EXACT_FILES,
  isMarketplaceSourceRefreshScope,
  marketplaceSourceRefreshCommands,
} from '../scripts/run-marketplace-source-refresh-profile.mjs';

const profileText = readFileSync(new URL('../scripts/run-marketplace-source-refresh-profile.mjs', import.meta.url), 'utf8');
const routerText = readFileSync(new URL('../scripts/run-private-profile.mjs', import.meta.url), 'utf8');

const exactFiles = [
  'docs/product/trainingos-marketplace-source-refresh-orchestration-v1.md',
  'packages/training-marketplace-source-refresh/package.json',
  'packages/training-marketplace-source-refresh/src/index.d.ts',
  'packages/training-marketplace-source-refresh/src/index.mjs',
  'tests/training-marketplace-source-refresh-orchestration-v1.test.mjs',
];

test('source refresh profile owns exactly five package test and documentation files', () => {
  assert.deepEqual([...MARKETPLACE_SOURCE_REFRESH_EXACT_FILES].sort(), [...exactFiles].sort());
  assert.equal(isMarketplaceSourceRefreshScope(exactFiles), true);
  assert.equal(isMarketplaceSourceRefreshScope(exactFiles.slice(1)), false);
  assert.equal(isMarketplaceSourceRefreshScope([...exactFiles, 'apps/training-web/x.tsx']), false);
  assert.equal(isMarketplaceSourceRefreshScope([...exactFiles, 'supabase/migrations/1.sql']), false);
});

test('source refresh profile locks seven non-database gates', () => {
  assert.deepEqual(marketplaceSourceRefreshCommands.map((item) => item.label), [
    'install',
    'package-syntax',
    'focused-node-contracts',
    'declaration-typecheck',
    'typecheck',
    'production-build',
    'bundle-verification',
  ]);
});

test('source refresh profile locks migration and test counts', () => {
  for (const marker of [
    'const CANONICAL_MIGRATION_COUNT = 368',
    'const EXPECTED_NODE_COUNT = 13',
    'const EXPECTED_PYTHON_COUNT = 0',
    "scope.expected_changed_file_count === '5'",
    "scope.migration_start === 'none'",
    "scope.migration_end === 'none'",
  ]) assert.ok(profileText.includes(marker), marker);
});

test('source refresh profile has no database deployment or credential path', () => {
  assert.doesNotMatch(profileText, /supabase db|migration up|psql|netlify deploy|vercel deploy|--prod/i);
  assert.doesNotMatch(profileText, /access.token|service.role|database.password|private.token/i);
});

test('router dispatches source refresh before generic fallback', () => {
  assert.match(routerText, /run-marketplace-source-refresh-profile\.mjs/);
  const refreshIndex = routerText.indexOf('const marketplaceSourceRefresh = await maybeRunMarketplaceSourceRefreshProfile');
  const baseIndex = routerText.indexOf('const result = await runBaseProfile');
  assert.ok(refreshIndex >= 0);
  assert.ok(baseIndex > refreshIndex);
});
