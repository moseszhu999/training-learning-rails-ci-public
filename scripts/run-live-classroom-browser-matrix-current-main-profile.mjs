import { closeSync, openSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const LIVE_CLASSROOM_BROWSER_MATRIX_EXACT_FILES = new Set([
  'docs/testing/trainingos-live-classroom-browser-network-cost-matrix-v1.md',
  'public/trainingos-live-classroom-runtime-matrix-v1.html',
  'tests/test_trainingos_live_classroom_runtime_matrix_v1.py',
  'tests/trainingos-ui-e2e/live-classroom-runtime-matrix.config.ts',
  'tests/trainingos-ui-e2e/live-classroom-runtime-matrix.spec.ts',
]);

const EXPECTED_CHANGED_FILE_COUNT = 5;
const EXPECTED_NODE_COUNT = 0;
const EXPECTED_PYTHON_COUNT = 7;
const EXPECTED_BROWSER_COUNT = 5;
const EXPECTED_MIGRATION_COUNT = 369;

const command = (label, executable, args, kind = 'status') => Object.freeze({ label, executable, args: Object.freeze(args), kind });
export const liveClassroomBrowserMatrixCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('focused-python-contracts', 'python', ['-m', 'unittest', '-v', 'tests.test_trainingos_live_classroom_runtime_matrix_v1'], 'python'),
  command('playwright-install-chromium', 'npx', ['playwright', 'install', 'chromium']),
  command('playwright-runtime-matrix', 'npx', ['playwright', 'test', '--config=tests/trainingos-ui-e2e/live-classroom-runtime-matrix.config.ts'], 'browser'),
  command('typecheck', 'npm', ['run', 'typecheck']),
  command('direct-vite-production-build', 'npx', ['vite', 'build', '--config', 'vite.config.ts']),
  command('postbuild-copy', 'node', ['scripts/copy-trainingos-marketplace-web.mjs']),
  command('bundle-verification', 'npm', ['run', 'verify:build']),
]);

const sumMatches = (text, regex) => [...String(text).matchAll(regex)].reduce((sum, match) => sum + Number(match[1]), 0);

async function exactChangedFiles(input) {
  const scopePath = path.join(input.runnerTemp, 'trainingos-scope-contract.env');
  const scopeText = await readFile(scopePath, 'utf8');
  const scope = Object.fromEntries(scopeText.trim().split('\n').map((line) => {
    const index = line.indexOf('=');
    return [line.slice(0, index), line.slice(index + 1)];
  }));
  const result = spawnSync('git', ['-C', input.privateRepoPath, 'diff', '--name-only', scope.expected_base_sha, input.privateExactSha], { encoding: 'utf8', shell: false });
  if (result.status !== 0) throw new Error('git scope failed');
  return { files: result.stdout.trim() ? result.stdout.trim().split('\n').sort() : [], scope };
}

export function isLiveClassroomBrowserMatrixScope(files) {
  const names = [...files];
  return names.length === LIVE_CLASSROOM_BROWSER_MATRIX_EXACT_FILES.size
    && names.every((name) => LIVE_CLASSROOM_BROWSER_MATRIX_EXACT_FILES.has(name))
    && names.every((name) => !name.startsWith('supabase/migrations/'));
}

function failedContractResult() {
  return {
    ok: false, status: 'FAIL:fixed-input-contract', failedLabels: Object.freeze(['fixed-input-contract']),
    stepCount: liveClassroomBrowserMatrixCommands.length, passedStepCount: 0,
    nodeTests: 0, nodePassed: 0, nodeFailed: 0, pythonTests: 0,
    selectedSuite: 'live-classroom-browser-matrix-current-main',
  };
}

export async function maybeRunLiveClassroomBrowserMatrixCurrentMainProfile(input) {
  if (input.profile !== 'generic-owned') return null;
  const { files, scope } = await exactChangedFiles(input);
  if (!isLiveClassroomBrowserMatrixScope(files)) return null;
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
  let browserTests = 0;
  const failedLabels = [];
  try {
    for (const [index, item] of liveClassroomBrowserMatrixCommands.entries()) {
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
      if (item.kind === 'python') pythonTests += sumMatches(output, /Ran\s+(\d+)\s+tests?/g);
      if (item.kind === 'browser') browserTests += sumMatches(output, /(?:^|\s)(\d+)\s+passed\s*(?:\(|$)/gm);
      if (result.status === 0) passedStepCount += 1;
      else failedLabels.push(item.label);
    }
  } finally {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
  }

  const stepCount = liveClassroomBrowserMatrixCommands.length;
  const countsPassed = pythonTests === EXPECTED_PYTHON_COUNT && browserTests === EXPECTED_BROWSER_COUNT;
  const ok = passedStepCount === stepCount && countsPassed;
  return {
    ok,
    status: ok ? 'PASS' : `FAIL:${failedLabels.length ? failedLabels.join(',') : 'count-contract'}`,
    failedLabels: Object.freeze([...failedLabels]), stepCount, passedStepCount,
    nodeTests: 0, nodePassed: 0, nodeFailed: 0, pythonTests,
    selectedSuite: 'live-classroom-browser-matrix-current-main',
  };
}
