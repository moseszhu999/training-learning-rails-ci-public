import { closeSync, openSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const CAPABILITY_CREDENTIAL_ISSUANCE_EXACT_FILES = new Set([
  '.github/workflows/trainingos-capability-credential-issuance-v1.yml',
  'docs/architecture/trainingos-capability-credential-issuance-v1.md',
  'packages/training-capability-credential-issuance-adapter/package.json',
  'packages/training-capability-credential-issuance-adapter/src/index.mjs',
  'supabase/migrations/20260810093000_trainingos_capability_credential_issuance_v1.sql',
  'supabase/migrations/20260810094500_trainingos_capability_credential_issuance_fk_indexes_v1.sql',
  'tests/training-capability-credential-issuance-v1.test.mjs',
]);

const EXPECTED_CHANGED_FILE_COUNT = 7;
const EXPECTED_NODE_COUNT = 10;
const EXPECTED_PYTHON_COUNT = 0;
const EXPECTED_MIGRATION_COUNT = 376;
const MIGRATION_START = '20260810093000';
const MIGRATION_END = '20260810094500';

const command = (label, executable, args, kind = 'status') => Object.freeze({ label, executable, args: Object.freeze(args), kind });

export const capabilityCredentialIssuanceCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('adapter-module-load', 'node', ['--input-type=module', '--eval', "await import('./packages/training-capability-credential-issuance-adapter/src/index.mjs')"]),
  command('focused-node-contracts', 'node', ['--test', 'tests/training-capability-credential-issuance-v1.test.mjs'], 'node'),
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

export function isCapabilityCredentialIssuanceScope(files) {
  const names = [...files];
  return names.length === CAPABILITY_CREDENTIAL_ISSUANCE_EXACT_FILES.size
    && names.every((name) => CAPABILITY_CREDENTIAL_ISSUANCE_EXACT_FILES.has(name));
}

function failedContractResult() {
  return { ok: false, status: 'FAIL:fixed-input-contract', failedLabels: Object.freeze(['fixed-input-contract']), stepCount: capabilityCredentialIssuanceCommands.length, passedStepCount: 0, nodeTests: 0, nodePassed: 0, nodeFailed: 0, pythonTests: 0, selectedSuite: 'capability-credential-issuance' };
}

export async function maybeRunCapabilityCredentialIssuanceProfile(input) {
  if (input.profile !== 'generic-owned') return null;
  const { files, scope } = await exactChangedFiles(input);
  if (!isCapabilityCredentialIssuanceScope(files)) return null;
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
  let nodeTests = 0;
  let nodePassed = 0;
  let nodeFailed = 0;
  const failedLabels = [];
  try {
    for (const [index, item] of capabilityCredentialIssuanceCommands.entries()) {
      const logPath = path.join(input.runnerTemp, `trainingos-capability-credential-issuance-${index + 1}.log`);
      const descriptor = openSync(logPath, 'w', 0o600);
      const commandResult = spawnSync(item.executable, item.args, { cwd: input.privateRepoPath, env: process.env, stdio: ['ignore', descriptor, descriptor], shell: false });
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
  const stepCount = capabilityCredentialIssuanceCommands.length;
  const countsPassed = nodeTests === EXPECTED_NODE_COUNT && nodePassed === EXPECTED_NODE_COUNT && nodeFailed === 0;
  const ok = passedStepCount === stepCount && countsPassed;
  return { ok, status: ok ? 'PASS' : `FAIL:${failedLabels.length ? failedLabels.join(',') : 'count-contract'}`, failedLabels: Object.freeze([...failedLabels]), stepCount, passedStepCount, nodeTests, nodePassed, nodeFailed, pythonTests: 0, selectedSuite: 'capability-credential-issuance' };
}
