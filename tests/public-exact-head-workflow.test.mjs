import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { standardValidationProfiles, validationProfiles, validateInputs } from '../scripts/exact-head-inputs.mjs';
import { profileCommands } from '../scripts/run-private-profile.mjs';

const root = process.cwd();
const workflowPath = path.join(root, '.github/workflows/trainingos-public-exact-head.yml');
const challengeDatabasePath = path.join(root, 'scripts/run-challenge-runtime-database.sh');

const valid = {
  privateExactSha: 'a'.repeat(40),
  expectedBaseSha: 'b'.repeat(40),
  expectedMainSha: '',
  validationProfile: 'generic-owned',
  expectedChangedFileCount: '12',
  expectedMigrationRange: '20260728120000-20260728125999',
  expectedFocusedTestCounts: 'node=0;python=0',
  expectedMigrationCount: '0',
};

test('dispatch input contract is strict, lowercase, and profile-specific', () => {
  assert.equal(validateInputs(valid).ok, true);
  assert.equal(validateInputs({ ...valid, privateExactSha: 'A'.repeat(40) }).ok, false);
  assert.equal(validateInputs({ ...valid, expectedBaseSha: 'main' }).ok, false);
  assert.equal(validateInputs({ ...valid, validationProfile: 'shell' }).ok, false);
  assert.equal(validateInputs({ ...valid, expectedChangedFileCount: '1;rm' }).ok, false);
  assert.equal(validateInputs({ ...valid, expectedMigrationRange: '20260728125999-20260728120000' }).ok, false);
  assert.equal(validateInputs({ ...valid, expectedFocusedTestCounts: 'node=1,python=2' }).ok, false);
  assert.equal(validateInputs({ ...valid, expectedMigrationRange: 'none' }).ok, true);
  assert.equal(validateInputs({ ...valid, validationProfile: 'challenge-runtime', expectedMigrationCount: '305' }).ok, true);
  assert.equal(validateInputs({ ...valid, validationProfile: 'challenge-runtime', expectedMigrationRange: 'none', expectedMigrationCount: '305' }).ok, false);
  const mainSha = 'c'.repeat(40);
  assert.equal(validateInputs({
    ...valid,
    privateExactSha: mainSha,
    expectedBaseSha: mainSha,
    expectedMainSha: mainSha,
    validationProfile: 'main-release',
    expectedChangedFileCount: '0',
    expectedMigrationRange: 'none',
    expectedFocusedTestCounts: 'node=0;python=0',
    expectedMigrationCount: '305',
    runFreshReplay: 'true',
    runUpgradeReplay: 'true',
    runApplicationContracts: 'true',
    runTypecheck: 'true',
    runProductionBuild: 'true',
    runCriticalE2E: 'true',
  }).ok, true);
});

test('all feature profiles are fixed command maps', () => {
  assert.deepEqual(Object.keys(profileCommands).sort(), [...standardValidationProfiles].sort());
  assert.ok(validationProfiles.includes('main-release'));
  for (const commands of Object.values(profileCommands)) {
    assert.ok(commands.length > 0);
    for (const item of commands) {
      assert.equal(typeof item.executable, 'string');
      assert.ok(Array.isArray(item.args));
      assert.equal(Object.hasOwn(item, 'shell'), false);
    }
  }
});

test('Challenge profile preserves focused proof/share contracts and isolated database replay', () => {
  const commands = profileCommands['challenge-runtime'];
  assert.deepEqual(commands.map((item) => item.label), [
    'install',
    'syntax-package',
    'syntax-gateway',
    'node-contract',
    'python-contract',
    'typecheck',
    'production-build',
    'database-replay',
  ]);
  const serialized = JSON.stringify(commands);
  assert.match(serialized, /challenge-proof-share-v1/);
  assert.match(serialized, /run-challenge-runtime-database\.sh/);
  assert.doesNotMatch(serialized, /deploy|production database/i);
});

test('web, hub, and docs profiles are fixed and non-deploying', () => {
  assert.ok(profileCommands['challenge-web'].some((item) => item.label === 'playwright'));
  assert.ok(profileCommands['teacher-hub'].some((item) => item.label === 'hub-contract'));
  assert.deepEqual(profileCommands['docs-launch'].map((item) => item.label), ['markdown-contract']);
  assert.doesNotMatch(JSON.stringify({
    web: profileCommands['challenge-web'],
    hub: profileCommands['teacher-hub'],
    docs: profileCommands['docs-launch'],
  }), /vercel|netlify deploy|supabase push/i);
});

test('workflow keeps public boundary, exact-main, and sealed-output rules', async () => {
  const workflow = await readFile(workflowPath, 'utf8');
  for (const input of [
    'privateExactSha',
    'expectedBaseSha',
    'expectedMainSha',
    'validationProfile',
    'expectedChangedFileCount',
    'expectedMigrationRange',
    'expectedFocusedTestCounts',
    'expectedMigrationCount',
  ]) assert.match(workflow, new RegExp(`${input}:`));
  for (const profile of validationProfiles) assert.match(workflow, new RegExp(`- ${profile}`));
  assert.match(workflow, /permissions:\n  contents: read/);
  assert.match(workflow, /PRIVATE_REPO_READ_TOKEN/);
  assert.ok((workflow.match(/persist-credentials: false/g) ?? []).length >= 3);
  assert.doesNotMatch(workflow, /upload-artifact/);
  assert.doesNotMatch(workflow, /pull_request:/);
  assert.match(workflow, /Check out current private main ref/);
  assert.match(workflow, /Run fixed latest-main release gate/);
  assert.match(workflow, /Raw private output remains runner-local, sealed, and deleted/);
  const enforcement = workflow.indexOf('Enforce final exact-head result');
  const cleanup = workflow.indexOf('Remove private checkout and sealed files');
  assert.ok(enforcement > 0 && cleanup > enforcement);
});

test('Challenge database script is fixed, syntax-valid, sealed, and non-deploying', async () => {
  const script = await readFile(challengeDatabasePath, 'utf8');
  const syntax = spawnSync('bash', ['-n', challengeDatabasePath], { cwd: root, encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr);
  assert.match(script, /trainingos_challenge_proof_share_v1_e2e_runner\.sql/);
  assert.match(script, /supabase db reset --local --no-seed/);
  assert.match(script, /supabase migration up --local/);
  assert.match(script, /worktree add --detach/);
  assert.match(script, /cleanup=PASS/);
  assert.doesNotMatch(script, /upload-artifact|PRIVATE_REPO_READ_TOKEN|supabase link|supabase db push|vercel|netlify/i);
  assert.doesNotMatch(script, /\beval\b/);
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
      EXPECTED_MAIN_SHA: valid.expectedMainSha,
      VALIDATION_PROFILE: valid.validationProfile,
      EXPECTED_CHANGED_FILE_COUNT: valid.expectedChangedFileCount,
      EXPECTED_MIGRATION_RANGE: valid.expectedMigrationRange,
      EXPECTED_FOCUSED_TEST_COUNTS: valid.expectedFocusedTestCounts,
      EXPECTED_MIGRATION_COUNT: valid.expectedMigrationCount,
    },
  });
  assert.equal(result.status, 0);
  const content = await readFile(output, 'utf8');
  assert.match(content, /^status=PASS$/m);
  assert.match(content, /^expected_node_count=0$/m);
  assert.doesNotMatch(content, /PRIVATE_REPO_READ_TOKEN/);
  await rm(temp, { recursive: true, force: true });
});
