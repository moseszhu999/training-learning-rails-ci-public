import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { validateInputs } from '../scripts/exact-head-inputs.mjs';
import {
  MARKETPLACE_MATCHING_CONTEXT_EXACT_FILES,
  isMarketplaceMatchingContextScope,
  marketplaceMatchingContextCommands,
} from '../scripts/run-marketplace-matching-context-profile.mjs';

const exactFiles = [
  'docs/architecture/trainingos-marketplace-matching-context-projection-v1.md',
  'packages/training-marketplace-participation-client/package.json',
  'packages/training-marketplace-participation-client/src/matching-context.d.ts',
  'packages/training-marketplace-participation-client/src/matching-context.mjs',
  'packages/training-marketplace-participation-client/test/matching-context.test.mjs',
  'supabase/migrations/20260805063000_trainingos_marketplace_matching_context_projection_v1.sql',
  'tests/sql/trainingos_marketplace_matching_context_projection_v1_e2e.sql',
  'tests/test_trainingos_marketplace_matching_context_projection_v1.py',
];

const profile = readFileSync(
  new URL('../scripts/run-marketplace-matching-context-profile.mjs', import.meta.url),
  'utf8',
);
const database = readFileSync(
  new URL('../scripts/run-marketplace-matching-context-database.sh', import.meta.url),
  'utf8',
);
const router = readFileSync(
  new URL('../scripts/run-marketplace-participation-profile.mjs', import.meta.url),
  'utf8',
);

test('matching context profile owns exactly eight files and one migration', () => {
  assert.deepEqual([...MARKETPLACE_MATCHING_CONTEXT_EXACT_FILES].sort(), [...exactFiles].sort());
  assert.equal(isMarketplaceMatchingContextScope(exactFiles), true);
  assert.equal(isMarketplaceMatchingContextScope(exactFiles.slice(1)), false);
  assert.equal(isMarketplaceMatchingContextScope([...exactFiles, 'package.json']), false);
  assert.equal(isMarketplaceMatchingContextScope([
    ...exactFiles.slice(0, 7),
    'apps/training-marketplace-web/object/forbidden.mjs',
  ]), false);
  assert.equal(exactFiles.filter((name) => name.startsWith('supabase/migrations/')).length, 1);
});

test('profile runs application, database, typecheck, build and bundle gates', () => {
  assert.deepEqual(
    marketplaceMatchingContextCommands.map((item) => item.label),
    [
      'install',
      'client-syntax',
      'node-client',
      'python-static',
      'declaration-typecheck',
      'database-replay',
      'typecheck',
      'production-build',
      'bundle-verification',
    ],
  );
  for (const marker of [
    'CANONICAL_MIGRATION_COUNT = 367',
    'EXPECTED_NODE_COUNT = 5',
    'EXPECTED_PYTHON_COUNT = 10',
    "scope.expected_changed_file_count === '8'",
    "scope.migration_start === '20260805063000'",
    "selectedSuite: 'marketplace-matching-context'",
  ]) assert.ok(profile.includes(marker), marker);
});

test('database runner performs fresh, second fresh, upgrade and zero-residue checks', () => {
  for (const marker of [
    'canonical_migration_count=367',
    'base_migration_count=366',
    'run_e2e "$fresh" fresh-one',
    'run_e2e "$fresh" fresh-two',
    'run_e2e "$upgrade" upgrade',
    'TRAININGOS_MARKETPLACE_MATCHING_CONTEXT_PROJECTION_V1_E2E_PASS',
    "grep -qx 'fixtures=0'",
    "grep -qx 'supply=0'",
    "grep -qx 'demand=0'",
    "grep -qx 'contact=0'",
    "grep -qx 'events=0'",
    "grep -qx 'function_count=1'",
    "grep -qx 'authenticated_execute=true'",
    "grep -qx 'anon_execute=false'",
    "grep -qx 'public_execute=false'",
    'zero_residue=PASS',
  ]) assert.ok(database.includes(marker), marker);
  assert.doesNotMatch(database, /SUPABASE_(ACCESS_TOKEN|DB_PASSWORD)/);
  assert.doesNotMatch(database, /production/i);
});

test('participation router invokes matching context before older Marketplace profiles', () => {
  assert.match(router, /maybeRunMarketplaceMatchingContextProfile/);
  const matchingIndex = router.indexOf('const matchingContext = ');
  const submissionIndex = router.indexOf('const authenticatedSubmissionUi = ');
  const onboardingIndex = router.indexOf('const onboardingIntake = ');
  const databaseIndex = router.indexOf("if (input.profile !== 'generic-owned')");
  assert.ok(matchingIndex >= 0);
  assert.ok(submissionIndex > matchingIndex);
  assert.ok(onboardingIndex > submissionIndex);
  assert.ok(databaseIndex > onboardingIndex);
});

test('generic-owned request accepts the fixed matching context contract', () => {
  const result = validateInputs({
    privateExactSha: 'a'.repeat(40),
    expectedBaseSha: 'b'.repeat(40),
    expectedMainSha: '',
    validationProfile: 'generic-owned',
    expectedChangedFileCount: '8',
    expectedMigrationRange: '20260805063000-20260805063000',
    expectedFocusedTestCounts: 'node=5;python=10',
    expectedMigrationCount: '367',
    runFreshReplay: 'true',
    runUpgradeReplay: 'true',
    runApplicationContracts: 'true',
    runTypecheck: 'true',
    runProductionBuild: 'true',
    runCriticalE2E: 'true',
  });
  assert.equal(result.ok, true);
  assert.equal(result.normalized.migrationStart, '20260805063000');
  assert.equal(result.normalized.expectedNodeCount, '5');
  assert.equal(result.normalized.expectedPythonCount, '10');
});

test('public profile exposes only sanitized status and immutable identifiers', () => {
  assert.match(profile, /MARKETPLACE_MATCHING_CONTEXT_DB status=FAIL stage=/);
  assert.match(database, /MARKETPLACE_MATCHING_CONTEXT_DB status=PASS exact_head=/);
  assert.doesNotMatch(profile, /console\.log\(output\)/);
  assert.doesNotMatch(profile, /upload-artifact/);
  assert.doesNotMatch(database, /cat .*\.log/);
});
