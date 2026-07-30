import { closeSync, openSync } from 'node:fs';
import { mkdir, readFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { databaseFailureLabel } from './run-private-profile-stage2.mjs';
import { formatProfileStatus } from './run-private-profile-stage8.mjs';

const publicRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const command = (label, executable, args) => Object.freeze({
  label,
  executable,
  args: Object.freeze(args),
});

export const goldenPathCoverageMarkers = Object.freeze([
  'mcp-composition-order',
  'workbuddy-ordinary-user-boundary',
  'teacher-role',
  'student-role',
  'cross-tenant-denial',
  'draft-preparation',
  'publish-confirmation',
  'assignment-confirmation',
  'student-attempt',
  'governed-hint',
  'evidence',
  'human-submission-confirmation',
  'teacher-review',
]);

export const goldenPathContractFiles = Object.freeze([
  'prototypes/trainingos-agent-mvp-v1/agent-native-learning-golden-path.test.mjs',
  'tests/test_trainingos_agent_native_learning_golden_path_contract.py',
  'tests/trainingos-ui-e2e/agent-native-learning-golden-path.spec.ts',
  'tests/sql/trainingos_agent_native_learning_golden_path_e2e.sql',
  'tests/sql/trainingos_agent_native_learning_golden_path_cleanup_e2e.sql',
]);

export const agentNativeLearningProductCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('syntax-vercel-mcp', 'node', ['--check', 'api/integrations/agents/mcp.mjs']),
  command('syntax-netlify-mcp', 'node', ['--check', 'netlify/functions/trainingos-mcp.mjs']),
  command('golden-path-node-contract', 'node', [
    '--test',
    'prototypes/trainingos-agent-mvp-v1/agent-native-learning-golden-path.test.mjs',
  ]),
  command('golden-path-python-contract', 'python', [
    '-m',
    'unittest',
    '-v',
    'tests.test_trainingos_agent_native_learning_golden_path_contract',
  ]),
  command('typecheck', 'npm', ['run', 'typecheck']),
  command('production-build', 'npx', ['vite', 'build', '--config', 'vite.config.ts']),
  command('playwright-install', 'npx', ['playwright', 'install', 'chromium', '--with-deps']),
  command('playwright', 'bash', [
    path.join(publicRoot, 'scripts/run-agent-native-learning-product-playwright.sh'),
  ]),
  command('database-replay', 'bash', [
    path.join(publicRoot, 'scripts/run-agent-native-learning-product-database.sh'),
  ]),
]);

const CLIENT_SOURCE = /^(apps\/training-web\/src|extensions\/trainingos-classroom-vscode\/src)\//;
const SERVICE_ROLE = /\bservice_role\b|SUPABASE_SERVICE_ROLE_KEY|VITE_[A-Z0-9_]*SERVICE_ROLE/i;
const DIRECT_WRITE = /\b(?:supabase|supabaseClient)\s*(?:\?\.)?\.\s*(?:rpc\s*\(|from\s*\([^)]*\)[\s\S]{0,500}?\.\s*(?:insert|update|upsert|delete)\s*\()/i;

function git(repoPath, args) {
  const result = spawnSync('git', ['-C', repoPath, ...args], {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    shell: false,
  });
  if (result.status !== 0) throw new Error('git command failed');
  return result.stdout.trim();
}

async function readScope(runnerTemp) {
  const text = await readFile(path.join(runnerTemp, 'trainingos-scope-contract.env'), 'utf8');
  return Object.fromEntries(text.trim().split('\n').map((line) => {
    const index = line.indexOf('=');
    return [line.slice(0, index), line.slice(index + 1)];
  }));
}

async function verifyClientBoundary({ privateRepoPath, runnerTemp }) {
  const scope = await readScope(runnerTemp);
  const raw = git(privateRepoPath, [
    'diff',
    '--name-only',
    scope.expected_base_sha,
    process.env.PRIVATE_EXACT_SHA,
  ]);
  const changedFiles = raw ? raw.split('\n').filter(Boolean) : [];
  for (const name of changedFiles.filter((file) => CLIENT_SOURCE.test(file))) {
    let text = '';
    try {
      text = await readFile(path.join(privateRepoPath, name), 'utf8');
    } catch {
      continue;
    }
    if (SERVICE_ROLE.test(text)) return false;
    if (DIRECT_WRITE.test(text)) return false;
  }
  return true;
}

async function verifyCoverage(privateRepoPath) {
  const texts = [];
  for (const name of goldenPathContractFiles) {
    texts.push(await readFile(path.join(privateRepoPath, name), 'utf8'));
  }
  const combined = texts.join('\n').toLowerCase();
  return goldenPathCoverageMarkers.every((marker) => combined.includes(marker));
}

async function runCommand(item, index, privateRepoPath, runnerTemp) {
  const logPath = path.join(runnerTemp, `trainingos-profile-${index}.log`);
  const descriptor = openSync(logPath, 'w', 0o600);
  const result = spawnSync(item.executable, item.args, {
    cwd: privateRepoPath,
    env: process.env,
    stdio: ['ignore', descriptor, descriptor],
    shell: false,
  });
  closeSync(descriptor);
  const text = await readFile(logPath, 'utf8');
  return { status: result.status, text };
}

export async function runAgentNativeLearningProductProfile({
  privateRepoPath,
  runnerTemp,
}) {
  await mkdir(runnerTemp, { recursive: true });
  const failedLabels = [];
  let passedSteps = 0;
  const totalSteps = agentNativeLearningProductCommands.length + 2;

  try {
    if (await verifyClientBoundary({ privateRepoPath, runnerTemp })) passedSteps += 1;
    else failedLabels.push('client-security-boundary');

    try {
      if (await verifyCoverage(privateRepoPath)) passedSteps += 1;
      else failedLabels.push('coverage-contract');
    } catch {
      failedLabels.push('coverage-contract');
    }

    for (const [index, item] of agentNativeLearningProductCommands.entries()) {
      const result = await runCommand(item, index + 3, privateRepoPath, runnerTemp);
      if (result.status === 0) passedSteps += 1;
      else if (item.label === 'database-replay') {
        failedLabels.push(databaseFailureLabel(result.text));
      } else {
        failedLabels.push(item.label);
      }
    }
  } finally {
    await rm(path.join(runnerTemp, 'trainingos-scope-contract.env'), { force: true });
    const entries = await readdir(runnerTemp).catch(() => []);
    await Promise.all(entries
      .filter((name) => name.startsWith('trainingos-agent-native-learning-') && name.endsWith('.env'))
      .map((name) => rm(path.join(runnerTemp, name), { force: true })));
  }

  const ok = passedSteps === totalSteps;
  return {
    ok,
    status: formatProfileStatus({ ok, failedLabels, countsPassed: true }),
    failedLabels: Object.freeze([...failedLabels]),
    stepCount: totalSteps,
    passedStepCount: passedSteps,
    nodeTests: 0,
    nodePassed: 0,
    nodeFailed: 0,
    pythonTests: 0,
    selectedSuite: 'agent-native-learning-product',
  };
}
