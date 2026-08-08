import { closeSync, openSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { maybeRunLiveClassroomRuntimeWiringCurrentMainProfile } from './run-live-classroom-runtime-wiring-current-main-profile.mjs';
import { maybeRunLiveClassroomF2CurrentMainProfile } from './run-live-classroom-tencent-server-authorization-current-main-profile.mjs';
import { maybeRunLiveClassroomTencentProvisioningProfile } from './run-live-classroom-tencent-provisioning-profile.mjs';

export const LIVE_CLASSROOM_TENCENT_SERVER_AUTH_EXACT_FILES = new Set([
  'docs/architecture/trainingos-live-classroom-tencent-server-authorization-v1.md',
  'lib/trainingos-agent-gateway/tencent-live-classroom-api.mjs',
  'lib/trainingos-agent-gateway/tencent-live-classroom-authorization.mjs',
  'netlify/functions/trainingos-live-classroom-tencent-authorize.mjs',
  'prototypes/trainingos-agent-mvp-v1/test/tencent-live-classroom-server-authorization.test.mjs',
  'tests/test_trainingos_live_classroom_tencent_server_authorization_v1.py',
]);

const EXPECTED_NODE_COUNT = 14;
const EXPECTED_PYTHON_COUNT = 11;
const EXPECTED_CHANGED_FILE_COUNT = 6;
const EXPECTED_MIGRATION_COUNT = 368;

const command = (label, executable, args, kind = 'status') => Object.freeze({
  label,
  executable,
  args: Object.freeze(args),
  kind,
});

export const liveClassroomTencentServerAuthorizationCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('api-syntax', 'node', ['--check', 'lib/trainingos-agent-gateway/tencent-live-classroom-api.mjs']),
  command('authorization-syntax', 'node', ['--check', 'lib/trainingos-agent-gateway/tencent-live-classroom-authorization.mjs']),
  command('endpoint-syntax', 'node', ['--check', 'netlify/functions/trainingos-live-classroom-tencent-authorize.mjs']),
  command('focused-node-contracts', 'node', [
    '--test',
    'prototypes/trainingos-agent-mvp-v1/test/tencent-live-classroom-server-authorization.test.mjs',
  ], 'node'),
  command('focused-python-contracts', 'python', [
    '-m', 'unittest', '-v',
    'tests.test_trainingos_live_classroom_tencent_server_authorization_v1',
  ], 'python'),
  command('typecheck', 'npm', ['run', 'typecheck']),
  command('direct-vite-production-build', 'npx', ['vite', 'build', '--config', 'vite.config.ts']),
  command('postbuild-copy', 'node', ['scripts/copy-trainingos-marketplace-web.mjs']),
  command('bundle-verification', 'npm', ['run', 'verify:build']),
]);

function parseNode(text) {
  return [...String(text).matchAll(/^# tests\s+(\d+)$/gm)]
    .reduce((sum, match) => sum + Number(match[1]), 0);
}

function parseNodePassed(text) {
  return [...String(text).matchAll(/^# pass\s+(\d+)$/gm)]
    .reduce((sum, match) => sum + Number(match[1]), 0);
}

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

export function isLiveClassroomTencentServerAuthorizationScope(files) {
  const names = [...files];
  return names.length === LIVE_CLASSROOM_TENCENT_SERVER_AUTH_EXACT_FILES.size
    && names.every((name) => LIVE_CLASSROOM_TENCENT_SERVER_AUTH_EXACT_FILES.has(name))
    && names.every((name) => !name.startsWith('supabase/migrations/'));
}

function failedResult(reason, stepCount = liveClassroomTencentServerAuthorizationCommands.length) {
  return {
    ok: false,
    status: `FAIL:${reason}`,
    failedLabels: Object.freeze([reason]),
    stepCount,
    passedStepCount: 0,
    nodeTests: 0,
    nodePassed: 0,
    nodeFailed: 0,
    pythonTests: 0,
    selectedSuite: 'live-classroom-tencent-server-authorization',
  };
}

export async function maybeRunLiveClassroomTencentServerAuthorizationProfile(input) {
  // Current-main wrappers must run before historical fixed-input contracts.
  // Exact file-set matching keeps F1, F2 and F4 ownership disjoint.
  const currentRuntimeWiring = await maybeRunLiveClassroomRuntimeWiringCurrentMainProfile(input);
  if (currentRuntimeWiring) return currentRuntimeWiring;

  const currentServerAuthorization = await maybeRunLiveClassroomF2CurrentMainProfile(input);
  if (currentServerAuthorization) return currentServerAuthorization;

  const provisioning = await maybeRunLiveClassroomTencentProvisioningProfile(input);
  if (provisioning) return provisioning;

  if (input.profile !== 'generic-owned') return null;
  const { files, scope } = await exactChangedFiles(input);
  if (!isLiveClassroomTencentServerAuthorizationScope(files)) return null;

  const inputMatches = Number(input.expectedNodeCount) === EXPECTED_NODE_COUNT
    && Number(input.expectedPythonCount) === EXPECTED_PYTHON_COUNT
    && String(process.env.EXPECTED_MIGRATION_COUNT) === String(EXPECTED_MIGRATION_COUNT)
    && scope.expected_changed_file_count === String(EXPECTED_CHANGED_FILE_COUNT)
    && scope.migration_start === 'none'
    && scope.migration_end === 'none';
  if (!inputMatches) {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
    return failedResult('fixed-input-contract');
  }

  await mkdir(input.runnerTemp, { recursive: true });
  let passedStepCount = 0;
  let nodeTests = 0;
  let nodePassed = 0;
  let pythonTests = 0;
  const failedLabels = [];

  try {
    for (const [index, item] of liveClassroomTencentServerAuthorizationCommands.entries()) {
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
  const ok = passedStepCount === liveClassroomTencentServerAuthorizationCommands.length && countsPassed;
  const failure = failedLabels.length ? failedLabels.join(',') : 'count-contract';
  return {
    ok,
    status: ok ? 'PASS' : `FAIL:${failure}`,
    failedLabels: Object.freeze([...failedLabels]),
    stepCount: liveClassroomTencentServerAuthorizationCommands.length,
    passedStepCount,
    nodeTests,
    nodePassed,
    nodeFailed: nodeTests - nodePassed,
    pythonTests,
    selectedSuite: 'live-classroom-tencent-server-authorization',
  };
}
