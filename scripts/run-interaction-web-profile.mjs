import { closeSync, openSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const INTERACTION_WEB_EXACT_FILES = new Set([
  'apps/training-web/src/components/JhcStudentExerciseWorkspace.tsx',
  'apps/training-web/src/components/TrainingOsAdvancedClasses.tsx',
  'apps/training-web/src/components/TrainingOsInteractionPanel.tsx',
  'apps/training-web/src/lib/trainingos-interaction-web.ts',
  'apps/training-web/src/trainingos-interaction.css',
  'docs/product/trainingos-interaction-web-v1.md',
  'tests/test_trainingos_interaction_web_v1.py',
]);

const CANONICAL_MIGRATION_COUNT = 360;
const EXPECTED_NODE_COUNT = 13;
const EXPECTED_PYTHON_COUNT = 14;

const command = (label, executable, args, kind = 'status') => Object.freeze({
  label,
  executable,
  args: Object.freeze(args),
  kind,
});

export const interactionWebCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('foundation-package-syntax', 'node', ['--check', 'packages/training-interaction/src/index.mjs']),
  command('foundation-package-tests', 'node', ['--test', 'packages/training-interaction/test/interaction.test.mjs'], 'node'),
  command('foundation-gateway-syntax', 'node', ['--check', 'lib/trainingos-agent-gateway/interaction.mjs']),
  command('foundation-gateway-tests', 'node', [
    '--test',
    'prototypes/trainingos-agent-mvp-v1/test/interaction-foundation-v1.test.mjs',
  ], 'node'),
  command('web-python-contract', 'python', [
    '-m',
    'unittest',
    '-v',
    'tests.test_trainingos_interaction_web_v1',
  ], 'python'),
  command('typecheck', 'npm', ['run', 'typecheck']),
  command('production-build', 'npx', ['vite', 'build', '--config', 'vite.config.ts']),
]);

function parseNode(text) {
  return [...text.matchAll(/^# tests\s+(\d+)$/gm)]
    .reduce((sum, match) => sum + Number(match[1]), 0);
}

function parseNodePassed(text) {
  return [...text.matchAll(/^# pass\s+(\d+)$/gm)]
    .reduce((sum, match) => sum + Number(match[1]), 0);
}

function parsePython(text) {
  return [...text.matchAll(/Ran\s+(\d+)\s+tests?/g)]
    .reduce((sum, match) => sum + Number(match[1]), 0);
}

async function exactChangedFiles(input) {
  const scopePath = path.join(input.runnerTemp, 'trainingos-scope-contract.env');
  const scopeText = await readFile(scopePath, 'utf8');
  const scope = Object.fromEntries(scopeText.trim().split('\n').map((line) => {
    const index = line.indexOf('=');
    return [line.slice(0, index), line.slice(index + 1)];
  }));
  const result = spawnSync('git', [
    '-C', input.privateRepoPath, 'diff', '--name-only',
    scope.expected_base_sha, input.privateExactSha,
  ], { encoding: 'utf8', shell: false });
  if (result.status !== 0) throw new Error('git scope failed');
  return {
    files: result.stdout.trim() ? result.stdout.trim().split('\n').sort() : [],
    scope,
  };
}

export function isInteractionWebScope(files) {
  const names = [...files];
  return names.length === INTERACTION_WEB_EXACT_FILES.size
    && names.every((name) => INTERACTION_WEB_EXACT_FILES.has(name))
    && names.every((name) => !name.startsWith('supabase/migrations/'));
}

function fixedInputContract(input, scope) {
  return Number(input.expectedNodeCount) === EXPECTED_NODE_COUNT
    && Number(input.expectedPythonCount) === EXPECTED_PYTHON_COUNT
    && String(process.env.EXPECTED_MIGRATION_COUNT) === String(CANONICAL_MIGRATION_COUNT)
    && scope.expected_changed_file_count === '7'
    && scope.migration_start === 'none'
    && scope.migration_end === 'none';
}

function failedContractResult() {
  return {
    ok: false,
    status: 'FAIL:fixed-input-contract',
    failedLabels: Object.freeze(['fixed-input-contract']),
    stepCount: interactionWebCommands.length,
    passedStepCount: 0,
    nodeTests: 0,
    nodePassed: 0,
    nodeFailed: 0,
    pythonTests: 0,
    selectedSuite: 'interaction-web',
  };
}

export async function maybeRunInteractionWebProfile(input) {
  if (input.profile !== 'generic-owned') return null;
  const { files, scope } = await exactChangedFiles(input);
  if (!isInteractionWebScope(files)) return null;

  if (!fixedInputContract(input, scope)) {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
    return failedContractResult();
  }

  await mkdir(input.runnerTemp, { recursive: true });
  let passedStepCount = 0;
  let nodeTests = 0;
  let nodePassed = 0;
  let pythonTests = 0;
  const failedLabels = [];

  try {
    for (const [index, item] of interactionWebCommands.entries()) {
      const logPath = path.join(input.runnerTemp, `trainingos-profile-${index + 1}.log`);
      const descriptor = openSync(logPath, 'w', 0o600);
      const result = spawnSync(item.executable, item.args, {
        cwd: input.privateRepoPath,
        env: {
          ...process.env,
          PRIVATE_REPO_PATH: input.privateRepoPath,
          PRIVATE_EXACT_SHA: input.privateExactSha,
          EXPECTED_MIGRATION_COUNT: String(CANONICAL_MIGRATION_COUNT),
          RUNNER_TEMP: input.runnerTemp,
        },
        stdio: ['ignore', descriptor, descriptor],
        shell: false,
      });
      closeSync(descriptor);
      const output = await readFile(logPath, 'utf8');
      if (item.kind === 'node') {
        nodeTests += parseNode(output);
        nodePassed += parseNodePassed(output);
      }
      if (item.kind === 'python') pythonTests += parsePython(output);
      if (result.status === 0) passedStepCount += 1;
      else failedLabels.push(item.label);
    }
  } finally {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
  }

  const countsPassed = nodeTests === EXPECTED_NODE_COUNT
    && nodePassed === EXPECTED_NODE_COUNT
    && pythonTests === EXPECTED_PYTHON_COUNT;
  const ok = passedStepCount === interactionWebCommands.length && countsPassed;
  const failure = failedLabels.length ? failedLabels.join(',') : 'count-contract';
  return {
    ok,
    status: ok ? 'PASS' : `FAIL:${failure}`,
    failedLabels: Object.freeze([...failedLabels]),
    stepCount: interactionWebCommands.length,
    passedStepCount,
    nodeTests,
    nodePassed,
    nodeFailed: nodeTests - nodePassed,
    pythonTests,
    selectedSuite: 'interaction-web',
  };
}
