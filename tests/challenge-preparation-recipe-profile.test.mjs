import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CHALLENGE_PREPARATION_EXACT_FILES,
  challengePreparationProfileCommands,
  isChallengePreparationRecipeFiles,
  sanitizeChallengePreparationDatabaseStage,
} from '../scripts/run-challenge-preparation-recipe-profile.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('Challenge Preparation selector locks exactly ten private files', () => {
  assert.equal(CHALLENGE_PREPARATION_EXACT_FILES.size, 10);
  assert.equal(isChallengePreparationRecipeFiles(CHALLENGE_PREPARATION_EXACT_FILES), true);
  assert.equal(isChallengePreparationRecipeFiles([...CHALLENGE_PREPARATION_EXACT_FILES].slice(1)), false);
  assert.ok(CHALLENGE_PREPARATION_EXACT_FILES.has('packages/training-recipe/src/adapters.mjs'));
  assert.ok(CHALLENGE_PREPARATION_EXACT_FILES.has('supabase/migrations/20260731120000_trainingos_challenge_preparation_recipe_v1.sql'));
});

test('fixed profile runs syntax, exact focused counts, build and database replay', () => {
  assert.deepEqual(challengePreparationProfileCommands.map((item) => item.label), [
    'install', 'syntax-package', 'syntax-gateway', 'syntax-adapter',
    'node-contract', 'python-contract', 'typecheck', 'production-build', 'database-replay',
  ]);
  const node = challengePreparationProfileCommands.find((item) => item.label === 'node-contract');
  const python = challengePreparationProfileCommands.find((item) => item.label === 'python-contract');
  const database = challengePreparationProfileCommands.find((item) => item.label === 'database-replay');
  assert.equal(node.kind, 'node');
  assert.equal(python.kind, 'python');
  assert.equal(database.kind, 'database');
});

test('database failure stage is allowlisted and private output stays sealed', () => {
  for (const stage of [
    'scope-inputs', 'scope-files', 'scope-migration-count', 'scope-head', 'scope-e2e-contract',
    'fresh-bootstrap', 'fresh-manifest', 'upgrade-manifest', 'upgrade-base-reset',
    'upgrade-copy-migration', 'upgrade-apply', 'upgrade-e2e',
  ]) {
    assert.equal(
      sanitizeChallengePreparationDatabaseStage(`private output\nCHALLENGE_DATABASE status=FAIL stage=${stage} reason=unclassified\n`),
      stage,
    );
  }
  assert.equal(
    sanitizeChallengePreparationDatabaseStage('CHALLENGE_DATABASE status=FAIL stage=private-table-name reason=secret'),
    'unknown',
  );
  assert.equal(sanitizeChallengePreparationDatabaseStage('no fixed status'), 'unknown');
});

test('database runner distinguishes source and generated bootstrap migration totals', async () => {
  const text = await readFile(path.join(root, 'scripts/run-challenge-preparation-recipe-database.sh'), 'utf8');
  for (const token of [
    'CURRENT_STAGE="scope-inputs"',
    'CURRENT_STAGE="scope-files"',
    'CURRENT_STAGE="scope-migration-count"',
    'CURRENT_STAGE="scope-head"',
    'CURRENT_STAGE="scope-e2e-contract"',
    'expected_changed_file_count" == 10',
    'EXPECTED_MIGRATION_COUNT" == 353',
    'base_source_migration_count=352',
    'fresh_bootstrap_migration_count=355',
    'base_bootstrap_migration_count=354',
    'EXPECTED_MIGRATION_COUNT + 2',
    'base_source_migration_count + 2',
    'manifest_count "$fresh_project/supabase/trainingos-bootstrap-manifest.json"',
    'manifest_count "$upgrade_project/supabase/trainingos-bootstrap-manifest.json"',
    'fresh-reset-one',
    'fresh-reset-two',
    'CURRENT_STAGE="upgrade-base-reset"',
    'CURRENT_STAGE="upgrade-copy-migration"',
    'CURRENT_STAGE="upgrade-apply"',
    'migration up --local --include-all',
    'rollback=PASS',
    'cleanup=PASS',
  ]) assert.ok(text.includes(token), token);
  assert.ok(!/artifact upload/i.test(text));
});
