import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  MARKETPLACE_CLAIM_REVIEW_EXACT_FILES,
  isMarketplaceClaimReviewScope,
  marketplaceClaimReviewCommands,
  parseMarketplaceClaimReviewPythonFailure,
} from '../scripts/run-marketplace-claim-review-lifecycle-profile.mjs';

const expectedFiles = [
  'docs/product/trainingos-marketplace-claim-review-lifecycle-v1.md',
  'docs/testing/trainingos-marketplace-claim-review-lifecycle-v1-audit.md',
  'packages/training-marketplace-claim-review/package.json',
  'packages/training-marketplace-claim-review/src/index.d.ts',
  'packages/training-marketplace-claim-review/src/index.mjs',
  'packages/training-marketplace-claim-review/test/claim-review.test.mjs',
  'supabase/migrations/20260804222000_trainingos_marketplace_claim_review_lifecycle_v1.sql',
  'tests/sql/trainingos_marketplace_claim_review_lifecycle_v1_e2e.sql',
  'tests/test_trainingos_marketplace_claim_review_lifecycle_v1.py',
];

test('profile owns exactly the nine bounded private files', () => {
  assert.deepEqual([...MARKETPLACE_CLAIM_REVIEW_EXACT_FILES].sort(), expectedFiles.sort());
  assert.equal(isMarketplaceClaimReviewScope(expectedFiles), true);
  assert.equal(isMarketplaceClaimReviewScope(expectedFiles.slice(0, 8)), false);
  assert.equal(isMarketplaceClaimReviewScope([...expectedFiles, 'apps/forbidden.ts']), false);
});

test('profile runs seven fixed validation stages', () => {
  assert.deepEqual(
    marketplaceClaimReviewCommands.map((item) => item.label),
    [
      'install',
      'node-adapter',
      'python-static',
      'database-replay',
      'typecheck',
      'production-build',
      'bundle-verification',
    ],
  );
  assert.deepEqual(
    marketplaceClaimReviewCommands.find((item) => item.label === 'node-adapter').args,
    [
      '--test',
      'packages/training-marketplace-claim-review/test/claim-review.test.mjs',
    ],
  );
  assert.deepEqual(
    marketplaceClaimReviewCommands.find((item) => item.label === 'python-static').args,
    ['tests/test_trainingos_marketplace_claim_review_lifecycle_v1.py'],
  );
});

test('Python diagnostics expose only allowlisted test categories', () => {
  assert.equal(
    parseMarketplaceClaimReviewPythonFailure(
      'CLAIM_REVIEW_PYTHON_FAIL test_claimant_status_redacts_reviewer_and_internal_reason',
    ),
    'claimant-redaction',
  );
  assert.equal(
    parseMarketplaceClaimReviewPythonFailure('unrelated private traceback content'),
    'unknown',
  );
});

test('database runner fixes migration counts and replay stages', async () => {
  const script = await readFile(
    new URL('../scripts/run-marketplace-claim-review-lifecycle-database.sh', import.meta.url),
    'utf8',
  );
  for (const marker of [
    'canonical_migration_count=366',
    'base_migration_count=365',
    '20260804222000_trainingos_marketplace_claim_review_lifecycle_v1.sql',
    'run_e2e "$fresh" fresh-one',
    'run_e2e "$fresh" fresh-two',
    'run_e2e "$upgrade" upgrade',
    'claim_decisions=0',
    'public_rpcs=3',
    'authenticated_public_rpc=3',
    'forbidden_public_rpc_exec=0',
    'forbidden_adjacent_rpcs=0',
    'production',
  ]) {
    if (marker === 'production') {
      assert.equal(script.includes(marker), false);
    } else {
      assert.equal(script.includes(marker), true, marker);
    }
  }
});

test('router exports and invokes the claim review profile once', async () => {
  const router = await readFile(
    new URL('../scripts/run-private-profile.mjs', import.meta.url),
    'utf8',
  );
  assert.equal(
    router.includes("export * from './run-marketplace-claim-review-lifecycle-profile.mjs';"),
    true,
  );
  assert.equal(
    router.includes("import { maybeRunMarketplaceClaimReviewProfile } from './run-marketplace-claim-review-lifecycle-profile.mjs';"),
    true,
  );
  assert.equal((router.match(/maybeRunMarketplaceClaimReviewProfile\(input\)/g) || []).length, 1);
});
