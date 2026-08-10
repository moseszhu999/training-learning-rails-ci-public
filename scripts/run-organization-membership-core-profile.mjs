import { closeSync, openSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const ORGANIZATION_MEMBERSHIP_CORE_EXACT_FILES = new Set([
  'docs/architecture/trainingos-organization-membership-core-v1.md',
  'packages/training-organization-core/package.json',
  'packages/training-organization-core/src/index.d.ts',
  'packages/training-organization-core/src/index.mjs',
  'tests/training-organization-membership-core-v1.test.mjs',
]);

const EXPECTED_CHANGED_FILE_COUNT = 5;
const EXPECTED_NODE_COUNT = 8;
const EXPECTED_PYTHON_COUNT = 0;
const EXPECTED_MIGRATION_COUNT = 373;
const PRIVATE_TEST_FILE = 'tests/training-organization-membership-core-v1.test.mjs';

const command = (label, executable, args, kind = 'status') => Object.freeze({
  label,
  executable,
  args: Object.freeze(args),
  kind,
});

export const ORGANIZATION_MEMBERSHIP_CORE_NODE_CASES = Object.freeze([
  Object.freeze({ label: 'node-case-01-organization', pattern: 'creates deterministic privacy-safe organization truth without creating authority' }),
  Object.freeze({ label: 'node-case-02-membership-boundary', pattern: 'creates organization membership without collapsing class, login, role, capability or authority' }),
  Object.freeze({ label: 'node-case-03-lifecycle', pattern: 'projects active, suspended, revoked, expired and not-yet-valid states deterministically' }),
  Object.freeze({ label: 'node-case-04-class-rejection', pattern: 'rejects class identity as organization identity' }),
  Object.freeze({ label: 'node-case-05-private-ref-rejection', pattern: 'rejects email-like PII and secret-shaped refs' }),
  Object.freeze({ label: 'node-case-06-shape-role-rejection', pattern: 'rejects unknown fields and unsupported organization roles' }),
  Object.freeze({ label: 'node-case-07-validity-evidence-rejection', pattern: 'rejects invalid validity windows and duplicate evidence refs' }),
  Object.freeze({ label: 'node-case-08-status-boundary', pattern: 'membership status remains non-authorizing in every lifecycle state' }),
]);

export const organizationMembershipCoreCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('contract-syntax', 'node', ['--check', 'packages/training-organization-core/src/index.mjs']),
  ...ORGANIZATION_MEMBERSHIP_CORE_NODE_CASES.map(({ label, pattern }) =>
    command(label, 'node', ['--test', `--test-name-pattern=${pattern}`, PRIVATE_TEST_FILE], 'node-case')),
  command('declaration-typecheck', 'npx', [
    'tsc', '--noEmit', '--strict', '--skipLibCheck', 'false',
    '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2022',
    'packages/training-organization-core/src/index.d.ts',
  ]),
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

export function isOrganizationMembershipCoreScope(files) {
  const names = [...files];
  return names.length === ORGANIZATION_MEMBERSHIP_CORE_EXACT_FILES.size
    && names.every((name) => ORGANIZATION_MEMBERSHIP_CORE_EXACT_FILES.has(name))
    && names.every((name) => !name.startsWith('supabase/migrations/'));
}

function failedContractResult() {
  return {
    ok: false,
    status: 'FAIL:fixed-input-contract',
    failedLabels: Object.freeze(['fixed-input-contract']),
    stepCount: organizationMembershipCoreCommands.length,
    passedStepCount: 0,
    nodeTests: 0,
    nodePassed: 0,
    nodeFailed: 0,
    pythonTests: 0,
    selectedSuite: 'organization-membership-core',
  };
}

export async function maybeRunOrganizationMembershipCoreProfile(input) {
  if (input.profile !== 'generic-owned') return null;
  const { files, scope } = await exactChangedFiles(input);
  if (!isOrganizationMembershipCoreScope(files)) return null;

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
    for (const [index, item] of organizationMembershipCoreCommands.entries()) {
      const logPath = path.join(input.runnerTemp, `trainingos-organization-membership-core-${index + 1}.log`);
      const descriptor = openSync(logPath, 'w', 0o600);
      const commandResult = spawnSync(item.executable, item.args, {
        cwd: input.privateRepoPath,
        env: process.env,
        stdio: ['ignore', descriptor, descriptor],
        shell: false,
      });
      closeSync(descriptor);
      await readFile(logPath, 'utf8');
      if (item.kind === 'node-case') {
        nodeTests += 1;
        if (commandResult.status === 0) nodePassed += 1;
        else nodeFailed += 1;
      }
      if (commandResult.status === 0) passedStepCount += 1;
      else failedLabels.push(item.label);
    }
  } finally {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
  }

  const stepCount = organizationMembershipCoreCommands.length;
  const countsPassed = nodeTests === EXPECTED_NODE_COUNT
    && nodePassed === EXPECTED_NODE_COUNT
    && nodeFailed === 0;
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
    selectedSuite: 'organization-membership-core',
  };
}
