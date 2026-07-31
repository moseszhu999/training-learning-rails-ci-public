import { closeSync, openSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const EXACT_FILES = new Set([
  'apps/training-web/src/components/TrainingOsAdvancedManagementSurface.tsx',
  'docs/verification/trainingos-workbuddy-mcp-acceptance-v1.md',
  'tests/test_trainingos_workbuddy_mcp_acceptance_contract.py',
]);

const command = (label, executable, args, kind = 'status') => Object.freeze({
  label,
  executable,
  args: Object.freeze(args),
  kind,
});

const commands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('syntax-netlify-mcp', 'node', ['--check', 'netlify/functions/trainingos-mcp.mjs']),
  command('syntax-vercel-mcp', 'node', ['--check', 'api/integrations/agents/mcp.mjs']),
  command('python-contract', 'python', [
    '-m',
    'pytest',
    '-q',
    'tests/test_trainingos_workbuddy_mcp_acceptance_contract.py',
  ], 'python'),
  command('typecheck', 'npm', ['run', 'typecheck']),
  command('production-build', 'npx', ['vite', 'build', '--config', 'vite.config.ts']),
]);

function parsePython(text) {
  const match = text.match(/(?:^|\s)(\d+)\s+passed(?:,|\s|$)/m);
  return match ? Number(match[1]) : 0;
}

async function changedFiles({ privateRepoPath, runnerTemp }) {
  const scopeText = await readFile(path.join(runnerTemp, 'trainingos-scope-contract.env'), 'utf8');
  const scope = Object.fromEntries(scopeText.trim().split('\n').map((line) => {
    const index = line.indexOf('=');
    return [line.slice(0, index), line.slice(index + 1)];
  }));
  const result = spawnSync('git', [
    '-C', privateRepoPath, 'diff', '--name-only', scope.expected_base_sha, process.env.PRIVATE_EXACT_SHA,
  ], { encoding: 'utf8', shell: false });
  if (result.status !== 0) throw new Error('git failed');
  return result.stdout.trim() ? result.stdout.trim().split('\n') : [];
}

function isExactScope(files) {
  return files.length === EXACT_FILES.size && files.every((file) => EXACT_FILES.has(file));
}

export async function maybeRunWorkBuddyMcpClientPathProfile(input) {
  if (input.profile !== 'generic-owned') return null;
  const files = await changedFiles(input);
  if (!isExactScope(files)) return null;

  await mkdir(input.runnerTemp, { recursive: true });
  let passedStepCount = 0;
  let pythonTests = 0;
  const failedLabels = [];

  try {
    for (const [index, item] of commands.entries()) {
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
      if (item.kind === 'python') pythonTests += parsePython(output);
      if (result.status === 0) passedStepCount += 1;
      else failedLabels.push(item.label);
    }
  } finally {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
  }

  const countsPassed = Number(input.expectedNodeCount) === 0
    && Number(input.expectedPythonCount) === 4
    && pythonTests === 4;
  const ok = passedStepCount === commands.length && countsPassed;
  const status = ok
    ? 'PASS'
    : `FAIL:${failedLabels.length ? failedLabels.join(',') : 'count-contract'}`;

  return {
    ok,
    status,
    failedLabels: Object.freeze([...failedLabels]),
    stepCount: commands.length,
    passedStepCount,
    nodeTests: 0,
    nodePassed: 0,
    nodeFailed: 0,
    pythonTests,
    selectedSuite: 'workbuddy-mcp-client-path',
  };
}
