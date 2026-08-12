import { closeSync, openSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const COURSE_DESIGN_MCP_READ_V1_EXACT_FILES = new Set([
  'docs/architecture/trainingos-course-design-mcp-read-v1.md',
  'lib/trainingos-agent-gateway/course-design-context.mjs',
  'lib/trainingos-agent-gateway/mcp-chat-exercise-server.mjs',
  'tests/test_trainingos_course_design_mcp_read_v1.py',
  'tests/trainingos-agent-gateway/course-design-mcp-read-v1.test.mjs',
]);

const EXPECTED_CHANGED_FILE_COUNT = 5;
const EXPECTED_NODE_COUNT = 10;
const EXPECTED_PYTHON_COUNT = 10;
const EXPECTED_MIGRATION_COUNT = 369;

const command = (label, executable, args, kind = 'status') => Object.freeze({
  label,
  executable,
  args: Object.freeze(args),
  kind,
});

export const courseDesignMcpReadV1Commands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('syntax', 'node', ['--check', 'lib/trainingos-agent-gateway/course-design-context.mjs']),
  command('focused-node-contracts', 'node', [
    '--test', 'tests/trainingos-agent-gateway/course-design-mcp-read-v1.test.mjs',
  ], 'node'),
  command('focused-python-contracts', 'python', [
    '-m', 'unittest', '-v', 'tests.test_trainingos_course_design_mcp_read_v1',
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
function parseNodeFailed(text) {
  return [...String(text).matchAll(/^# fail\s+(\d+)$/gm)]
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

export function isCourseDesignMcpReadV1Scope(files) {
  const names = [...files];
  return names.length === COURSE_DESIGN_MCP_READ_V1_EXACT_FILES.size
    && names.every((name) => COURSE_DESIGN_MCP_READ_V1_EXACT_FILES.has(name))
    && names.every((name) => !name.startsWith('supabase/migrations/'));
}

function failedContractResult() {
  return {
    ok: false,
    status: 'FAIL:fixed-input-contract',
    failedLabels: Object.freeze(['fixed-input-contract']),
    stepCount: courseDesignMcpReadV1Commands.length,
    passedStepCount: 0,
    nodeTests: 0,
    nodePassed: 0,
    nodeFailed: 0,
    pythonTests: 0,
    selectedSuite: 'course-design-mcp-read-v1',
  };
}

export async function maybeRunCourseDesignMcpReadV1Profile(input) {
  if (input.profile !== 'generic-owned') return null;
  const { files, scope } = await exactChangedFiles(input);
  if (!isCourseDesignMcpReadV1Scope(files)) return null;

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
  let pythonTests = 0;
  const failedLabels = [];

  try {
    for (const [index, item] of courseDesignMcpReadV1Commands.entries()) {
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
        nodeTests += parseNode(output);
        nodePassed += parseNodePassed(output);
        nodeFailed += parseNodeFailed(output);
      }
      if (item.kind === 'python') pythonTests += parsePython(output);
      if (commandResult.status === 0) passedStepCount += 1;
      else failedLabels.push(item.label);
    }
  } finally {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
  }

  const countsPassed = nodeTests === EXPECTED_NODE_COUNT
    && nodePassed === EXPECTED_NODE_COUNT
    && nodeFailed === 0
    && pythonTests === EXPECTED_PYTHON_COUNT;
  const stepCount = courseDesignMcpReadV1Commands.length;
  const ok = passedStepCount === stepCount && countsPassed;
  const failure = failedLabels.length ? failedLabels.join(',') : 'count-contract';
  return {
    ok,
    status: ok ? 'PASS' : `FAIL:${failure}`,
    failedLabels: Object.freeze([...failedLabels]),
    stepCount,
    passedStepCount,
    nodeTests,
    nodePassed,
    nodeFailed,
    pythonTests,
    selectedSuite: 'course-design-mcp-read-v1',
  };
}

// W3B is intentionally co-located in this pre-existing profile module.
// The exact-head runner experienced a module-resolution failure for a newly-added
// standalone profile file after the private checkout stage even though public unit CI
// could see that file. Keeping the bounded W3B dispatcher in an already-established
// module removes that checkout-composition dependency without changing private scope.
export const GROUP_TRAINING_DEMAND_W3B_EXACT_FILES = new Set([
  'docs/product/trainingos-group-training-demand-loop-v1.md',
  'src/lib/trainingos-group-training-demand-loop-v1.mjs',
  'tests/trainingos-group-training-demand-loop-v1.test.mjs',
]);

const W3B_EXPECTED_CHANGED_FILE_COUNT = 3;
const W3B_EXPECTED_NODE_COUNT = 12;
const W3B_EXPECTED_PYTHON_COUNT = 0;

export const groupTrainingDemandW3bCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('module-syntax', 'node', ['--check', 'src/lib/trainingos-group-training-demand-loop-v1.mjs']),
  command('focused-node-contracts', 'node', ['--test', 'tests/trainingos-group-training-demand-loop-v1.test.mjs'], 'node'),
  command('typecheck', 'npm', ['run', 'typecheck']),
  command('production-build', 'npm', ['run', 'build']),
]);

export function isGroupTrainingDemandW3bScope(files) {
  const names = [...files];
  return names.length === GROUP_TRAINING_DEMAND_W3B_EXACT_FILES.size
    && names.every((name) => GROUP_TRAINING_DEMAND_W3B_EXACT_FILES.has(name))
    && names.every((name) => !name.startsWith('supabase/migrations/'));
}

function failedW3bContractResult() {
  return {
    ok: false,
    status: 'FAIL:fixed-input-contract',
    failedLabels: Object.freeze(['fixed-input-contract']),
    stepCount: groupTrainingDemandW3bCommands.length,
    passedStepCount: 0,
    nodeTests: 0,
    nodePassed: 0,
    nodeFailed: 0,
    pythonTests: 0,
    selectedSuite: 'group-training-demand-loop-w3b',
  };
}

export async function maybeRunGroupTrainingDemandW3bProfile(input) {
  if (input.profile !== 'generic-owned') return null;
  const { files, scope } = await exactChangedFiles(input);
  if (!isGroupTrainingDemandW3bScope(files)) return null;

  const fixedInputs = Number(input.expectedNodeCount) === W3B_EXPECTED_NODE_COUNT
    && Number(input.expectedPythonCount) === W3B_EXPECTED_PYTHON_COUNT
    && scope.expected_changed_file_count === String(W3B_EXPECTED_CHANGED_FILE_COUNT)
    && scope.migration_start === 'none'
    && scope.migration_end === 'none';
  if (!fixedInputs) {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
    return failedW3bContractResult();
  }

  let passedStepCount = 0;
  let nodeTests = 0;
  let nodePassed = 0;
  let nodeFailed = 0;
  const failedLabels = [];

  try {
    for (const [index, item] of groupTrainingDemandW3bCommands.entries()) {
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
        nodeTests += parseNode(output);
        nodePassed += parseNodePassed(output);
        nodeFailed += parseNodeFailed(output);
      }
      if (commandResult.status === 0) passedStepCount += 1;
      else failedLabels.push(item.label);
    }
  } finally {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
  }

  const countsPassed = nodeTests === W3B_EXPECTED_NODE_COUNT
    && nodePassed === W3B_EXPECTED_NODE_COUNT
    && nodeFailed === 0;
  const stepCount = groupTrainingDemandW3bCommands.length;
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
    pythonTests: 0,
    selectedSuite: 'group-training-demand-loop-w3b',
  };
}
