import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PROVIDER_NEUTRAL_BILLING_INTENT_EXACT_FILES,
  providerNeutralBillingIntentCommands,
  isProviderNeutralBillingIntentScope,
} from '../scripts/run-provider-neutral-billing-intent-profile.mjs';

test('selector accepts exactly five bounded private files', () => {
  assert.equal(PROVIDER_NEUTRAL_BILLING_INTENT_EXACT_FILES.size, 5);
  assert.equal(isProviderNeutralBillingIntentScope(PROVIDER_NEUTRAL_BILLING_INTENT_EXACT_FILES), true);
  assert.equal(isProviderNeutralBillingIntentScope([...PROVIDER_NEUTRAL_BILLING_INTENT_EXACT_FILES, 'netlify.toml']), false);
  assert.equal([...PROVIDER_NEUTRAL_BILLING_INTENT_EXACT_FILES].some((name) => name.startsWith('supabase/migrations/')), false);
});

test('profile runs only focused billing-intent and fixed repository gates', () => {
  assert.deepEqual(providerNeutralBillingIntentCommands.map((item) => item.label), [
    'install',
    'package-syntax',
    'focused-node-contracts',
    'declaration-typecheck',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  const focused = providerNeutralBillingIntentCommands.find((item) => item.label === 'focused-node-contracts');
  assert.deepEqual(focused?.args, ['--test', 'tests/trainingos-provider-neutral-billing-intent-core-v1.test.mjs']);
});

test('fixed exact-head counts stay locked', () => {
  const source = readFileSync(new URL('../scripts/run-provider-neutral-billing-intent-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    'const EXPECTED_CHANGED_FILE_COUNT = 5;',
    'const EXPECTED_NODE_COUNT = 19;',
    'const EXPECTED_PYTHON_COUNT = 0;',
    'const EXPECTED_MIGRATION_COUNT = 371;',
  ]) assert.equal(source.includes(token), true, token);
});

test('stage15 routes billing intent before inherited generic fallback', () => {
  const router = readFileSync(new URL('../scripts/run-private-profile-stage15.mjs', import.meta.url), 'utf8');
  assert.equal(router.includes("import { maybeRunProviderNeutralBillingIntentProfile } from './run-provider-neutral-billing-intent-profile.mjs';"), true);
  const billingIntent = router.indexOf('maybeRunProviderNeutralBillingIntentProfile(input)');
  const fallback = router.indexOf('runStage14Profile(input)');
  assert.ok(billingIntent >= 0 && fallback > billingIntent);
});
