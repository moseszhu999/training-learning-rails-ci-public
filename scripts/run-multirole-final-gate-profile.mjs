import { closeSync, openSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const publicRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const MULTIROLE_FINAL_GATE_EXACT_FILES = new Set([
  'apps/training-web/src/components/TrainingOsMultirolePortal.tsx',
  'apps/training-web/src/lib/trainingos-class-operations-adapter.ts',
  'tests/test_trainingos_multirole_zero_admin_entry_v1_contract.py',
]);

const CANONICAL_MIGRATION_COUNT = 357;
const EXPECTED_PYTHON_COUNT = 26;

const command = (label, executable, args, kind = 'status') => Object.freeze({
  label,
  executable,
  args: Object.freeze(args),
  kind,
});

export const multiroleFinalGateCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('python-web-contract', 'python', [
    '-m',
    'unittest',
    '-v',
    'tests.test_trainingos_multirole_zero_admin_entry_v1_contract',
  ], 'python'),
  command('python-assignment-contract', 'python', [
    path.join(publicRoot, 'scripts/run-multirole-integrated-assignment-contract.py'),
  ], 'python'),
  command('database-replay', 'bash', [
    path.join(publicRoot, 'scripts/run-multirole-final-gate-database.sh'),
  ], 'database'),
  command('typecheck', 'npm', ['run', 'typecheck']),
  command('production-build', 'npx', ['vite', 'build', '--config', 'vite.config.ts']),
]);

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

export function isMultiroleFinalGateScope(files) {
  const names = [...files];
  return names.length === MULTIROLE_FINAL_GATE_EXACT_FILES.size
    && names.every((name) => MULTIROLE_FINAL_GATE_EXACT_FILES.has(name))
    && !names.some((name) => name.startsWith('supabase/migrations/'));
}

function fixedInputContract(input, scope) {
  return Number(input.expectedNodeCount) === 0
    && Number(input.expectedPythonCount) === EXPECTED_PYTHON_COUNT
    && String(process.env.EXPECTED_MIGRATION_COUNT) === String(CANONICAL_MIGRATION_COUNT)
    && scope.expected_changed_file_count === '3'
    && scope.migration_start === 'none'
    && scope.migration_end === 'none';
}

function parseDatabaseStage(text) {
  const match = [...text.matchAll(/MULTIROLE_FINAL_GATE_DB status=FAIL stage=([a-z0-9-]+)/g)].at(-1);
  return match?.[1] ?? 'unknown';
}

function failedContractResult() {
  return {
    ok: false,
    status: 'FAIL:fixed-input-contract@not-run',
    failedLabels: Object.freeze(['fixed-input-contract']),
    stepCount: multiroleFinalGateCommands.length,
    passedStepCount: 0,
    nodeTests: 0,
    nodePassed: 0,
    nodeFailed: 0,
    pythonTests: 0,
    selectedSuite: 'multirole-final-gate',
  };
}

export async function maybeRunMultiroleFinalGateProfile(input) {
  if (input.profile !== 'generic-owned') return null;
  const { files, scope } = await exactChangedFiles(input);
  if (!isMultiroleFinalGateScope(files)) return null;

  if (!fixedInputContract(input, scope)) {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
    return failedContractResult();
  }

  await mkdir(input.runnerTemp, { recursive: true });
  let passedStepCount = 0;
  let pythonTests = 0;
  let databaseStage = 'not-run';
  const failedLabels = [];

  try {
    for (const [index, item] of multiroleFinalGateCommands.entries()) {
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
      if (item.kind === 'python') pythonTests += parsePython(output);
      if (item.kind === 'database') {
        databaseStage = result.status === 0 ? 'complete' : parseDatabaseStage(output);
      }
      if (result.status === 0) passedStepCount += 1;
      else failedLabels.push(item.label);
    }
  } finally {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
  }

  const countsPassed = pythonTests === EXPECTED_PYTHON_COUNT;
  const ok = passedStepCount === multiroleFinalGateCommands.length && countsPassed;
  const failure = failedLabels.length ? failedLabels.join(',') : 'count-contract';
  return {
    ok,
    status: ok ? 'PASS' : `FAIL:${failure}@${databaseStage}`,
    failedLabels: Object.freeze([...failedLabels]),
    stepCount: multiroleFinalGateCommands.length,
    passedStepCount,
    nodeTests: 0,
    nodePassed: 0,
    nodeFailed: 0,
    pythonTests,
    selectedSuite: 'multirole-final-gate',
  };
}
