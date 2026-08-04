import { closeSync, openSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const publicRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const MARKETPLACE_REVIEWER_AUTHORITY_EXACT_FILES = new Set([
  'docs/product/trainingos-marketplace-reviewer-authority-owner-v1.md',
  'docs/testing/trainingos-marketplace-reviewer-authority-owner-v1-audit.md',
  'packages/training-marketplace-reviewer-authority/package.json',
  'packages/training-marketplace-reviewer-authority/src/index.d.ts',
  'packages/training-marketplace-reviewer-authority/src/index.mjs',
  'packages/training-marketplace-reviewer-authority/test/reviewer-authority.test.mjs',
  'supabase/migrations/20260804212000_trainingos_marketplace_reviewer_authority_owner_v1.sql',
  'tests/sql/trainingos_marketplace_reviewer_authority_owner_v1_e2e.sql',
  'tests/test_trainingos_marketplace_reviewer_authority_owner_v1.py',
]);

const CANONICAL_MIGRATION_COUNT = 365;
const EXPECTED_NODE_COUNT = 5;
const EXPECTED_PYTHON_COUNT = 9;

const command = (label, executable, args, kind = 'status') => Object.freeze({
  label,
  executable,
  args: Object.freeze(args),
  kind,
});

export const marketplaceReviewerAuthorityCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('node-adapter', 'node', [
    '--test',
    'packages/training-marketplace-reviewer-authority/test/reviewer-authority.test.mjs',
  ], 'node'),
  command('python-static', 'python', [
    'tests/test_trainingos_marketplace_reviewer_authority_owner_v1.py',
  ], 'python'),
  command('database-replay', 'bash', [
    path.join(publicRoot, 'scripts/run-marketplace-reviewer-authority-database.sh'),
  ], 'database'),
  command('typecheck', 'npm', ['run', 'typecheck']),
  command('production-build', 'npx', ['vite', 'build', '--config', 'vite.config.ts']),
  command('bundle-verification', 'npm', ['run', 'verify:build']),
]);

function parseNode(text) {
  const tests = Number(text.match(/# tests\s+(\d+)/)?.[1] ?? 0);
  const passed = Number(text.match(/# pass\s+(\d+)/)?.[1] ?? 0);
  const failed = Number(text.match(/# fail\s+(\d+)/)?.[1] ?? 0);
  return { tests, passed, failed };
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

export function isMarketplaceReviewerAuthorityScope(files) {
  const names = [...files];
  return names.length === MARKETPLACE_REVIEWER_AUTHORITY_EXACT_FILES.size
    && names.every((name) => MARKETPLACE_REVIEWER_AUTHORITY_EXACT_FILES.has(name))
    && names.filter((name) => name.startsWith('supabase/migrations/')).length === 1;
}

function fixedInputContract(input, scope) {
  return Number(input.expectedNodeCount) === EXPECTED_NODE_COUNT
    && Number(input.expectedPythonCount) === EXPECTED_PYTHON_COUNT
    && String(process.env.EXPECTED_MIGRATION_COUNT) === String(CANONICAL_MIGRATION_COUNT)
    && scope.expected_changed_file_count === '9'
    && scope.migration_start === '20260804212000'
    && scope.migration_end === '20260804212000';
}

function parseDatabaseStage(text) {
  const match = [...text.matchAll(/MARKETPLACE_REVIEWER_AUTHORITY_DB status=FAIL stage=([a-z0-9-]+)/g)].at(-1);
  return match?.[1] ?? 'unknown';
}

function failedContractResult() {
  return {
    ok: false,
    status: 'FAIL:fixed-input-contract@not-run',
    failedLabels: Object.freeze(['fixed-input-contract']),
    stepCount: marketplaceReviewerAuthorityCommands.length,
    passedStepCount: 0,
    nodeTests: 0,
    nodePassed: 0,
    nodeFailed: 0,
    pythonTests: 0,
    selectedSuite: 'marketplace-reviewer-authority',
  };
}

export async function maybeRunMarketplaceReviewerAuthorityProfile(input) {
  if (input.profile !== 'generic-owned') return null;
  const { files, scope } = await exactChangedFiles(input);
  if (!isMarketplaceReviewerAuthorityScope(files)) return null;

  if (!fixedInputContract(input, scope)) {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
    return failedContractResult();
  }

  await mkdir(input.runnerTemp, { recursive: true });
  let passedStepCount = 0;
  let nodeTests = 0;
  let nodePassed = 0;
  let nodeFailed = 0;
  let pythonTests = 0;
  let databaseStage = 'not-run';
  const failedLabels = [];

  try {
    for (const [index, item] of marketplaceReviewerAuthorityCommands.entries()) {
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
        const parsed = parseNode(output);
        nodeTests += parsed.tests;
        nodePassed += parsed.passed;
        nodeFailed += parsed.failed;
      }
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

  const countsPassed = nodeTests === EXPECTED_NODE_COUNT
    && nodePassed === EXPECTED_NODE_COUNT
    && nodeFailed === 0
    && pythonTests === EXPECTED_PYTHON_COUNT;
  const ok = passedStepCount === marketplaceReviewerAuthorityCommands.length && countsPassed;
  const failure = failedLabels.length ? failedLabels.join(',') : 'count-contract';
  return {
    ok,
    status: ok ? 'PASS' : `FAIL:${failure}@${databaseStage}`,
    failedLabels: Object.freeze([...failedLabels]),
    stepCount: marketplaceReviewerAuthorityCommands.length,
    passedStepCount,
    nodeTests,
    nodePassed,
    nodeFailed,
    pythonTests,
    selectedSuite: 'marketplace-reviewer-authority',
  };
}
