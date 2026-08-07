import { closeSync, openSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const LIVE_CLASSROOM_TENCENT_PROVISIONING_EXACT_FILES = new Set([
  'docs/architecture/trainingos-live-classroom-tencent-provisioning-v1.md',
  'lib/trainingos-agent-gateway/tencent-live-classroom-api.mjs',
  'lib/trainingos-agent-gateway/tencent-live-classroom-authorization.mjs',
  'lib/trainingos-agent-gateway/tencent-live-classroom-provisioning.mjs',
  'netlify/functions/trainingos-live-classroom-tencent-provision.mjs',
  'prototypes/trainingos-agent-mvp-v1/test/tencent-live-classroom-provisioning-user-recovery.test.mjs',
  'prototypes/trainingos-agent-mvp-v1/test/tencent-live-classroom-provisioning.test.mjs',
  'tests/test_trainingos_live_classroom_tencent_provisioning_v1.py',
]);

const EXPECTED_NODE_COUNT = 44;
const EXPECTED_PYTHON_COUNT = 39;
const EXPECTED_CHANGED_FILE_COUNT = 8;
const EXPECTED_MIGRATION_COUNT = 370;

const command = (label, executable, args, kind = 'status') => Object.freeze({
  label,
  executable,
  args: Object.freeze(args),
  kind,
});

export const liveClassroomTencentProvisioningCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('api-syntax', 'node', ['--check', 'lib/trainingos-agent-gateway/tencent-live-classroom-api.mjs']),
  command('authorization-syntax', 'node', ['--check', 'lib/trainingos-agent-gateway/tencent-live-classroom-authorization.mjs']),
  command('provisioning-syntax', 'node', ['--check', 'lib/trainingos-agent-gateway/tencent-live-classroom-provisioning.mjs']),
  command('endpoint-syntax', 'node', ['--check', 'netlify/functions/trainingos-live-classroom-tencent-provision.mjs']),
  command('focused-node-contracts', 'node', [
    '--test',
    'prototypes/trainingos-agent-mvp-v1/test/tencent-live-classroom-server-authorization.test.mjs',
    'prototypes/trainingos-agent-mvp-v1/test/tencent-live-classroom-binding.test.mjs',
    'prototypes/trainingos-agent-mvp-v1/test/tencent-live-classroom-provisioning.test.mjs',
    'prototypes/trainingos-agent-mvp-v1/test/tencent-live-classroom-provisioning-user-recovery.test.mjs',
  ], 'node'),
  command('focused-python-contracts', 'python', [
    '-m', 'unittest', '-v',
    'tests.test_trainingos_live_classroom_tencent_server_authorization_v1',
    'tests.test_trainingos_live_classroom_tencent_binding_v1',
    'tests.test_trainingos_live_classroom_tencent_provisioning_v1',
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

export function isLiveClassroomTencentProvisioningScope(files) {
  const names = [...files];
  return names.length === LIVE_CLASSROOM_TENCENT_PROVISIONING_EXACT_FILES.size
    && names.every((name) => LIVE_CLASSROOM_TENCENT_PROVISIONING_EXACT_FILES.has(name))
    && names.every((name) => !name.startsWith('supabase/migrations/'));
}

function failedResult(reason) {
  return {
    ok: false,
    status: `FAIL:${reason}`,
    failedLabels: Object.freeze([reason]),
    stepCount: liveClassroomTencentProvisioningCommands.length,
    passedStepCount: 0,
    nodeTests: 0,
    nodePassed: 0,
    nodeFailed: 0,
    pythonTests: 0,
    selectedSuite: 'live-classroom-tencent-provisioning',
  };
}

export async function maybeRunLiveClassroomTencentProvisioningProfile(input) {
  if (input.profile !== 'generic-owned') return null;
  const { files, scope } = await exactChangedFiles(input);
  if (!isLiveClassroomTencentProvisioningScope(files)) return null;

  const fixedInputs = Number(input.expectedNodeCount) === EXPECTED_NODE_COUNT
    && Number(input.expectedPythonCount) === EXPECTED_PYTHON_COUNT
    && String(process.env.EXPECTED_MIGRATION_COUNT) === String(EXPECTED_MIGRATION_COUNT)
    && scope.expected_changed_file_count === String(EXPECTED_CHANGED_FILE_COUNT)
    && scope.migration_start === 'none'
    && scope.migration_end === 'none';
  if (!fixedInputs) {
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
    for (const [index, item] of liveClassroomTencentProvisioningCommands.entries()) {
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
  const ok = passedStepCount === liveClassroomTencentProvisioningCommands.length && countsPassed;
  const failure = failedLabels.length ? failedLabels.join(',') : 'count-contract';
  return {
    ok,
    status: ok ? 'PASS' : `FAIL:${failure}`,
    failedLabels: Object.freeze([...failedLabels]),
    stepCount: liveClassroomTencentProvisioningCommands.length,
    passedStepCount,
    nodeTests,
    nodePassed,
    nodeFailed: nodeTests - nodePassed,
    pythonTests,
    selectedSuite: 'live-classroom-tencent-provisioning',
  };
}
