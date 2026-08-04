import { closeSync, openSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const publicRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const MARKETPLACE_CLAIM_REVIEW_EXACT_FILES = new Set([
  'docs/product/trainingos-marketplace-claim-review-lifecycle-v1.md',
  'docs/testing/trainingos-marketplace-claim-review-lifecycle-v1-audit.md',
  'packages/training-marketplace-claim-review/package.json',
  'packages/training-marketplace-claim-review/src/index.d.ts',
  'packages/training-marketplace-claim-review/src/index.mjs',
  'packages/training-marketplace-claim-review/test/claim-review.test.mjs',
  'supabase/migrations/20260804222000_trainingos_marketplace_claim_review_lifecycle_v1.sql',
  'tests/sql/trainingos_marketplace_claim_review_lifecycle_v1_e2e.sql',
  'tests/test_trainingos_marketplace_claim_review_lifecycle_v1.py',
]);

const CANONICAL_MIGRATION_COUNT = 366;
const EXPECTED_NODE_COUNT = 7;
const EXPECTED_PYTHON_COUNT = 12;
const PYTHON_FAILURE_LABELS = new Map([
  ['test_adapter_uses_only_fixed_rpcs_and_no_identity_selectors', 'adapter-rpc-boundary'],
  ['test_approval_is_not_participation_or_ownership_verification', 'approval-truth-boundary'],
  ['test_claimant_status_redacts_reviewer_and_internal_reason', 'claimant-redaction'],
  ['test_documents_preserve_handoff_and_production_truth', 'docs-handoff-truth'],
  ['test_exact_bounded_file_contract', 'exact-owned-scope'],
  ['test_fixed_rpc_surface_is_exact_and_versioned', 'fixed-rpc-surface'],
  ['test_focused_node_and_sql_e2e_cover_security_boundaries', 'focused-e2e-markers'],
  ['test_migration_creates_one_append_only_decision_owner', 'append-only-owner'],
  ['test_queue_is_bounded_to_active_source_host_authority', 'bounded-queue'],
  ['test_review_authority_is_auth_uid_bound_and_scope_is_database_derived', 'authority-scope-derivation'],
  ['test_terminal_decision_is_idempotent_and_self_review_is_denied', 'terminal-idempotency'],
  ['test_types_preserve_safe_projection_contract', 'typed-safe-projection'],
]);

const command = (label, executable, args, kind = 'status') => Object.freeze({
  label,
  executable,
  args: Object.freeze(args),
  kind,
});

export const marketplaceClaimReviewCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('node-adapter', 'node', [
    '--test',
    'packages/training-marketplace-claim-review/test/claim-review.test.mjs',
  ], 'node'),
  command('python-static', 'python', [
    'tests/test_trainingos_marketplace_claim_review_lifecycle_v1.py',
  ], 'python'),
  command('database-replay', 'bash', [
    path.join(publicRoot, 'scripts/run-marketplace-claim-review-lifecycle-database.sh'),
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
  return [...String(text).matchAll(/Ran\s+(\d+)\s+tests?/g)]
    .reduce((sum, match) => sum + Number(match[1]), 0);
}

export function parseMarketplaceClaimReviewPythonFailure(text) {
  const names = [...String(text).matchAll(/CLAIM_REVIEW_PYTHON_FAIL\s+(test_[a-z0-9_]+)/g)]
    .map((match) => match[1]);
  for (const name of names.reverse()) {
    const label = PYTHON_FAILURE_LABELS.get(name);
    if (label) return label;
  }
  return 'unknown';
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

export function isMarketplaceClaimReviewScope(files) {
  const names = [...files];
  return names.length === MARKETPLACE_CLAIM_REVIEW_EXACT_FILES.size
    && names.every((name) => MARKETPLACE_CLAIM_REVIEW_EXACT_FILES.has(name))
    && names.filter((name) => name.startsWith('supabase/migrations/')).length === 1;
}

function fixedInputContract(input, scope) {
  return Number(input.expectedNodeCount) === EXPECTED_NODE_COUNT
    && Number(input.expectedPythonCount) === EXPECTED_PYTHON_COUNT
    && String(process.env.EXPECTED_MIGRATION_COUNT) === String(CANONICAL_MIGRATION_COUNT)
    && scope.expected_changed_file_count === '9'
    && scope.migration_start === '20260804222000'
    && scope.migration_end === '20260804222000';
}

function parseDatabaseStage(text) {
  const match = [...String(text).matchAll(/MARKETPLACE_CLAIM_REVIEW_DB status=FAIL stage=([a-z0-9-]+)/g)].at(-1);
  return match?.[1] ?? 'unknown';
}

function failedContractResult() {
  return {
    ok: false,
    status: 'FAIL:fixed-input-contract@not-run',
    failedLabels: Object.freeze(['fixed-input-contract']),
    stepCount: marketplaceClaimReviewCommands.length,
    passedStepCount: 0,
    nodeTests: 0,
    nodePassed: 0,
    nodeFailed: 0,
    pythonTests: 0,
    selectedSuite: 'marketplace-claim-review-lifecycle',
  };
}

export async function maybeRunMarketplaceClaimReviewProfile(input) {
  if (input.profile !== 'generic-owned') return null;
  const { files, scope } = await exactChangedFiles(input);
  if (!isMarketplaceClaimReviewScope(files)) return null;

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
    for (const [index, item] of marketplaceClaimReviewCommands.entries()) {
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
      if (result.status === 0) {
        passedStepCount += 1;
      } else {
        const label = item.kind === 'python'
          ? `python-static-${parseMarketplaceClaimReviewPythonFailure(output)}`
          : item.label;
        failedLabels.push(label);
        if (item.kind === 'python') break;
      }
    }
  } finally {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
  }

  const countsPassed = nodeTests === EXPECTED_NODE_COUNT
    && nodePassed === EXPECTED_NODE_COUNT
    && nodeFailed === 0
    && pythonTests === EXPECTED_PYTHON_COUNT;
  const ok = passedStepCount === marketplaceClaimReviewCommands.length && countsPassed;
  const failure = failedLabels.length ? failedLabels.join(',') : 'count-contract';
  return {
    ok,
    status: ok ? 'PASS' : `FAIL:${failure}@${databaseStage}`,
    failedLabels: Object.freeze([...failedLabels]),
    stepCount: marketplaceClaimReviewCommands.length,
    passedStepCount,
    nodeTests,
    nodePassed,
    nodeFailed,
    pythonTests,
    selectedSuite: 'marketplace-claim-review-lifecycle',
  };
}
