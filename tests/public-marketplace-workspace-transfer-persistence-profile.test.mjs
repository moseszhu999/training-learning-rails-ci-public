import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WORKSPACE_TRANSFER_PERSISTENCE_EXACT_FILES,
  isWorkspaceTransferPersistenceScope,
  workspaceTransferPersistenceCommands,
} from '../scripts/run-marketplace-workspace-transfer-persistence-profile.mjs';

test('selector accepts only the exact D4a private scope', () => {
  const exact = [...WORKSPACE_TRANSFER_PERSISTENCE_EXACT_FILES];
  assert.equal(exact.length, 3);
  assert.equal(isWorkspaceTransferPersistenceScope(exact), true);
  assert.equal(isWorkspaceTransferPersistenceScope(exact.slice(0, 2)), false);
  assert.equal(isWorkspaceTransferPersistenceScope([...exact, 'netlify.toml']), false);
});

test('profile runs bounded contracts/build only and never deployment', () => {
  const labels = workspaceTransferPersistenceCommands.map((item) => item.label);
  assert.deepEqual(labels, [
    'install',
    'focused-python-contracts',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  const serialized = JSON.stringify(workspaceTransferPersistenceCommands).toLowerCase();
  assert.equal(serialized.includes('deploy'), false);
  assert.equal(serialized.includes('supabase'), false);
  assert.equal(serialized.includes('migration up'), false);
  assert.equal(serialized.includes('service_role'), false);
});
