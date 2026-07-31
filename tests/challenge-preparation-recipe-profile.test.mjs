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
  assert.equal(
    sanitizeChallengePreparationDatabaseStage('private output\nCHALLENGE_DATABASE status=FAIL stage=fresh-bootstrap reason=unclassified\n'),
    'fresh-bootstrap',
  );
  assert.equal(
    sanitizeChallengePreparationDatabaseStage('CHALLENGE_DATABASE status=FAIL stage=private-table-name reason=secret'),
    'unknown',
  );
  assert.equal(sanitizeChallengePreparationDatabaseStage('no fixed status'), 'unknown');
});

test('database runner is exact-head, fresh, second, upgrade, rollback and cleanup bounded', async () => {
  const text = await readFile(path.join(root, 'scripts/run-challenge-preparation-recipe-database.sh'), 'utf8');
  for (const token of [
    'expected_changed_file_count" == 10',
    'EXPECTED_MIGRATION_COUNT" == 355',
    'fresh-reset-one',
    'fresh-reset-two',
    'upgrade-migration',
    'migration up --local --include-all',
    'rollback=PASS',
    'cleanup=PASS',
  ]) assert.ok(text.includes(token), token);
  assert.ok(!/artifact upload/i.test(text));
});
