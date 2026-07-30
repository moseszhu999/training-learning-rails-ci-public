import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  isLearningContentResolutionFiles,
  learningContentResolutionProfileCommands,
} from '../scripts/run-private-profile-stage10.mjs';

const exactFiles = [
  'docs/architecture/trainingos-learning-content-resolution-v1.md',
  'docs/testing/trainingos-learning-content-resolution-validation-v1.md',
  'lib/trainingos-agent-gateway/learning-content-resolution.mjs',
  'packages/training-learning-content-resolution/package.json',
  'packages/training-learning-content-resolution/src/index.mjs',
  'prototypes/trainingos-agent-mvp-v1/test/learning-content-resolution-v1.test.mjs',
  'tests/test_trainingos_learning_content_resolution_v1_contract.py',
];

test('learning content resolution suite selects only the exact seven-file migration-free scope', () => {
  assert.equal(isLearningContentResolutionFiles(exactFiles), true);
  assert.equal(isLearningContentResolutionFiles(exactFiles.slice(1)), false);
  assert.equal(isLearningContentResolutionFiles([
    ...exactFiles,
    'supabase/migrations/20260731100000_forbidden.sql',
  ]), false);
  assert.equal(isLearningContentResolutionFiles([
    ...exactFiles,
    'api/integrations/agents/mcp.mjs',
  ]), false);
});

test('learning content resolution suite uses fixed commands and exact focused counts', () => {
  const commands = learningContentResolutionProfileCommands.map((item) => ({
    label: item.label,
    executable: item.executable,
    args: [...item.args],
    kind: item.kind,
  }));
  assert.deepEqual(commands, [
    { label: 'install', executable: 'npm', args: ['ci'], kind: 'status' },
    {
      label: 'syntax-package', executable: 'node',
      args: ['--check', 'packages/training-learning-content-resolution/src/index.mjs'], kind: 'status',
    },
    {
      label: 'syntax-gateway', executable: 'node',
      args: ['--check', 'lib/trainingos-agent-gateway/learning-content-resolution.mjs'], kind: 'status',
    },
    {
      label: 'node-contract', executable: 'node',
      args: ['--test', 'prototypes/trainingos-agent-mvp-v1/test/learning-content-resolution-v1.test.mjs'], kind: 'node',
    },
    {
      label: 'python-contract', executable: 'python',
      args: ['-m', 'unittest', '-v', 'tests.test_trainingos_learning_content_resolution_v1_contract'], kind: 'python',
    },
    { label: 'typecheck', executable: 'npm', args: ['run', 'typecheck'], kind: 'status' },
    {
      label: 'production-build', executable: 'npx',
      args: ['vite', 'build', '--config', 'vite.config.ts'], kind: 'status',
    },
  ]);
});

test('public entrypoint routes through stage10 without adding a workflow', async () => {
  const entrypoint = await readFile(new URL('../scripts/run-private-profile.mjs', import.meta.url), 'utf8');
  assert.match(entrypoint, /run-private-profile-stage10\.mjs/);
  assert.doesNotMatch(entrypoint, /learning-content-resolution.*workflow/i);
});
