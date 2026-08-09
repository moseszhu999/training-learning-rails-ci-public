import { closeSync, openSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const WORKSPACE_TRANSFER_PERSISTENCE_EXACT_FILES = new Set([
  'supabase/migrations/20260806143000_trainingos_marketplace_workspace_agent_bridge_v1.sql',
  'supabase/migrations/20260806160000_trainingos_marketplace_workspace_transfer_deny_policies.sql',
  'tests/test_trainingos_marketplace_workspace_transfer_persistence_v1.py',
]);

const EXPECTED_CHANGED_FILE_COUNT = 3;
const EXPECTED_NODE_COUNT = 0;
const EXPECTED_PYTHON_COUNT = 5;
const EXPECTED_MIGRATION_COUNT = 2;
const MIGRATION_START = '20260806143000';
const MIGRATION_END = '20260806160000';

const command = (label, executable, args, kind = 'status') => Object.freeze({
  label,
  executable,
  args: Object.freeze(args),
  kind,
});

export const workspaceTransferPersistenceCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command(
    'focused-python-contracts',
    'python',
    ['-m', 'unittest', '-v', 'tests.test_trainingos_marketplace_workspace_transfer_persistence_v1'],
    'python',
  ),
  command('typecheck', 'npm', ['run', 'typecheck']),
  command('direct-vite-production-build', 'npx', ['vite', 'build', '--config', 'vite.config.ts']),
  command('postbuild-copy', 'node', ['scripts/copy-trainingos-marketplace-web.mjs']),
  command('bundle-verification', 'npm', ['run', 'verify:build']),
]);

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

export function isWorkspaceTransferPersistenceScope(files) {
  const names = [...files];
  return names.length === WORKSPACE_TRANSFER_PERSISTENCE_EXACT_FILES.size
    && names.every((name) => WORKSPACE_TRANSFER_PERSISTENCE_EXACT_FILES.has(name));
}

function parsePython(text) {
  return [...String(text).matchAll(/Ran\s+(\d+)\s+tests?/g)]
    .reduce((sum, match) => sum + Number(match[1]), 0);
}

function failedContractResult() {
  return {
    ok: false,
    status: 'FAIL:fixed-input-contract',
    failedLabels: Object.freeze(['fixed-input-contract']),
    stepCount: workspaceTransferPersistenceCommands.length,
    passedStepCount: 0,
    nodeTests: 0,
    nodePassed: 0,
    nodeFailed: 0,
    pythonTests: 0,
    selectedSuite: 'marketplace-workspace-transfer-persistence',
  };
}

export async function maybeRunWorkspaceTransferPersistenceProfile(input) {
  if (input.profile !== 'generic-owned') return null;
  const { files, scope } = await exactChangedFiles(input);
  if (!isWorkspaceTransferPersistenceScope(files)) return null;

  const fixedInputs = Number(input.expectedNodeCount) === EXPECTED_NODE_COUNT
    && Number(input.expectedPythonCount) === EXPECTED_PYTHON_COUNT
    && String(process.env.EXPECTED_MIGRATION_COUNT) === String(EXPECTED_MIGRATION_COUNT)
    && scope.expected_changed_file_count === String(EXPECTED_CHANGED_FILE_COUNT)
    && scope.migration_start === MIGRATION_START
    && scope.migration_end === MIGRATION_END;
  if (!fixedInputs) {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
    return failedContractResult();
  }

  let passedStepCount = 0;
  let pythonTests = 0;
  const failedLabels = [];

  try {
    for (const [index, item] of workspaceTransferPersistenceCommands.entries()) {
      const logPath = path.join(input.runnerTemp, `trainingos-workspace-transfer-persistence-${index + 1}.log`);
      const descriptor = openSync(logPath, 'w', 0o600);
      const commandResult = spawnSync(item.executable, item.args, {
        cwd: input.privateRepoPath,
        env: process.env,
        stdio: ['ignore', descriptor, descriptor],
        shell: false,
      });
      closeSync(descriptor);
      const output = await readFile(logPath, 'utf8');
      if (item.kind === 'python') pythonTests += parsePython(output);
      if (commandResult.status === 0) passedStepCount += 1;
      else failedLabels.push(item.label);
    }
  } finally {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
  }

  const stepCount = workspaceTransferPersistenceCommands.length;
  const countsPassed = pythonTests === EXPECTED_PYTHON_COUNT;
  const ok = passedStepCount === stepCount && countsPassed;

  return {
    ok,
    status: ok ? 'PASS' : `FAIL:${failedLabels.length ? failedLabels.join(',') : 'count-contract'}`,
    failedLabels: Object.freeze([...failedLabels]),
    stepCount,
    passedStepCount,
    nodeTests: 0,
    nodePassed: 0,
    nodeFailed: 0,
    pythonTests,
    selectedSuite: 'marketplace-workspace-transfer-persistence',
  };
}
