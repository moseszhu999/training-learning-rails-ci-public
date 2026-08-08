import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  STRIPE_TEST_ADAPTER_EXACT_FILES,
  stripeTestAdapterCommands,
  isStripeTestAdapterScope,
} from '../scripts/run-stripe-test-adapter-webhook-profile.mjs';

test('selector accepts exactly five Stripe test-adapter private files', () => {
  assert.equal(STRIPE_TEST_ADAPTER_EXACT_FILES.size, 5);
  assert.equal(isStripeTestAdapterScope(STRIPE_TEST_ADAPTER_EXACT_FILES), true);
  assert.equal(isStripeTestAdapterScope([...STRIPE_TEST_ADAPTER_EXACT_FILES, 'netlify.toml']), false);
  assert.equal([...STRIPE_TEST_ADAPTER_EXACT_FILES].some((name) => name.startsWith('supabase/migrations/')), false);
});

test('profile runs only focused Stripe core and fixed repository gates', () => {
  assert.deepEqual(stripeTestAdapterCommands.map((item) => item.label), [
    'install',
    'package-syntax',
    'focused-node-contracts',
    'declaration-typecheck',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  const focused = stripeTestAdapterCommands.find((item) => item.label === 'focused-node-contracts');
  assert.deepEqual(focused?.args, ['--test', 'tests/trainingos-stripe-test-adapter-webhook-core-v1.test.mjs']);
});

test('fixed exact-head counts stay locked', () => {
  const source = readFileSync(new URL('../scripts/run-stripe-test-adapter-webhook-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    'const EXPECTED_CHANGED_FILE_COUNT = 5;',
    'const EXPECTED_NODE_COUNT = 25;',
    'const EXPECTED_PYTHON_COUNT = 0;',
    'const EXPECTED_MIGRATION_COUNT = 371;',
  ]) assert.equal(source.includes(token), true, token);
});

test('stage15 routes Stripe profile before inherited generic fallback', () => {
  const router = readFileSync(new URL('../scripts/run-private-profile-stage15.mjs', import.meta.url), 'utf8');
  assert.equal(router.includes("import { maybeRunStripeTestAdapterWebhookProfile } from './run-stripe-test-adapter-webhook-profile.mjs';"), true);
  const stripe = router.indexOf('maybeRunStripeTestAdapterWebhookProfile(input)');
  const fallback = router.indexOf('runStage14Profile(input)');
  assert.ok(stripe >= 0 && fallback > stripe);
});

test('public selector contains no provider secrets or network execution commands', () => {
  const source = readFileSync(new URL('../scripts/run-stripe-test-adapter-webhook-profile.mjs', import.meta.url), 'utf8');
  for (const forbidden of ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'api.stripe.com', 'curl', 'fetch(']) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});
