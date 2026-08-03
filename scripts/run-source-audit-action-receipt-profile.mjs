import { closeSync, openSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const EXACT_FILES = new Set([
  'apps/training-web/src/components/TrainingOsSourceAuditDrawer.tsx',
  'apps/training-web/src/components/TrainingOsStructuredAgentCommand.tsx',
  'apps/training-web/src/lib/trainingos-action-verification-receipt.ts',
  'apps/training-web/src/lib/trainingos-structured-agent-command.ts',
  'apps/training-web/src/trainingos-structured-agent-command.css',
  'docs/product/trainingos-source-audit-action-receipt-v1.md',
  'tests/test_trainingos_source_audit_action_receipt_v1.py',
]);

const command = (label, executable, args, kind = 'status') => Object.freeze({
  label,
  executable,
  args: Object.freeze(args),
  kind,
});

const commands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('python-contract', 'python', [
    '-m', 'unittest',
    'tests.test_trainingos_structured_agent_preview_v1',
    'tests.test_trainingos_source_audit_action_receipt_v1',
    '-v',
  ], 'python'),
  command('typecheck', 'npm', ['run', 'typecheck']),
  command('production-build', 'npm', ['run', 'build']),
  command('bundle-verification', 'npm', ['run', 'verify:build']),
]);

function parsePython(text) {
  const match = text.match(/Ran\s+(\d+)\s+tests?/m);
  return match ? Number(match[1]) : 0;
}

function git(repoPath, args) {
  const result = spawnSync('git', ['-C', repoPath, ...args], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    shell: false,
  });
  if (result.status !== 0) throw new Error('git failed');
  return result.stdout.trim();
}

async function changedFiles({ privateRepoPath, runnerTemp, privateExactSha }) {
  const scopeText = await readFile(path.join(runnerTemp, 'trainingos-scope-contract.env'), 'utf8');
  const scope = Object.fromEntries(scopeText.trim().split('\n').map((line) => {
    const index = line.indexOf('=');
    return [line.slice(0, index), line.slice(index + 1)];
  }));
  const raw = git(privateRepoPath, [
    'diff', '--name-only', scope.expected_base_sha, privateExactSha,
  ]);
  return raw ? raw.split('\n').filter(Boolean) : [];
}

function isExactScope(files) {
  return files.length === EXACT_FILES.size && files.every((file) => EXACT_FILES.has(file));
}

export async function runSourceAuditActionReceiptProfile(input) {
  const files = await changedFiles(input);
  if (!isExactScope(files)) {
    return {
      ok: false,
      status: 'FAIL:exact-scope',
      failedLabels: Object.freeze(['exact-scope']),
      stepCount: commands.length,
      passedStepCount: 0,
      nodeTests: 0,
      nodePassed: 0,
      nodeFailed: 0,
      pythonTests: 0,
      selectedSuite: 'source-audit-action-receipt',
    };
  }

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
    && Number(input.expectedPythonCount) === 13
    && pythonTests === 13;
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
    selectedSuite: 'source-audit-action-receipt',
  };
}
