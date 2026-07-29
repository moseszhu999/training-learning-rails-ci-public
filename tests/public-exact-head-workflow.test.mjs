import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { validationProfiles, validateInputs } from '../scripts/exact-head-inputs.mjs';
import { profileCommands } from '../scripts/run-private-profile.mjs';

const root = process.cwd();
const workflowPath = path.join(root, '.github/workflows/trainingos-public-exact-head.yml');

const valid = {
  privateExactSha: 'a'.repeat(40),
  expectedBaseSha: 'b'.repeat(40),
  validationProfile: 'generic-owned',
  expectedChangedFileCount: '12',
  expectedMigrationRange: '20260728120000-20260728125999',
  expectedFocusedTestCounts: 'node=0;python=0',
};

test('dispatch input contract is strict and lowercase', () => {
  assert.equal(validateInputs(valid).ok, true);
  assert.equal(validateInputs({ ...valid, privateExactSha: 'A'.repeat(40) }).ok, false);
  assert.equal(validateInputs({ ...valid, expectedBaseSha: 'main' }).ok, false);
  assert.equal(validateInputs({ ...valid, validationProfile: 'shell' }).ok, false);
  assert.equal(validateInputs({ ...valid, expectedChangedFileCount: '1;rm' }).ok, false);
  assert.equal(validateInputs({ ...valid, expectedMigrationRange: '20260728125999-20260728120000' }).ok, false);
  assert.equal(validateInputs({ ...valid, expectedFocusedTestCounts: 'node=1,python=2' }).ok, false);
  assert.equal(validateInputs({ ...valid, expectedMigrationRange: 'none' }).ok, true);
  assert.equal(validateInputs({ ...valid, validationProfile: 'challenge-runtime' }).ok, true);
});

test('all profiles are fixed command maps', () => {
  assert.deepEqual(Object.keys(profileCommands).sort(), [...validationProfiles].sort());
  for (const commands of Object.values(profileCommands)) {
    assert.ok(commands.length > 0);
    for (const item of commands) {
      assert.equal(typeof item.executable, 'string');
      assert.ok(Array.isArray(item.args));
      assert.equal(Object.hasOwn(item, 'shell'), false);
    }
  }
});

test('Challenge profile is fixed, focused, and non-deploying', () => {
  const commands = profileCommands['challenge-runtime'];
  assert.deepEqual(commands.map((item) => item.label), [
    'install',
    'syntax-package',
    'syntax-gateway',
    'node-contract',
    'python-contract',
    'typecheck',
    'production-build',
  ]);
  const serialized = JSON.stringify(commands);
  assert.match(serialized, /challenge-proof-share-v1/);
  assert.doesNotMatch(serialized, /deploy|service_role|production database/i);
});

test('workflow keeps the public boundary and sealed-output rules', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  for (const input of [
    'privateExactSha',
    'expectedBaseSha',
    'validationProfile',
    'expectedChangedFileCount',
    'expectedMigrationRange',
    'expectedFocusedTestCounts',
  ]) assert.match(workflow, new RegExp(`${input}:`));
  for (const profile of validationProfiles) assert.match(workflow, new RegExp(`- ${profile}`));
  assert.match(workflow, /permissions:\n  contents: read/);
  assert.match(workflow, /PRIVATE_REPO_READ_TOKEN/);
  assert.equal((workflow.match(/persist-credentials: false/g) ?? []).length, 4);
  assert.doesNotMatch(workflow, /upload-artifact/);
  assert.doesNotMatch(workflow, /pull_request:/);
  assert.match(workflow, /challenge-database:/);
  assert.match(workflow, /build-trainingos-fresh-bootstrap\.py/);
  assert.match(workflow, /supabase db reset --local --no-seed/);
  assert.match(workflow, /supabase migration up --local/);
  assert.match(workflow, /trainingos_challenge_proof_share_v1_e2e_runner\.sql/);
  assert.match(workflow, /No artifact is uploaded and no production database is contacted/);
  const enforcement = workflow.indexOf('Enforce final exact-head result');
  const cleanup = workflow.indexOf('Remove private checkout and sealed files');
  const dbEnforcement = workflow.indexOf('Enforce Challenge database result');
  const dbCleanup = workflow.indexOf('Remove private checkouts, local databases, and sealed output');
  assert.ok(enforcement > 0 && cleanup > enforcement);
  assert.ok(dbEnforcement > 0 && dbCleanup > dbEnforcement);
});

test('CLI publishes only normalized status fields', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'trainingos-inputs-'));
  const output = path.join(temp, 'output.txt');
  const result = spawnSync(process.execPath, ['scripts/exact-head-inputs.mjs'], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      GITHUB_OUTPUT: output,
      PRIVATE_EXACT_SHA: valid.privateExactSha,
      EXPECTED_BASE_SHA: valid.expectedBaseSha,
      VALIDATION_PROFILE: valid.validationProfile,
      EXPECTED_CHANGED_FILE_COUNT: valid.expectedChangedFileCount,
      EXPECTED_MIGRATION_RANGE: valid.expectedMigrationRange,
      EXPECTED_FOCUSED_TEST_COUNTS: valid.expectedFocusedTestCounts,
    },
  });
  assert.equal(result.status, 0);
  const content = await readFile(output, 'utf8');
  assert.match(content, /^status=PASS$/m);
  assert.match(content, /^expected_node_count=0$/m);
  assert.doesNotMatch(content, /PRIVATE_REPO_READ_TOKEN/);
  await rm(temp, { recursive: true, force: true });
});
