import { closeSync, openSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const PROFESSIONAL_LEARNING_LOOP_EXACT_FILES = new Set([
  'docs/architecture/trainingos-professional-learning-loop-v1.md',
  'docs/architecture/trainingos-verified-professional-learning-v1.md',
  'docs/product/previews/trainingos-professional-learning-loop-v1.README.md',
  'docs/product/previews/trainingos-professional-learning-loop-v1.html',
  'docs/product/previews/trainingos-professional-learning-loop-v1.txt',
  'docs/product/trainingos-professional-learning-loop-gap-plan-v1.md',
  'docs/testing/trainingos-professional-learning-loop-v1-verification.md',
  'packages/training-professional-learning-loop-core/CHANGELOG.md',
  'packages/training-professional-learning-loop-core/README.md',
  'packages/training-professional-learning-loop-core/package.json',
  'packages/training-professional-learning-loop-core/src/index.d.ts',
  'packages/training-professional-learning-loop-core/src/index.mjs',
  'packages/training-professional-learning-loop-core/src/verified-learning.d.ts',
  'packages/training-professional-learning-loop-core/src/verified-learning.mjs',
  'packages/training-professional-learning-loop-core/test/professional-learning-loop.test.mjs',
  'packages/training-professional-learning-loop-core/test/verified-learning-lineage.test.mjs',
  'packages/training-professional-learning-loop-core/test/verified-learning.test.mjs',
]);

const EXPECTED_CHANGED_FILE_COUNT = 17;
const EXPECTED_NODE_COUNT = 27;
const EXPECTED_PYTHON_COUNT = 0;
const EXPECTED_MIGRATION_COUNT = 378;

const command = (label, executable, args, kind = 'status') => Object.freeze({
  label,
  executable,
  args: Object.freeze(args),
  kind,
});

export const professionalLearningLoopCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('core-syntax', 'node', ['--check', 'packages/training-professional-learning-loop-core/src/index.mjs']),
  command('verified-learning-syntax', 'node', ['--check', 'packages/training-professional-learning-loop-core/src/verified-learning.mjs']),
  command('focused-node-contracts', 'node', ['--test', 'packages/training-professional-learning-loop-core/test/*.test.mjs'], 'node'),
  command('core-declaration-typecheck', 'npx', [
    'tsc', '--noEmit', '--strict', '--skipLibCheck', 'false',
    '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2022',
    'packages/training-professional-learning-loop-core/src/index.d.ts',
  ]),
  command('verified-declaration-typecheck', 'npx', [
    'tsc', '--noEmit', '--strict', '--skipLibCheck', 'false',
    '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2022',
    'packages/training-professional-learning-loop-core/src/verified-learning.d.ts',
  ]),
  command('repository-typecheck', 'npm', ['run', 'typecheck']),
  command('direct-vite-production-build', 'npx', ['vite', 'build', '--config', 'vite.config.ts']),
  command('postbuild-copy', 'node', ['scripts/copy-trainingos-marketplace-web.mjs']),
  command('bundle-verification', 'npm', ['run', 'verify:build']),
]);

const sumMatches = (text, regex) => [...String(text).matchAll(regex)]
  .reduce((sum, match) => sum + Number(match[1]), 0);

async function exactChangedFiles(input) {
  const scopePath = path.join(input.runnerTemp, 'trainingos-scope-contract.env');
  const scopeText = await readFile(scopePath, 'utf8');
  const scope = Object.fromEntries(scopeText.trim().split('\n').map((line) => {
    const index = line.indexOf('=');
    return [line.slice(0, index), line.slice(index + 1)];
  }));
  const result = spawnSync(
    'git',
    ['-C', input.privateRepoPath, 'diff', '--name-only', scope.expected_base_sha, input.privateExactSha],
    { encoding: 'utf8', shell: false },
  );
  if (result.status !== 0) throw new Error('git scope failed');
  return {
    files: result.stdout.trim() ? result.stdout.trim().split('\n').sort() : [],
    scope,
  };
}

export function isProfessionalLearningLoopScope(files) {
  const names = [...files];
  return names.length === PROFESSIONAL_LEARNING_LOOP_EXACT_FILES.size
    && names.every((name) => PROFESSIONAL_LEARNING_LOOP_EXACT_FILES.has(name))
    && names.every((name) => !name.startsWith('supabase/migrations/'));
}

function failedContractResult() {
  return {
    ok: false,
    status: 'FAIL:fixed-input-contract',
    failedLabels: Object.freeze(['fixed-input-contract']),
    stepCount: professionalLearningLoopCommands.length,
    passedStepCount: 0,
    nodeTests: 0,
    nodePassed: 0,
    nodeFailed: 0,
    pythonTests: 0,
    selectedSuite: 'professional-learning-loop',
  };
}

export async function maybeRunProfessionalLearningLoopProfile(input) {
  if (input.profile !== 'generic-owned') return null;
  const { files, scope } = await exactChangedFiles(input);
  if (!isProfessionalLearningLoopScope(files)) return null;

  const fixedInputs = Number(input.expectedNodeCount) === EXPECTED_NODE_COUNT
    && Number(input.expectedPythonCount) === EXPECTED_PYTHON_COUNT
    && String(process.env.EXPECTED_MIGRATION_COUNT) === String(EXPECTED_MIGRATION_COUNT)
    && scope.expected_changed_file_count === String(EXPECTED_CHANGED_FILE_COUNT)
    && scope.migration_start === 'none'
    && scope.migration_end === 'none';
  if (!fixedInputs) {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
    return failedContractResult();
  }

  let passedStepCount = 0;
  let nodeTests = 0;
  let nodePassed = 0;
  let nodeFailed = 0;
  const pythonTests = 0;
  const failedLabels = [];

  try {
    for (const [index, item] of professionalLearningLoopCommands.entries()) {
      const logPath = path.join(input.runnerTemp, `trainingos-profile-${index + 1}.log`);
      const descriptor = openSync(logPath, 'w', 0o600);
      const commandResult = spawnSync(item.executable, item.args, {
        cwd: input.privateRepoPath,
        env: process.env,
        stdio: ['ignore', descriptor, descriptor],
        shell: false,
      });
      closeSync(descriptor);
      const output = await readFile(logPath, 'utf8');
      if (item.kind === 'node') {
        nodeTests += sumMatches(output, /^# tests\s+(\d+)$/gm);
        nodePassed += sumMatches(output, /^# pass\s+(\d+)$/gm);
        nodeFailed += sumMatches(output, /^# fail\s+(\d+)$/gm);
      }
      if (commandResult.status === 0) passedStepCount += 1;
      else failedLabels.push(item.label);
    }
  } finally {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
  }

  const countsPassed = nodeTests === EXPECTED_NODE_COUNT
    && nodePassed === EXPECTED_NODE_COUNT
    && nodeFailed === 0;
  const stepCount = professionalLearningLoopCommands.length;
  const ok = passedStepCount === stepCount && countsPassed;

  return {
    ok,
    status: ok ? 'PASS' : `FAIL:${failedLabels.length ? failedLabels.join(',') : 'count-contract'}`,
    failedLabels: Object.freeze([...failedLabels]),
    stepCount,
    passedStepCount,
    nodeTests,
    nodePassed,
    nodeFailed,
    pythonTests,
    selectedSuite: 'professional-learning-loop',
  };
}
