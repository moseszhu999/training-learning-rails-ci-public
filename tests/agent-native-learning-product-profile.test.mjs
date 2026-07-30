import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  agentNativeLearningProductCommands,
  goldenPathContractFiles,
  goldenPathCoverageMarkers,
} from '../scripts/run-agent-native-learning-product-profile.mjs';
import { validateInputs, validationProfiles } from '../scripts/exact-head-inputs.mjs';
import { profileAllowlist } from '../scripts/verify-private-scope.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHA = 'a'.repeat(40);
const BASE = 'b'.repeat(40);

test('agent-native-learning-product is a fixed reusable profile', () => {
  assert.ok(validationProfiles.includes('agent-native-learning-product'));
  assert.ok(profileAllowlist['agent-native-learning-product']);
  assert.deepEqual(goldenPathCoverageMarkers, [
    'mcp-composition-order',
    'workbuddy-ordinary-user-boundary',
    'teacher-role',
    'student-role',
    'cross-tenant-denial',
    'draft-preparation',
    'publish-confirmation',
    'assignment-confirmation',
    'student-attempt',
    'governed-hint',
    'evidence',
    'human-submission-confirmation',
    'teacher-review',
  ]);
  assert.equal(goldenPathContractFiles.length, 5);
});

test('profile input contract fixes migration and focused-count sentinels', () => {
  const result = validateInputs({
    privateExactSha: SHA,
    expectedBaseSha: BASE,
    expectedMainSha: '',
    validationProfile: 'agent-native-learning-product',
    expectedChangedFileCount: '12',
    expectedMigrationRange: 'none',
    expectedFocusedTestCounts: 'node=0;python=0',
    expectedMigrationCount: '0',
  });
  assert.equal(result.ok, true);

  assert.equal(validateInputs({
    ...result.normalized,
    validationProfile: 'agent-native-learning-product',
    expectedMigrationRange: '20260731000000-20260731005959',
    expectedFocusedTestCounts: 'node=0;python=0',
    expectedMigrationCount: '1',
  }).ok, false);
});

test('fixed stages cover contracts, build, playwright and database replay', () => {
  assert.deepEqual(agentNativeLearningProductCommands.map((item) => item.label), [
    'install',
    'syntax-vercel-mcp',
    'syntax-netlify-mcp',
    'golden-path-node-contract',
    'golden-path-python-contract',
    'typecheck',
    'production-build',
    'playwright-install',
    'playwright',
    'database-replay',
  ]);
  const playwright = agentNativeLearningProductCommands.find((item) => item.label === 'playwright');
  const database = agentNativeLearningProductCommands.at(-1);
  assert.equal(playwright.executable, 'bash');
  assert.match(playwright.args[0], /run-agent-native-learning-product-playwright\.sh$/);
  assert.equal(database.executable, 'bash');
  assert.match(database.args[0], /run-agent-native-learning-product-database\.sh$/);
  for (const item of agentNativeLearningProductCommands) {
    assert.match(item.label, /^[a-z0-9][a-z0-9-]+$/);
    assert.ok(Object.isFrozen(item.args));
    assert.equal(item.args.some((arg) => arg.includes('${')), false);
  }
});

test('workflow preserves read-only checkout and sanitized runner-local output', async () => {
  const workflow = await readFile(path.join(root, '.github/workflows/trainingos-public-exact-head.yml'), 'utf8');
  const playwright = await readFile(path.join(root, 'scripts/run-agent-native-learning-product-playwright.sh'), 'utf8');
  const database = await readFile(path.join(root, 'scripts/run-agent-native-learning-product-database.sh'), 'utf8');
  assert.match(workflow, /agent-native-learning-product/);
  assert.match(workflow, /persist-credentials: false/);
  assert.doesNotMatch(workflow, /upload-artifact/);
  assert.doesNotMatch(workflow, /uses:\s+[^\n]*deploy/i);
  assert.doesNotMatch(workflow, /\b(?:netlify|vercel)\s+deploy\b/i);
  assert.match(workflow, /trainingos-profile-controller\.log/);
  assert.match(playwright, /umask 077/);
  assert.match(playwright, /VITE_SUPABASE_URL/);
  assert.match(playwright, /artifacts=ZERO/);
  assert.doesNotMatch(playwright, /supabase db push|supabase link|--project-ref/);
  assert.match(database, /umask 077/);
  assert.match(database, /fresh-reset-one/);
  assert.match(database, /fresh-reset-two/);
  assert.match(database, /upgrade-noop-migration/);
  assert.match(database, /zero_residue=PASS/);
  assert.doesNotMatch(database, /supabase db push|supabase link|--project-ref/);
});
