import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import {
  challengePostMergeProfileCommands,
  isChallengePostMergeFiles,
} from '../scripts/run-private-profile-stage2.mjs';
import { profileAllowlist } from '../scripts/verify-private-scope.mjs';

const root = process.cwd();
const databasePath = path.join(root, 'scripts/run-challenge-runtime-database.sh');
const expectedFiles = [
  'tests/sql/trainingos_challenge_runtime_v1_e2e_runner.sql',
  'tests/test_trainingos_assessment_resume_execution_contract.py',
];

test('post-merge suite selection is exact and fails closed', () => {
  assert.equal(isChallengePostMergeFiles(expectedFiles), true);
  assert.equal(isChallengePostMergeFiles([...expectedFiles].reverse()), true);
  assert.equal(isChallengePostMergeFiles(expectedFiles.slice(0, 1)), false);
  assert.equal(isChallengePostMergeFiles([...expectedFiles, 'README.md']), false);
});

test('post-merge profile locks composition, split build, and database replay', () => {
  assert.deepEqual(challengePostMergeProfileCommands.map((item) => item.label), [
    'install',
    'python-composition',
    'native-validation',
    'zero-permission-validation',
    'learning-workspace-validation',
    'typecheck',
    'vscode-bundle',
    'vite-build',
    'database-replay',
  ]);
  const serialized = JSON.stringify(challengePostMergeProfileCommands);
  assert.match(serialized, /tests\.test_trainingos_assessment_resume_execution_contract/);
  assert.match(serialized, /run-trainingos-learning-workspace-bridge-validation\.mjs/);
  assert.match(serialized, /run-challenge-runtime-database\.sh/);
  assert.doesNotMatch(serialized, /deploy|production database|upload-artifact/i);
});

test('challenge-runtime scope permits only the two bounded fix paths through existing rules', () => {
  const allowlist = profileAllowlist['challenge-runtime'];
  for (const file of expectedFiles) {
    assert.equal(allowlist.some((rule) => rule.test(file)), true, file);
  }
  assert.equal(allowlist.some((rule) => rule.test('tests/test_trainingos_unrelated_contract.py')), false);
});

test('database controller supports no-migration post-merge replay safely', async () => {
  const script = await readFile(databasePath, 'utf8');
  const syntax = spawnSync('bash', ['-n', databasePath], { cwd: root, encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr);
  for (const marker of [
    'suite=postmerge',
    'tests/test_trainingos_assessment_resume_execution_contract.py',
    'trainingos_challenge_runtime_v1_e2e_runner.sql',
    'migration_start" == none',
    'trainingos-bootstrap-manifest.json',
    'second_pass=PASS',
    'upgrade_result=NOT_APPLICABLE',
    'cleanup=PASS',
  ]) assert.ok(script.includes(marker), marker);
  assert.ok((script.match(/db reset --local --no-seed/g) ?? []).length >= 2);
  assert.match(script, /\\ir trainingos_challenge_runtime_v1_e2e\.sql/);
  assert.doesNotMatch(script, /upload-artifact|PRIVATE_REPO_READ_TOKEN|supabase link|supabase db push|vercel|netlify|\beval\b/i);
});
