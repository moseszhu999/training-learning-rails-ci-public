import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PORTABLE_PROFESSIONAL_LEARNING_DB_EXACT_FILES,
  PORTABLE_PROFESSIONAL_LEARNING_DB_RUNNER,
  isPortableProfessionalLearningDbScope,
  portableProfessionalLearningDbCommands,
  sanitizePortableProfessionalLearningDatabaseStatusFile,
} from '../scripts/run-portable-professional-learning-db-profile.mjs';

test('locks the exact five-file P1 persistence scope', () => {
  const files = [...PORTABLE_PROFESSIONAL_LEARNING_DB_EXACT_FILES];
  assert.equal(files.length, 5);
  assert.equal(isPortableProfessionalLearningDbScope(files), true);
  assert.equal(isPortableProfessionalLearningDbScope(files.slice(1)), false);
  assert.equal(isPortableProfessionalLearningDbScope([...files, 'README.md']), false);
});

test('scope includes exactly two P1 migrations and the SQL E2E', () => {
  const files = [...PORTABLE_PROFESSIONAL_LEARNING_DB_EXACT_FILES];
  const migrations = files.filter((name) => name.startsWith('supabase/migrations/'));
  assert.deepEqual(migrations.sort(), [
    'supabase/migrations/20260812200600_trainingos_portable_professional_learning_state_v1.sql',
    'supabase/migrations/20260812200700_trainingos_portable_professional_learning_state_v1_hardening.sql',
  ]);
  assert.ok(files.includes('tests/sql/trainingos_portable_professional_learning_state_v1_e2e.sql'));
});

test('fixed profile runs focused contracts, shell validation, database replay and build gates', () => {
  assert.deepEqual(portableProfessionalLearningDbCommands.map((item) => item.label), [
    'install',
    'focused-node-contracts',
    'db-runner-shell-syntax',
    'db-runner-shellcheck',
    'database-replay',
    'repository-typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
});

test('focused Node command uses one explicit test path without shell globbing', () => {
  const focused = portableProfessionalLearningDbCommands.find((item) => item.label === 'focused-node-contracts');
  assert.deepEqual(focused.args, [
    '--test',
    'tests/training-portable-professional-learning-state-v1.test.mjs',
  ]);
});

test('database runner path is fixed public controller code', () => {
  assert.match(PORTABLE_PROFESSIONAL_LEARNING_DB_RUNNER, /scripts\/run-portable-professional-learning-db-profile\.sh$/);
});

test('database status sanitizer exposes only fixed safe stages', () => {
  assert.equal(sanitizePortableProfessionalLearningDatabaseStatusFile('stage=fresh-sql-e2e\n'), 'fresh-sql-e2e');
  assert.equal(sanitizePortableProfessionalLearningDatabaseStatusFile('stage=upgrade-apply\n'), 'upgrade-apply');
  assert.equal(sanitizePortableProfessionalLearningDatabaseStatusFile('stage=complete\n'), 'complete');
  assert.equal(sanitizePortableProfessionalLearningDatabaseStatusFile('stage=private-secret-value\n'), 'unknown');
  assert.equal(sanitizePortableProfessionalLearningDatabaseStatusFile(''), 'unknown');
});
