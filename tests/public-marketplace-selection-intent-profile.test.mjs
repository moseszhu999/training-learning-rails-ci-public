import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  MARKETPLACE_SELECTION_INTENT_EXACT_FILES,
  isMarketplaceSelectionIntentScope,
  marketplaceSelectionIntentCommands,
} from '../scripts/run-marketplace-selection-intent-profile.mjs';

const exactFiles = [
  'docs/architecture/trainingos-marketplace-selection-intent-core-v1.md',
  'packages/training-marketplace-selection-intent/package.json',
  'packages/training-marketplace-selection-intent/src/index.d.ts',
  'packages/training-marketplace-selection-intent/src/index.mjs',
  'packages/training-marketplace-selection-intent/test/selection-intent.test.mjs',
  'tests/test_trainingos_marketplace_selection_intent_core_v1.py',
];

const profile = readFileSync(
  new URL('../scripts/run-marketplace-selection-intent-profile.mjs', import.meta.url),
  'utf8',
);
const router = readFileSync(
  new URL('../scripts/run-marketplace-participation-profile.mjs', import.meta.url),
  'utf8',
);

test('selection intent profile owns exactly six non-migration files', () => {
  assert.deepEqual([...MARKETPLACE_SELECTION_INTENT_EXACT_FILES].sort(), [...exactFiles].sort());
  assert.equal(isMarketplaceSelectionIntentScope(exactFiles), true);
  assert.equal(isMarketplaceSelectionIntentScope(exactFiles.slice(1)), false);
  assert.equal(isMarketplaceSelectionIntentScope([...exactFiles, 'package.json']), false);
  assert.equal(isMarketplaceSelectionIntentScope([...exactFiles.slice(0, 5), 'supabase/migrations/forbidden.sql']), false);
});

test('profile runs focused selection, declaration, typecheck and build gates', () => {
  assert.deepEqual(
    marketplaceSelectionIntentCommands.map((item) => item.label),
    [
      'install',
      'package-syntax',
      'node-selection-intent',
      'python-static',
      'declaration-typecheck',
      'typecheck',
      'production-build',
      'bundle-verification',
    ],
  );
  for (const marker of [
    'CANONICAL_MIGRATION_COUNT = 367',
    'EXPECTED_NODE_COUNT = 6',
    'EXPECTED_PYTHON_COUNT = 5',
    'selection-intent.test.mjs',
    'test_trainingos_marketplace_selection_intent_core_v1',
    "selectedSuite: 'marketplace-selection-intent'",
  ]) assert.ok(profile.includes(marker), marker);
  assert.doesNotMatch(profile, /database-replay/);
  assert.doesNotMatch(profile, /SUPABASE_(ACCESS_TOKEN|DB_PASSWORD)/);
  assert.doesNotMatch(profile, /deploy/i);
  assert.equal(
    marketplaceSelectionIntentCommands.some((item) => item.executable === 'supabase'),
    false,
  );
});

test('participation router invokes matching context then selection intent before other UI profiles', () => {
  assert.match(router, /maybeRunMarketplaceSelectionIntentProfile/);
  const matchingIndex = router.indexOf('maybeRunMarketplaceMatchingContextProfile(input)');
  const selectionIndex = router.indexOf('maybeRunMarketplaceSelectionIntentProfile(input)');
  const submissionIndex = router.indexOf('maybeRunMarketplaceAuthenticatedSubmissionUiProfile(input)');
  assert.ok(matchingIndex >= 0);
  assert.ok(selectionIndex > matchingIndex);
  assert.ok(submissionIndex > selectionIndex);
});

test('selection profile preserves pure input-only and no-contact-write scope', () => {
  for (const marker of [
    "'packages/training-marketplace-selection-intent/src/index.mjs'",
    "'packages/training-marketplace-selection-intent/src/index.d.ts'",
    "'tests.test_trainingos_marketplace_selection_intent_core_v1'",
  ]) assert.ok(profile.includes(marker), marker);
  assert.doesNotMatch(profile, /contactWritePerformed\s*=\s*true/);
  assert.doesNotMatch(profile, /automaticOutreachPerformed\s*=\s*true/);
  assert.doesNotMatch(profile, /formalTrainingWritePerformed\s*=\s*true/);
});
