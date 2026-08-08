import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEMAND_SCOPE_DELIVERY_REVIEW_EXACT_FILES,
  demandScopeDeliveryReviewCommands,
  isDemandScopeDeliveryReviewScope,
} from '../scripts/run-demand-scope-delivery-review-profile.mjs';

test('Demand Scope Delivery selector accepts exactly the five private review files', () => {
  assert.equal(DEMAND_SCOPE_DELIVERY_REVIEW_EXACT_FILES.size, 5);
  assert.equal(isDemandScopeDeliveryReviewScope(DEMAND_SCOPE_DELIVERY_REVIEW_EXACT_FILES), true);
  assert.equal(isDemandScopeDeliveryReviewScope([...DEMAND_SCOPE_DELIVERY_REVIEW_EXACT_FILES, 'netlify.toml']), false);
  const missing = [...DEMAND_SCOPE_DELIVERY_REVIEW_EXACT_FILES].slice(1);
  assert.equal(isDemandScopeDeliveryReviewScope(missing), false);
  const replaced = [...DEMAND_SCOPE_DELIVERY_REVIEW_EXACT_FILES];
  replaced[0] = 'supabase/migrations/20260808999999_not_allowed.sql';
  assert.equal(isDemandScopeDeliveryReviewScope(replaced), false);
});

test('Demand Scope Delivery profile runs exact contracts and repository build gates', () => {
  assert.deepEqual(demandScopeDeliveryReviewCommands.map((item) => item.label), [
    'install',
    'contract-syntax',
    'focused-node-contracts',
    'focused-python-contracts',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  assert.deepEqual(demandScopeDeliveryReviewCommands.find((item) => item.label === 'focused-node-contracts')?.args,
    ['--test', 'packages/training-industry-role-pack-core/test/demand-scope-delivery-review.test.mjs']);
  assert.deepEqual(demandScopeDeliveryReviewCommands.find((item) => item.label === 'focused-python-contracts')?.args,
    ['-m', 'unittest', '-v', 'tests.test_trainingos_demand_scope_delivery_review_v1']);
});

test('Demand Scope Delivery profile locks 5 files 10 node 8 python and migration metadata 371', () => {
  const source = readFileSync(new URL('../scripts/run-demand-scope-delivery-review-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    'const EXPECTED_CHANGED_FILE_COUNT = 5;',
    'const EXPECTED_NODE_COUNT = 10;',
    'const EXPECTED_PYTHON_COUNT = 8;',
    'const EXPECTED_MIGRATION_COUNT = 371;',
    "selectedSuite: 'demand-scope-delivery-review'",
  ]) assert.equal(source.includes(token), true, token);
});

test('stage15 routes Demand Scope Delivery after Capability Initiative and before fallback', () => {
  const router = readFileSync(new URL('../scripts/run-private-profile-stage15.mjs', import.meta.url), 'utf8');
  assert.equal(router.includes("import { maybeRunDemandScopeDeliveryReviewProfile } from './run-demand-scope-delivery-review-profile.mjs';"), true);
  const capability = router.indexOf('maybeRunCapabilityInitiativeProfile(input)');
  const review = router.indexOf('maybeRunDemandScopeDeliveryReviewProfile(input)');
  const fallback = router.indexOf('runStage14Profile(input)');
  assert.ok(capability >= 0 && review > capability && fallback > review);
});

test('public Demand Scope Delivery profile contains no deployment database provider or arbitrary shell primitive', () => {
  const text = JSON.stringify(demandScopeDeliveryReviewCommands).toLowerCase();
  for (const forbidden of [
    'curl', 'wget', 'ssh', 'scp', 'netlify deploy', 'vercel deploy', 'supabase db', 'psql',
    'playwright', 'tencent', 'createroom', 'bash -c', 'sh -c',
  ]) assert.equal(text.includes(forbidden), false, forbidden);
});
