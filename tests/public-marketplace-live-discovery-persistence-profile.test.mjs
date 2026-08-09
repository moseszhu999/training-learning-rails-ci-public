import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LIVE_DISCOVERY_PERSISTENCE_EXACT_FILES,
  isLiveDiscoveryPersistenceScope,
  liveDiscoveryPersistenceCommands,
} from '../scripts/run-marketplace-live-discovery-persistence-profile.mjs';

test('selector accepts only the exact D4b private scope', () => {
  const exact = [...LIVE_DISCOVERY_PERSISTENCE_EXACT_FILES];
  assert.equal(exact.length, 4);
  assert.equal(isLiveDiscoveryPersistenceScope(exact), true);
  assert.equal(isLiveDiscoveryPersistenceScope(exact.slice(0, 3)), false);
  assert.equal(isLiveDiscoveryPersistenceScope([...exact, 'netlify.toml']), false);
  assert.equal(isLiveDiscoveryPersistenceScope([
    ...exact.filter((name) => !name.includes('source_health')),
    'apps/training-marketplace-web/src/live-data.mjs',
  ]), false);
});

test('profile runs bounded contracts/build only and never deployment or database replay', () => {
  const labels = liveDiscoveryPersistenceCommands.map((item) => item.label);
  assert.deepEqual(labels, [
    'install',
    'focused-python-contracts',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  const serialized = JSON.stringify(liveDiscoveryPersistenceCommands).toLowerCase();
  assert.equal(serialized.includes('deploy'), false);
  assert.equal(serialized.includes('migration up'), false);
  assert.equal(serialized.includes('db push'), false);
  assert.equal(serialized.includes('netlify'), false);
});
