import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MARKETPLACE_WORKSPACE_TRANSFER_UI_EXACT_FILES,
  marketplaceWorkspaceTransferUiCommands,
  isMarketplaceWorkspaceTransferUiScope,
} from '../scripts/run-marketplace-workspace-transfer-ui-profile.mjs';

test('UI selector accepts exactly six bounded private files', () => {
  assert.equal(MARKETPLACE_WORKSPACE_TRANSFER_UI_EXACT_FILES.size, 6);
  assert.equal(isMarketplaceWorkspaceTransferUiScope(MARKETPLACE_WORKSPACE_TRANSFER_UI_EXACT_FILES), true);
  assert.equal(isMarketplaceWorkspaceTransferUiScope([...MARKETPLACE_WORKSPACE_TRANSFER_UI_EXACT_FILES, 'supabase/migrations/not-allowed.sql']), false);
  assert.equal(isMarketplaceWorkspaceTransferUiScope([...MARKETPLACE_WORKSPACE_TRANSFER_UI_EXACT_FILES].slice(1)), false);
});

test('UI profile runs fixed local validation only', () => {
  assert.deepEqual(marketplaceWorkspaceTransferUiCommands.map((item) => item.label), [
    'install',
    'focused-node-contracts',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  assert.deepEqual(
    marketplaceWorkspaceTransferUiCommands.find((item) => item.label === 'focused-node-contracts')?.args,
    ['--test', 'tests/training-marketplace-workspace-transfer-ui-v1.test.mjs'],
  );
});

test('UI profile locks exact counts and zero migration range', () => {
  const source = readFileSync(new URL('../scripts/run-marketplace-workspace-transfer-ui-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    'const EXPECTED_CHANGED_FILE_COUNT = 6;',
    'const EXPECTED_NODE_COUNT = 6;',
    'const EXPECTED_PYTHON_COUNT = 0;',
    'const EXPECTED_MIGRATION_COUNT = 373;',
    "selectedSuite: 'marketplace-workspace-transfer-ui'",
    "scope.migration_start === 'none'",
    "scope.migration_end === 'none'",
  ]) assert.equal(source.includes(token), true, token);
});

test('UI profile performs no browser, network probe, DB command or deploy action', () => {
  const text = JSON.stringify(marketplaceWorkspaceTransferUiCommands).toLowerCase();
  for (const forbidden of [
    'playwright', 'curl', 'wget', 'ssh', 'scp', 'netlify deploy', 'vercel deploy',
    'supabase db', 'psql', 'bash -c', 'sh -c',
  ]) assert.equal(text.includes(forbidden), false, forbidden);
});
