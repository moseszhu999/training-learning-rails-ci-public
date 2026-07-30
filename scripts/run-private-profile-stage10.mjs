import { mkdir, readFile, rm } from 'node:fs/promises';
import { closeSync, openSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import {
  formatProfileStatus,
  profileCommands,
  runProfile as runStage9Profile,
} from './run-private-profile-stage9.mjs';

const command = (label, executable, args, kind = 'status') => Object.freeze({
  label,
  executable,
  args: Object.freeze(args),
  kind,
});

export const learningContentResolutionProfileCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('syntax-package', 'node', [
    '--check',
    'packages/training-learning-content-resolution/src/index.mjs',
  ]),
  command('syntax-gateway', 'node', [
    '--check',
    'lib/trainingos-agent-gateway/learning-content-resolution.mjs',
  ]),
  command('node-contract', 'node', [
    '--test',
    'prototypes/trainingos-agent-mvp-v1/test/learning-content-resolution-v1.test.mjs',
  ], 'node'),
  command('python-contract', 'python', [
    '-m',
    'unittest',
    '-v',
    'tests.test_trainingos_learning_content_resolution_v1_contract',
  ], 'python'),
  command('typecheck', 'npm', ['run', 'typecheck']),
  command('production-build', 'npx', ['vite', 'build', '--config', 'vite.config.ts']),
]);

const LEARNING_CONTENT_RESOLUTION_EXACT_FILES = new Set([
  'docs/architecture/trainingos-learning-content-resolution-v1.md',
  'docs/testing/trainingos-learning-content-resolution-validation-v1.md',
  'lib/trainingos-agent-gateway/learning-content-resolution.mjs',
  'packages/training-learning-content-resolution/package.json',
  'packages/training-learning-content-resolution/src/index.mjs',
  'prototypes/trainingos-agent-mvp-v1/test/learning-content-resolution-v1.test.mjs',
  'tests/test_trainingos_learning_content_resolution_v1_contract.py',
]);

export function isLearningContentResolutionFiles(files) {
  const names = [...files];
  return names.length === LEARNING_CONTENT_RESOLUTION_EXACT_FILES.size
    && names.every((name) => LEARNING_CONTENT_RESOLUTION_EXACT_FILES.has(name))
    && names.includes('packages/training-learning-content-resolution/src/index.mjs')
    && names.includes('lib/trainingos-agent-gateway/learning-content-resolution.mjs')
    && names.includes('tests/test_trainingos_learning_content_resolution_v1_contract.py')
    && !names.some((name) => name.startsWith('supabase/migrations/'));
}

function parseNode(text) {
  return {
    tests: [...text.matchAll(/^# tests\s+(\d+)\s*$/gm)].reduce((sum, match) => sum + Number(match[1]), 0),
    passed: [...text.matchAll(/^# pass\s+(\d+)\s*$/gm)].reduce((sum, match) => sum + Number(match[1]), 0),
    failed: [...text.matchAll(/^# fail\s+(\d+)\s*$/gm)].reduce((sum, match) => sum + Number(match[1]), 0),
  };
}

function parsePython(text) {
  return {
    tests: [...text.matchAll(/Ran\s+(\d+)\s+tests?/g)].reduce((sum, match) => sum + Number(match[1]), 0),
  };
}

async function changedFiles({ privateRepoPath, runnerTemp }) {
  const scopeText = await readFile(path.join(runnerTemp, 'trainingos-scope-contract.env'), 'utf8');
  const scope = Object.fromEntries(scopeText.trim().split('\n').map((line) => {
    const index = line.indexOf('=');
    return [line.slice(0, index), line.slice(index + 1)];
  }));
  const result = spawnSync('git', [
    '-C',
    privateRepoPath,
    'diff',
    '--name-only',
    scope.expected_base_sha,
    process.env.PRIVATE_EXACT_SHA,
  ], { encoding: 'utf8', shell: false });
  if (result.status !== 0) throw new Error('git failed');
  return result.stdout.trim() ? result.stdout.trim().split('\n') : [];
}

async function runFixedProfile({
  privateRepoPath,
  runnerTemp,
  expectedNodeCount,
  expectedPythonCount,
}) {
  await mkdir(runnerTemp, { recursive: true });
  let nodeTests = 0;
  let nodePassed = 0;
  let nodeFailed = 0;
  let pythonTests = 0;
  let passedSteps = 0;
  const failedLabels = [];

  try {
    for (const [index, item] of learningContentResolutionProfileCommands.entries()) {
      const logPath = path.join(runnerTemp, `trainingos-profile-${index + 1}.log`);
      const descriptor = openSync(logPath, 'w', 0o600);
      const result = spawnSync(item.executable, item.args, {
        cwd: privateRepoPath,
        env: process.env,
        stdio: ['ignore', descriptor, descriptor],
        shell: false,
      });
      closeSync(descriptor);
      const output = await readFile(logPath, 'utf8');
      if (item.kind === 'node') {
        const parsed = parseNode(output);
        nodeTests += parsed.tests;
        nodePassed += parsed.passed;
        nodeFailed += parsed.failed;
      }
      if (item.kind === 'python') pythonTests += parsePython(output).tests;
      if (result.status === 0) passedSteps += 1;
      else failedLabels.push(item.label);
    }
  } finally {
    await rm(path.join(runnerTemp, 'trainingos-scope-contract.env'), { force: true });
  }

  const expectedNode = Number(expectedNodeCount);
  const expectedPython = Number(expectedPythonCount);
  const countsPassed = nodeTests === expectedNode
    && nodePassed === expectedNode
    && nodeFailed === 0
    && pythonTests === expectedPython;
  const ok = passedSteps === learningContentResolutionProfileCommands.length && countsPassed;
  return {
    ok,
    status: formatProfileStatus({ ok, failedLabels, countsPassed }),
    failedLabels: Object.freeze([...failedLabels]),
    stepCount: learningContentResolutionProfileCommands.length,
    passedStepCount: passedSteps,
    nodeTests,
    nodePassed,
    nodeFailed,
    pythonTests,
    selectedSuite: 'learning-content-resolution',
  };
}

export async function runProfile(input) {
  if (input.profile === 'generic-owned') {
    const files = await changedFiles(input);
    if (isLearningContentResolutionFiles(files)) return runFixedProfile(input);
  }
  return runStage9Profile(input);
}

export { formatProfileStatus, profileCommands };
