import { closeSync, openSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { maybeRunMarketplaceVercelFallbackProfile } from './run-marketplace-vercel-fallback-profile.mjs';
import { maybeRunMarketplaceWorkspaceTransferUiProfile } from './run-marketplace-workspace-transfer-ui-profile.mjs';
import { maybeRunMarketplaceWorkspaceTransferServerProfile } from './run-marketplace-workspace-transfer-server-profile.mjs';

export const MARKETPLACE_LIVE_PAGE_WIRING_EXACT_FILES = new Set([
  'apps/training-marketplace-web/src/app.mjs',
  'apps/training-marketplace-web/src/live-page-ui.mjs',
  'tests/training-marketplace-live-page-wiring-v1.test.mjs',
  'tests/trainingos-ui-e2e/marketplace-live-page-v1.spec.ts',
]);

const EXPECTED_CHANGED_FILE_COUNT = 4;
const EXPECTED_NODE_COUNT = 4;
const EXPECTED_PYTHON_COUNT = 0;
const EXPECTED_MIGRATION_COUNT = 373;

const command = (label, executable, args, kind = 'status') => Object.freeze({ label, executable, args: Object.freeze(args), kind });

export const marketplaceLivePageWiringCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('app-syntax', 'node', ['--check', 'apps/training-marketplace-web/src/app.mjs']),
  command('live-page-ui-syntax', 'node', ['--check', 'apps/training-marketplace-web/src/live-page-ui.mjs']),
  command('focused-node-contracts', 'node', ['--test', 'tests/training-marketplace-live-page-wiring-v1.test.mjs'], 'node'),
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

export function isMarketplaceLivePageWiringScope(files) {
  const names = [...files];
  return names.length === MARKETPLACE_LIVE_PAGE_WIRING_EXACT_FILES.size
    && names.every((name) => MARKETPLACE_LIVE_PAGE_WIRING_EXACT_FILES.has(name))
    && names.every((name) => !name.startsWith('supabase/migrations/'));
}

function failedContractResult() {
  return { ok: false, status: 'FAIL:fixed-input-contract', failedLabels: Object.freeze(['fixed-input-contract']), stepCount: marketplaceLivePageWiringCommands.length, passedStepCount: 0, nodeTests: 0, nodePassed: 0, nodeFailed: 0, pythonTests: 0, selectedSuite: 'marketplace-live-page-wiring' };
}

export async function maybeRunMarketplaceLivePageWiringProfile(input) {
  if (input.profile !== 'generic-owned') return null;
  const vercelFallback = await maybeRunMarketplaceVercelFallbackProfile(input);
  if (vercelFallback) return vercelFallback;
  const transferUi = await maybeRunMarketplaceWorkspaceTransferUiProfile(input);
  if (transferUi) return transferUi;
  const transferServer = await maybeRunMarketplaceWorkspaceTransferServerProfile(input);
  if (transferServer) return transferServer;

  const { files, scope } = await exactChangedFiles(input);
  if (!isMarketplaceLivePageWiringScope(files)) return null;
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
    for (const [index, item] of marketplaceLivePageWiringCommands.entries()) {
      const logPath = path.join(input.runnerTemp, `trainingos-marketplace-live-page-wiring-${index + 1}.log`);
      const descriptor = openSync(logPath, 'w', 0o600);
      const commandResult = spawnSync(item.executable, item.args, { cwd: input.privateRepoPath, env: process.env, stdio: ['ignore', descriptor, descriptor], shell: false });
      closeSync(descriptor);
      const output = await readFile(logPath, 'utf8');
      if (item.kind === 'node') {
        nodeTests += sumMatches(output, /^# tests\s+(\d+)$/gm);
        nodePassed += sumMatches(output, /^# pass\s+(\d+)$/gm);
        nodeFailed += sumMatches(output, /^# fail\s+(\d+)$/gm);
      }
      if (item.kind === 'python') pythonTests += sumMatches(output, /Ran\s+(\d+)\s+tests?/g);
      if (commandResult.status === 0) passedStepCount += 1;
      else failedLabels.push(item.label);
    }
  } finally {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
  }
  const stepCount = marketplaceLivePageWiringCommands.length;
  const countsPassed = nodeTests === EXPECTED_NODE_COUNT && nodePassed === EXPECTED_NODE_COUNT && nodeFailed === 0 && pythonTests === EXPECTED_PYTHON_COUNT;
  const ok = passedStepCount === stepCount && countsPassed;
  return { ok, status: ok ? 'PASS' : `FAIL:${failedLabels.length ? failedLabels.join(',') : 'count-contract'}`, failedLabels: Object.freeze([...failedLabels]), stepCount, passedStepCount, nodeTests, nodePassed, nodeFailed, pythonTests, selectedSuite: 'marketplace-live-page-wiring' };
}
