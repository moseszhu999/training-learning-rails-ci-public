import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MARKETPLACE_WORKSPACE_TRANSFER_SERVER_EXACT_FILES,
  marketplaceWorkspaceTransferServerCommands,
  isMarketplaceWorkspaceTransferServerScope,
} from '../scripts/run-marketplace-workspace-transfer-server-profile.mjs';

test('Marketplace transfer server selector accepts exactly three private owner files', () => {
  assert.equal(MARKETPLACE_WORKSPACE_TRANSFER_SERVER_EXACT_FILES.size, 3);
  assert.equal(isMarketplaceWorkspaceTransferServerScope(MARKETPLACE_WORKSPACE_TRANSFER_SERVER_EXACT_FILES), true);
  assert.equal(isMarketplaceWorkspaceTransferServerScope([...MARKETPLACE_WORKSPACE_TRANSFER_SERVER_EXACT_FILES, 'apps/training-web/src/components/TrainingOsMarketplaceWorkspaceTransferPanel.tsx']), false);
  assert.equal(isMarketplaceWorkspaceTransferServerScope([...MARKETPLACE_WORKSPACE_TRANSFER_SERVER_EXACT_FILES].slice(1)), false);
  const replaced = [...MARKETPLACE_WORKSPACE_TRANSFER_SERVER_EXACT_FILES];
  replaced[0] = 'supabase/migrations/20260810999999_not_allowed.sql';
  assert.equal(isMarketplaceWorkspaceTransferServerScope(replaced), false);
});

test('Marketplace transfer server profile runs fixed non-runtime validation gates', () => {
  assert.deepEqual(marketplaceWorkspaceTransferServerCommands.map((item) => item.label), [
    'install',
    'gateway-syntax',
    'function-syntax',
    'function-module-load',
    'focused-node-contracts',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  assert.deepEqual(
    marketplaceWorkspaceTransferServerCommands.find((item) => item.label === 'function-module-load')?.args,
    [
      '--input-type=module',
      '--eval',
      "await import('./netlify/functions/trainingos-marketplace-workspace-transfer.mjs')",
    ],
  );
  assert.deepEqual(
    marketplaceWorkspaceTransferServerCommands.find((item) => item.label === 'focused-node-contracts')?.args,
    ['--test', 'tests/training-marketplace-workspace-transfer-server-v1.test.mjs'],
  );
});

test('Marketplace transfer server profile locks counts and zero-migration compatibility input', () => {
  const source = readFileSync(new URL('../scripts/run-marketplace-workspace-transfer-server-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    'const EXPECTED_CHANGED_FILE_COUNT = 3;',
    'const EXPECTED_NODE_COUNT = 6;',
    'const EXPECTED_PYTHON_COUNT = 0;',
    'const EXPECTED_MIGRATION_COUNT = 373;',
    "selectedSuite: 'marketplace-workspace-transfer-server'",
    "scope.migration_start === 'none'",
    "scope.migration_end === 'none'",
  ]) assert.equal(source.includes(token), true, token);
});

test('public profile performs no browser, network probe, DB command or deploy action', () => {
  const text = JSON.stringify(marketplaceWorkspaceTransferServerCommands).toLowerCase();
  for (const forbidden of [
    'playwright', 'curl', 'wget', 'ssh', 'scp', 'netlify deploy', 'vercel deploy', 'supabase db', 'psql',
    'bash -c', 'sh -c',
  ]) assert.equal(text.includes(forbidden), false, forbidden);
});

test('existing Marketplace page profile delegates to transfer server before D5c scope matching', () => {
  const router = readFileSync(new URL('../scripts/run-marketplace-live-page-wiring-profile.mjs', import.meta.url), 'utf8');
  assert.equal(router.includes("import { maybeRunMarketplaceWorkspaceTransferServerProfile } from './run-marketplace-workspace-transfer-server-profile.mjs';"), true);
  const server = router.indexOf('maybeRunMarketplaceWorkspaceTransferServerProfile(input)');
  const pageScope = router.indexOf('isMarketplaceLivePageWiringScope(files)');
  assert.ok(server >= 0 && pageScope > server);
});
