import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ENTITLEMENT_BILLING_PROJECTION_EXACT_FILES,
  entitlementBillingProjectionCommands,
  isEntitlementBillingProjectionScope,
} from '../scripts/run-entitlement-billing-projection-profile.mjs';

test('selector accepts exactly five bounded private files', () => {
  assert.equal(ENTITLEMENT_BILLING_PROJECTION_EXACT_FILES.size, 5);
  assert.equal(isEntitlementBillingProjectionScope(ENTITLEMENT_BILLING_PROJECTION_EXACT_FILES), true);
  assert.equal(isEntitlementBillingProjectionScope([...ENTITLEMENT_BILLING_PROJECTION_EXACT_FILES, 'netlify.toml']), false);
  assert.equal([...ENTITLEMENT_BILLING_PROJECTION_EXACT_FILES].some((name) => name.startsWith('supabase/migrations/')), false);
});

test('profile runs only focused projection and fixed repository gates', () => {
  assert.deepEqual(entitlementBillingProjectionCommands.map((item) => item.label), [
    'install',
    'package-syntax',
    'focused-node-contracts',
    'declaration-typecheck',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  const focused = entitlementBillingProjectionCommands.find((item) => item.label === 'focused-node-contracts');
  assert.deepEqual(focused?.args, ['--test', 'tests/trainingos-entitlement-billing-projection-core-v1.test.mjs']);
});

test('fixed exact-head counts stay locked', () => {
  const source = readFileSync(new URL('../scripts/run-entitlement-billing-projection-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    'const EXPECTED_CHANGED_FILE_COUNT = 5;',
    'const EXPECTED_NODE_COUNT = 14;',
    'const EXPECTED_PYTHON_COUNT = 0;',
    'const EXPECTED_MIGRATION_COUNT = 369;',
  ]) assert.equal(source.includes(token), true, token);
});

test('stage15 routes entitlement projection before generic inherited fallback', () => {
  const router = readFileSync(new URL('../scripts/run-private-profile-stage15.mjs', import.meta.url), 'utf8');
  assert.equal(router.includes("import { maybeRunEntitlementBillingProjectionProfile } from './run-entitlement-billing-projection-profile.mjs';"), true);
  const entitlement = router.indexOf('maybeRunEntitlementBillingProjectionProfile(input)');
  const fallback = router.indexOf('runStage14Profile(input)');
  assert.ok(entitlement >= 0 && fallback > entitlement);
});
