import { closeSync, openSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const EXACT_FILES = new Set([
  'tests/test_trainingos_learning_workspace_web_adapter_contract.py',
]);

const commands = Object.freeze([
  Object.freeze({ label: 'install', executable: 'npm', args: Object.freeze(['ci']), kind: 'status' }),
  Object.freeze({
    label: 'python-contract',
    executable: 'python',
    args: Object.freeze([
      '-m',
      'unittest',
      '-v',
      'tests.test_trainingos_learning_workspace_web_adapter_contract',
    ]),
    kind: 'python',
  }),
  Object.freeze({
    label: 'learning-workspace-validation',
    executable: 'node',
    args: Object.freeze(['scripts/run-trainingos-learning-workspace-bridge-validation.mjs']),
    kind: 'status',
  }),
  Object.freeze({ label: 'typecheck', executable: 'npm', args: Object.freeze(['run', 'typecheck']), kind: 'status' }),
  Object.freeze({
    label: 'production-build',
    executable: 'npx',
    args: Object.freeze(['vite', 'build', '--config', 'vite.config.ts']),
    kind: 'status',
  }),
]);

function parsePython(text) {
  return [...text.matchAll(/Ran\s+(\d+)\s+tests?/g)]
    .reduce((sum, match) => sum + Number(match[1]), 0);
}

async function changedFiles({ privateRepoPath, runnerTemp }) {
  const scopeText = await readFile(path.join(runnerTemp, 'trainingos-scope-contract.env'), 'utf8');
  const scope = Object.fromEntries(scopeText.trim().split('\n').map((line) => {
    const index = line.indexOf('=');
    return [line.slice(0, index), line.slice(index + 1)];
  }));
  const result = spawnSync('git', [
    '-C', privateRepoPath, 'diff', '--name-only', scope.expected_base_sha, process.env.PRIVATE_EXACT_SHA,
  ], { encoding: 'utf8', shell: false });
  if (result.status !== 0) throw new Error('git failed');
  return result.stdout.trim() ? result.stdout.trim().split('\n') : [];
}

function isExactScope(files) {
  return files.length === EXACT_FILES.size && files.every((file) => EXACT_FILES.has(file));
}

export async function maybeRunLearningWorkspaceContractFixProfile(input) {
  if (input.profile !== 'generic-owned') return null;
  const files = await changedFiles(input);
  if (!isExactScope(files)) return null;

  await mkdir(input.runnerTemp, { recursive: true });
  let passedStepCount = 0;
  let pythonTests = 0;
  const failedLabels = [];

  try {
    for (const [index, item] of commands.entries()) {
      const logPath = path.join(input.runnerTemp, `trainingos-profile-${index + 1}.log`);
      const descriptor = openSync(logPath, 'w', 0o600);
      const result = spawnSync(item.executable, item.args, {
        cwd: input.privateRepoPath,
        env: process.env,
        stdio: ['ignore', descriptor, descriptor],
        shell: false,
      });
      closeSync(descriptor);
      const output = await readFile(logPath, 'utf8');
      if (item.kind === 'python') pythonTests += parsePython(output);
      if (result.status === 0) passedStepCount += 1;
      else failedLabels.push(item.label);
    }
  } finally {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
  }

  const countsPassed = Number(input.expectedNodeCount) === 0
    && Number(input.expectedPythonCount) === 14
    && pythonTests === 14;
  const ok = passedStepCount === commands.length && countsPassed;
  const status = ok
    ? 'PASS'
    : `FAIL:${failedLabels.length ? failedLabels.join(',') : 'count-contract'}`;

  return {
    ok,
    status,
    failedLabels: Object.freeze([...failedLabels]),
    stepCount: commands.length,
    passedStepCount,
    nodeTests: 0,
    nodePassed: 0,
    nodeFailed: 0,
    pythonTests,
    selectedSuite: 'learning-workspace-contract-fix',
  };
}
