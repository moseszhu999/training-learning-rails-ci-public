import { closeSync, openSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const LIVE_CLASSROOM_A_CURRENT_MAIN_EXACT_FILES = new Set([
  'apps/training-web/src/components/TrainingOsAdvancedOperations.tsx',
  'apps/training-web/src/components/TrainingOsLiveClassroomSurface.tsx',
  'apps/training-web/src/lib/trainingos-live-classroom-contract.ts',
  'apps/training-web/src/trainingos-live-classroom.css',
  'docs/architecture/trainingos-live-classroom-contract-v1.md',
  'tests/test_trainingos_live_classroom_contract_v1.py',
  'tests/test_trainingos_native_classroom_hub_contract.py',
]);

const EXPECTED_CHANGED_FILE_COUNT = 7;
const EXPECTED_NODE_COUNT = 0;
const EXPECTED_PYTHON_COUNT = 9;
const EXPECTED_MIGRATION_COUNT = 369;

const command = (label, executable, args, kind = 'status') => Object.freeze({
  label,
  executable,
  args: Object.freeze(args),
  kind,
});

export const liveClassroomACurrentMainCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('focused-python-contracts', 'python', [
    '-m', 'unittest', '-v',
    'tests.test_trainingos_live_classroom_contract_v1',
  ], 'python'),
  command('native-classroom-prebuild-validation', 'node', [
    'scripts/run-trainingos-native-classroom-validation.mjs',
  ]),
  command('typecheck', 'npm', ['run', 'typecheck']),
  command('netlify-build-command', 'npm', ['run', 'build']),
  command('bundle-verification', 'npm', ['run', 'verify:build']),
]);

function parsePython(text) {
  return [...String(text).matchAll(/Ran\s+(\d+)\s+tests?/g)]
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
    '-C', input.privateRepoPath,
    'diff', '--name-only',
    scope.expected_base_sha,
    input.privateExactSha,
  ], { encoding: 'utf8', shell: false });
  if (result.status !== 0) throw new Error('git scope failed');
  return {
    files: result.stdout.trim() ? result.stdout.trim().split('\n').sort() : [],
    scope,
  };
}

export function isLiveClassroomACurrentMainScope(files) {
  const names = [...files];
  return names.length === LIVE_CLASSROOM_A_CURRENT_MAIN_EXACT_FILES.size
    && names.every((name) => LIVE_CLASSROOM_A_CURRENT_MAIN_EXACT_FILES.has(name))
    && names.every((name) => !name.startsWith('supabase/migrations/'));
}

function failedContractResult() {
  return {
    ok: false,
    status: 'FAIL:fixed-input-contract',
    failedLabels: Object.freeze(['fixed-input-contract']),
    stepCount: liveClassroomACurrentMainCommands.length,
    passedStepCount: 0,
    nodeTests: 0,
    nodePassed: 0,
    nodeFailed: 0,
    pythonTests: 0,
    selectedSuite: 'live-classroom-a-current-main',
  };
}

export async function maybeRunLiveClassroomACurrentMainProfile(input) {
  if (input.profile !== 'generic-owned') return null;
  const { files, scope } = await exactChangedFiles(input);
  if (!isLiveClassroomACurrentMainScope(files)) return null;

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
  let pythonTests = 0;
  const failedLabels = [];

  try {
    for (const [index, item] of liveClassroomACurrentMainCommands.entries()) {
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

  const countsPassed = pythonTests === EXPECTED_PYTHON_COUNT;
  const stepCount = liveClassroomACurrentMainCommands.length;
  const ok = passedStepCount === stepCount && countsPassed;
  const failure = failedLabels.length ? failedLabels.join(',') : 'count-contract';
  return {
    ok,
    status: ok ? 'PASS' : `FAIL:${failure}`,
    failedLabels: Object.freeze([...failedLabels]),
    stepCount,
    passedStepCount,
    nodeTests: 0,
    nodePassed: 0,
    nodeFailed: 0,
    pythonTests,
    selectedSuite: 'live-classroom-a-current-main',
  };
}
