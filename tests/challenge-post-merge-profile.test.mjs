import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import {
  challengePostMergeProfileCommands,
  databaseFailureLabel,
  isChallengePostMergeFiles,
} from '../scripts/run-private-profile-stage2.mjs';
import { profileAllowlist } from '../scripts/verify-private-scope.mjs';

const root = process.cwd();
const databasePath = path.join(root, 'scripts/run-challenge-runtime-database.sh');
const expectedFiles = [
  'tests/sql/trainingos_challenge_runtime_v1_e2e_runner.sql',
  'tests/test_trainingos_assessment_resume_execution_contract.py',
  'tests/test_trainingos_student_exercise_execution_contract.py',
];

test('post-merge suite selection is exact and fails closed', () => {
  assert.equal(isChallengePostMergeFiles(expectedFiles), true);
  assert.equal(isChallengePostMergeFiles([...expectedFiles].reverse()), true);
  assert.equal(isChallengePostMergeFiles(expectedFiles.slice(0, 2)), false);
  assert.equal(isChallengePostMergeFiles([...expectedFiles, 'README.md']), false);
});

test('post-merge profile exposes only fixed Learning Workspace and database stages', () => {
  assert.deepEqual(challengePostMergeProfileCommands.map((item) => item.label), [
    'install',
    'python-composition',
    'native-validation',
    'zero-permission-validation',
    'learning-workspace-node',
    'learning-workspace-core-python',
    'learning-workspace-web-python',
    'learning-workspace-assessment-python',
    'vscode-classroom-python',
    'student-exercise-python',
    'vscode-exercise-python',
    'assessment-resume-python',
    'typecheck',
    'vscode-bundle',
    'vite-build',
    'database-replay',
  ]);
  const serialized = JSON.stringify(challengePostMergeProfileCommands);
  assert.match(serialized, /tests\.test_trainingos_assessment_resume_execution_contract/);
  assert.match(serialized, /learning-workspace-bridge\.test\.mjs/);
  assert.match(serialized, /test_trainingos_learning_workspace_web_adapter_contract\.py/);
  assert.match(serialized, /run-challenge-runtime-database\.sh/);
  assert.doesNotMatch(serialized, /deploy|production database|upload-artifact/i);
});

test('database diagnostics expose allowlisted stage labels only', () => {
  assert.equal(
    databaseFailureLabel('CHALLENGE_DATABASE status=FAIL stage=fresh-reset-two'),
    'database-fresh-reset-two',
  );
  assert.equal(
    databaseFailureLabel('CHALLENGE_DATABASE status=FAIL stage=../../secret'),
    'database-replay',
  );
  assert.equal(databaseFailureLabel('raw private output'), 'database-replay');
});

test('challenge-runtime scope permits only the three bounded fix paths through existing rules', () => {
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
    'tests/test_trainingos_student_exercise_execution_contract.py',
    'trainingos_challenge_runtime_v1_e2e_runner.sql',
    'CURRENT_STAGE="fresh-bootstrap"',
    'CURRENT_STAGE="fresh-reset-one"',
    'CURRENT_STAGE="fresh-reset-two"',
    'CURRENT_STAGE="fresh-e2e"',
    'trainingos-bootstrap-manifest.json',
    'second_pass=PASS',
    'upgrade_result=NOT_APPLICABLE',
    'cleanup=PASS',
  ]) assert.ok(script.includes(marker), marker);
  assert.ok((script.match(/db reset --local --no-seed/g) ?? []).length >= 2);
  assert.match(script, /CHALLENGE_DATABASE status=FAIL stage=\$CURRENT_STAGE/);
  assert.match(script, /\\ir trainingos_challenge_runtime_v1_e2e\.sql/);
  assert.doesNotMatch(script, /upload-artifact|PRIVATE_REPO_READ_TOKEN|supabase link|supabase db push|vercel|netlify|\beval\b/i);
});
