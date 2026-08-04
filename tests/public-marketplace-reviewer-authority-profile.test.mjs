import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateInputs } from '../scripts/exact-head-inputs.mjs';
import { parseMarketplaceReviewerAuthorityPythonFailure } from '../scripts/run-marketplace-reviewer-authority-profile.mjs';

const profile = readFileSync(new URL('../scripts/run-marketplace-reviewer-authority-profile.mjs', import.meta.url), 'utf8');
const database = readFileSync(new URL('../scripts/run-marketplace-reviewer-authority-database.sh', import.meta.url), 'utf8');
const router = readFileSync(new URL('../scripts/run-private-profile.mjs', import.meta.url), 'utf8');

const escaped = (value) => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

test('reviewer authority runner is exact to nine private files', () => {
  for (const marker of [
    'docs/product/trainingos-marketplace-reviewer-authority-owner-v1.md',
    'docs/testing/trainingos-marketplace-reviewer-authority-owner-v1-audit.md',
    'packages/training-marketplace-reviewer-authority/package.json',
    'packages/training-marketplace-reviewer-authority/src/index.d.ts',
    'packages/training-marketplace-reviewer-authority/src/index.mjs',
    'packages/training-marketplace-reviewer-authority/test/reviewer-authority.test.mjs',
    'supabase/migrations/20260804212000_trainingos_marketplace_reviewer_authority_owner_v1.sql',
    'tests/sql/trainingos_marketplace_reviewer_authority_owner_v1_e2e.sql',
    'tests/test_trainingos_marketplace_reviewer_authority_owner_v1.py',
    'names.length === MARKETPLACE_REVIEWER_AUTHORITY_EXACT_FILES.size',
    "scope.expected_changed_file_count === '9'",
    "scope.migration_start === '20260804212000'",
    "scope.migration_end === '20260804212000'",
  ]) assert.match(profile, escaped(marker));
});

test('reviewer authority runner executes fixed node, direct Python, database and build gates', () => {
  for (const marker of [
    "command('node-adapter'",
    'reviewer-authority.test.mjs',
    "command('python-static'",
    "'tests/test_trainingos_marketplace_reviewer_authority_owner_v1.py'",
    "command('database-replay'",
    'run-marketplace-reviewer-authority-database.sh',
    "command('typecheck'",
    "command('production-build'",
    "command('bundle-verification'",
    'EXPECTED_NODE_COUNT = 5',
    'EXPECTED_PYTHON_COUNT = 9',
    'CANONICAL_MIGRATION_COUNT = 365',
    "selectedSuite: 'marketplace-reviewer-authority'",
  ]) assert.match(profile, escaped(marker));
  assert.doesNotMatch(profile, /tests\.test_trainingos_marketplace_reviewer_authority_owner_v1/);
});

test('Python failures publish only an allowlisted test category and stop before database replay', () => {
  assert.equal(
    parseMarketplaceReviewerAuthorityPythonFailure(
      'Traceback\n  File "sealed", line 1, in test_public_rpc_has_no_identity_or_role_selector_and_performs_no_decision\nAssertionError',
    ),
    'public-rpc-boundary',
  );
  assert.equal(
    parseMarketplaceReviewerAuthorityPythonFailure(
      'Traceback\n  File "sealed", line 1, in test_unapproved_private_name\nAssertionError',
    ),
    'unknown',
  );
  assert.match(profile, /python-static-\$\{parseMarketplaceReviewerAuthorityPythonFailure\(output\)\}/);
  assert.match(profile, /if \(item\.kind === 'python'\) break;/);
});

test('database profile runs fresh, repeated and upgrade replay without production access', () => {
  for (const marker of [
    'canonical_migration_count=365',
    'base_migration_count=364',
    '20260804212000_trainingos_marketplace_reviewer_authority_owner_v1.sql',
    'run_e2e "$fresh" fresh-one',
    'run_e2e "$fresh" fresh-two',
    'run_e2e "$upgrade" upgrade',
    'migration up --local --include-all',
    'tables=1',
    'public_rpcs=1',
    'private_guards=3',
    'authenticated_table_privileges=0',
    'elevated_table_privileges=0',
    'forbidden_public_rpc_exec=0',
    'network_operator_exec=0',
    'forbidden_lifecycle_rpcs=0',
    'forbidden_receipt_table=0',
    'authority_events=0',
    'TRAININGOS_MARKETPLACE_REVIEWER_AUTHORITY_OWNER_V1_E2E_PASS',
  ]) assert.match(database, escaped(marker));
  assert.doesNotMatch(database, /--linked/);
  assert.doesNotMatch(database, /SUPABASE_(ACCESS_TOKEN|DB_PASSWORD)/);
  const elevatedKey = ['SUPABASE', 'SERVICE', 'ROLE'].join('_');
  assert.equal(database.includes(elevatedKey), false);
  assert.doesNotMatch(database, /deploy/i);
});

test('reviewer authority profile is routed before Marketplace Participation fallback', () => {
  assert.match(router, /maybeRunMarketplaceReviewerAuthorityProfile/);
  const authorityIndex = router.indexOf('const marketplaceReviewerAuthority');
  const participationIndex = router.indexOf('const marketplaceParticipation');
  assert.ok(authorityIndex >= 0);
  assert.ok(participationIndex > authorityIndex);
});

test('generic-owned request inputs accept the fixed database profile contract', () => {
  const result = validateInputs({
    privateExactSha: 'a'.repeat(40),
    expectedBaseSha: 'b'.repeat(40),
    expectedMainSha: '',
    validationProfile: 'generic-owned',
    expectedChangedFileCount: '9',
    expectedMigrationRange: '20260804212000-20260804212000',
    expectedFocusedTestCounts: 'node=5;python=9',
    expectedMigrationCount: '365',
    runFreshReplay: 'true',
    runUpgradeReplay: 'true',
    runApplicationContracts: 'true',
    runTypecheck: 'true',
    runProductionBuild: 'true',
    runCriticalE2E: 'false',
  });
  assert.equal(result.ok, true);
});
