import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  MULTIROLE_FINAL_GATE_EXACT_FILES,
  isMultiroleFinalGateScope,
  multiroleFinalGateCommands,
} from '../scripts/run-multirole-final-gate-profile.mjs';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('multirole final gate locks exact private three-file scope', () => {
  assert.equal(MULTIROLE_FINAL_GATE_EXACT_FILES.size, 3);
  assert.equal(isMultiroleFinalGateScope([...MULTIROLE_FINAL_GATE_EXACT_FILES]), true);
  assert.equal(isMultiroleFinalGateScope([
    ...MULTIROLE_FINAL_GATE_EXACT_FILES,
    'supabase/migrations/20260801999999_forbidden.sql',
  ]), false);
});

test('multirole profile runs web, integrated assignment, database, typecheck and build gates', () => {
  const labels = multiroleFinalGateCommands.map((item) => item.label);
  assert.deepEqual(labels, [
    'install',
    'python-web-contract',
    'python-assignment-contract',
    'database-replay',
    'typecheck',
    'production-build',
  ]);
  const serialized = JSON.stringify(multiroleFinalGateCommands);
  assert.match(serialized, /test_trainingos_multirole_zero_admin_entry_v1_contract/);
  assert.match(serialized, /run-multirole-integrated-assignment-contract\.py/);
  assert.match(serialized, /run-multirole-final-gate-database\.sh/);
  assert.match(serialized, /vite/);
});

test('integrated assignment runner excludes only obsolete historical branch scope', async () => {
  const source = await read('../scripts/run-multirole-integrated-assignment-contract.py');
  assert.match(source, /ClassOperationsAssignmentV1Contract/);
  assert.match(source, /test_01_changed_files_are_exactly_the_three_owned_files/);
  assert.match(source, /len\(names\) != 14/);
  assert.doesNotMatch(source, /mock|monkeypatch|changed_files\s*=/);
});

test('database runner binds exact head and performs two fresh replays', async () => {
  const source = await read('../scripts/run-multirole-final-gate-database.sh');
  for (const token of [
    'canonical_migration_count=357',
    'PRIVATE_EXACT_SHA',
    'build-trainingos-fresh-bootstrap.py',
    'fresh-reset-one',
    'fresh-reset-two',
    'trainingos_class_operations_assignment_v1_e2e.sql',
    'teacherAuthorityGranted',
    'gradingAuthorityGranted',
    'assessmentAuthorityGranted',
    'publicationAuthorityGranted',
    'administratorAuthorityGranted',
    'fixtureCleanup',
    'remainingAssignments',
    'remainingEvents',
    'remainingAuthUsers',
    'zero_residue=PASS',
  ]) assert.ok(source.includes(token), token);
  assert.doesNotMatch(source, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  assert.doesNotMatch(source, /artifact|deploy|production database/i);
});

test('controller routes exact scope before generic fallback', async () => {
  const source = await read('../scripts/run-private-profile.mjs');
  assert.match(source, /maybeRunMultiroleFinalGateProfile/);
  assert.match(source, /multirole-final-gate/);
  assert.doesNotMatch(source, /upload-artifact|production deploy/i);
});
