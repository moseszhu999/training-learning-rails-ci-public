import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateInputs } from '../scripts/exact-head-inputs.mjs';
import {
  isMarketplaceClaimReviewScope,
  MARKETPLACE_CLAIM_REVIEW_EXACT_FILES,
} from '../scripts/run-marketplace-claim-review-profile.mjs';

const profile = readFileSync(new URL('../scripts/run-marketplace-claim-review-profile.mjs', import.meta.url), 'utf8');
const database = readFileSync(new URL('../scripts/run-marketplace-claim-review-database.sh', import.meta.url), 'utf8');
const router = readFileSync(new URL('../scripts/run-private-profile.mjs', import.meta.url), 'utf8');

const exactFiles = [
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

test('claim review profile owns exactly nine files and one migration', () => {
  assert.deepEqual([...MARKETPLACE_CLAIM_REVIEW_EXACT_FILES].sort(), [...exactFiles].sort());
  assert.equal(isMarketplaceClaimReviewScope(exactFiles), true);
  assert.equal(isMarketplaceClaimReviewScope([...exactFiles, 'package.json']), false);
  assert.equal(isMarketplaceClaimReviewScope(exactFiles.slice(1)), false);
});

test('claim review profile runs fixed focused, database and build gates', () => {
  for (const marker of [
    'CANONICAL_MIGRATION_COUNT = 366',
    'EXPECTED_NODE_COUNT = 7',
    'EXPECTED_PYTHON_COUNT = 12',
    'claim-review.test.mjs',
    'test_trainingos_marketplace_claim_review_lifecycle_v1.py',
    'run-marketplace-claim-review-database.sh',
    "command('typecheck'",
    "command('production-build'",
    "command('bundle-verification'",
    "selectedSuite: 'marketplace-claim-review'",
  ]) assert.ok(profile.includes(marker), marker);
});

test('database runner performs fresh, repeated and upgrade replay with ACL and residue gates', () => {
  for (const marker of [
    'canonical_migration_count=366',
    'base_migration_count=365',
    '20260804222000_trainingos_marketplace_claim_review_lifecycle_v1.sql',
    'run_e2e "$fresh" fresh-one',
    'run_e2e "$fresh" fresh-two',
    'run_e2e "$upgrade" upgrade',
    'migration up --local --include-all',
    'TRAININGOS_MARKETPLACE_CLAIM_REVIEW_LIFECYCLE_V1_E2E_PASS',
    'table_owner=1',
    'public_rpcs=3',
    'immutable_trigger=1',
    'authenticated_table_privileges=0',
    'elevated_table_privileges=0',
    'authenticated_rpc_exec=3',
    'forbidden_rpc_exec=0',
    'decisions=0',
  ]) assert.ok(database.includes(marker), marker);
  assert.doesNotMatch(database, /--linked/);
  assert.doesNotMatch(database, /SUPABASE_(ACCESS_TOKEN|DB_PASSWORD)/);
  assert.doesNotMatch(database, /deploy/i);
});

test('claim review profile is routed before Marketplace Participation fallback', () => {
  assert.match(router, /maybeRunMarketplaceClaimReviewProfile/);
  const reviewIndex = router.indexOf('const marketplaceClaimReview');
  const participationIndex = router.indexOf('const marketplaceParticipation');
  assert.ok(reviewIndex >= 0);
  assert.ok(participationIndex > reviewIndex);
});

test('generic-owned request accepts the claim review contract', () => {
  const result = validateInputs({
    privateExactSha: 'a'.repeat(40),
    expectedBaseSha: 'b'.repeat(40),
    expectedMainSha: '',
    validationProfile: 'generic-owned',
    expectedChangedFileCount: '9',
    expectedMigrationRange: '20260804222000-20260804222000',
    expectedFocusedTestCounts: 'node=7;python=12',
    expectedMigrationCount: '366',
    runFreshReplay: 'true',
    runUpgradeReplay: 'true',
    runApplicationContracts: 'true',
    runTypecheck: 'true',
    runProductionBuild: 'true',
    runCriticalE2E: 'false',
  });
  assert.equal(result.ok, true);
});
