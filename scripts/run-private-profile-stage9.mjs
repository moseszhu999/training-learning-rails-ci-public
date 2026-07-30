import { mkdir, readFile, rm } from 'node:fs/promises';
import { closeSync, openSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { databaseFailureLabel } from './run-private-profile-stage2.mjs';
import {
  formatProfileStatus,
  profileCommands,
  runProfile as runStage8Profile,
} from './run-private-profile-stage8.mjs';

const publicRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const command = (label, executable, args, kind = 'status') => Object.freeze({
  label,
  executable,
  args: Object.freeze(args),
  kind,
});

export const learningAssistanceProfileCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('syntax-governance', 'node', [
    '--check',
    'lib/trainingos-agent-gateway/learning-assistance-governance.mjs',
  ]),
  command('syntax-governance-mcp', 'node', [
    '--check',
    'lib/trainingos-agent-gateway/mcp-learning-assistance-governance-layer.mjs',
  ]),
  command('syntax-vercel-entrypoint', 'node', ['--check', 'api/integrations/agents/mcp.mjs']),
  command('syntax-netlify-entrypoint', 'node', ['--check', 'netlify/functions/trainingos-mcp.mjs']),
  command('node-contract', 'node', [
    '--test',
    'prototypes/trainingos-agent-mvp-v1/learning-assistance-governance.test.mjs',
  ], 'node'),
  command('python-contract', 'python', [
    '-m',
    'unittest',
    '-v',
    'tests.test_trainingos_learning_assistance_governance_contract',
  ], 'python'),
  command('persistent-agent-regression', 'node', [
    '--test',
    'prototypes/trainingos-agent-mvp-v1/persistent-teacher-agent.test.mjs',
  ]),
  command('persistent-python-regression', 'python', [
    '-m',
    'unittest',
    '-v',
    'tests.test_trainingos_persistent_teacher_agent_contract',
  ]),
  command('zero-permission-regression', 'python', [
    '-m',
    'unittest',
    '-v',
    'tests.test_trainingos_zero_permission_bridge_core_contract',
  ]),
  command('vscode-classroom-regression', 'python', [
    '-m',
    'unittest',
    '-v',
    'tests.test_trainingos_vscode_classroom_extension_contract',
  ]),
  command('typecheck', 'npm', ['run', 'typecheck']),
  command('vscode-bundle', 'node', [
    'extensions/trainingos-classroom-vscode/esbuild.mjs',
    '--production',
  ]),
  command('production-build', 'npx', ['vite', 'build', '--config', 'vite.config.ts']),
  command('database-replay', 'bash', [
    path.join(publicRoot, 'scripts/run-learning-assistance-database.sh'),
  ]),
]);

const LEARNING_ASSISTANCE_EXACT_FILES = new Set([
  'api/integrations/agents/mcp.mjs',
  'docs/architecture/trainingos-learning-assistance-governance-runtime-v1.md',
  'docs/testing/trainingos-learning-assistance-governance-validation-v1.md',
  'lib/trainingos-agent-gateway/learning-assistance-governance.mjs',
  'lib/trainingos-agent-gateway/mcp-learning-assistance-governance-layer.mjs',
  'netlify/functions/trainingos-mcp.mjs',
  'prototypes/trainingos-agent-mvp-v1/learning-assistance-governance.test.mjs',
  'tests/sql/trainingos_learning_assistance_governance_schema_e2e.sql',
  'tests/test_trainingos_learning_assistance_governance_contract.py',
]);

const LEARNING_ASSISTANCE_MIGRATION = /^supabase\/migrations\/20260730150[0-2]00_trainingos_learning_assistance_[a-z0-9_]+_v1\.sql$/;

export function isLearningAssistanceGovernanceFiles(files) {
  const names = [...files];
  if (!names.length) return false;
  const migrations = names.filter((name) => name.startsWith('supabase/migrations/'));
  const allOwned = names.every((name) => (
    LEARNING_ASSISTANCE_EXACT_FILES.has(name)
      || LEARNING_ASSISTANCE_MIGRATION.test(name)
  ));
  return allOwned
    && names.includes('lib/trainingos-agent-gateway/learning-assistance-governance.mjs')
    && names.includes('lib/trainingos-agent-gateway/mcp-learning-assistance-governance-layer.mjs')
    && names.includes('tests/test_trainingos_learning_assistance_governance_contract.py')
    && names.includes('tests/sql/trainingos_learning_assistance_governance_schema_e2e.sql')
    && migrations.length === 3;
}

function parseNode(text) {
  return {
    tests: [...text.matchAll(/^# tests\s+(\d+)\s*$/gm)].reduce((sum, match) => sum + Number(match[1]), 0),
    passed: [...text.matchAll(/^# pass\s+(\d+)\s*$/gm)].reduce((sum, match) => sum + Number(match[1]), 0),
    failed: [...text.matchAll(/^# fail\s+(\d+)\s*$/gm)].reduce((sum, match) => sum + Number(match[1]), 0),
  };
}

function parsePython(text) {
  return {
    tests: [...text.matchAll(/Ran\s+(\d+)\s+tests?/g)].reduce((sum, match) => sum + Number(match[1]), 0),
  };
}

async function changedFiles({ privateRepoPath, runnerTemp }) {
  const scopeText = await readFile(path.join(runnerTemp, 'trainingos-scope-contract.env'), 'utf8');
  const scope = Object.fromEntries(scopeText.trim().split('\n').map((line) => {
    const index = line.indexOf('=');
    return [line.slice(0, index), line.slice(index + 1)];
  }));
  const result = spawnSync('git', [
    '-C',
    privateRepoPath,
    'diff',
    '--name-only',
    scope.expected_base_sha,
    process.env.PRIVATE_EXACT_SHA,
  ], { encoding: 'utf8', shell: false });
  if (result.status !== 0) throw new Error('git failed');
  return result.stdout.trim() ? result.stdout.trim().split('\n') : [];
}

async function runFixedProfile({
  privateRepoPath,
  runnerTemp,
  expectedNodeCount,
  expectedPythonCount,
}) {
  await mkdir(runnerTemp, { recursive: true });
  let nodeTests = 0;
  let nodePassed = 0;
  let nodeFailed = 0;
  let pythonTests = 0;
  let passedSteps = 0;
  const failedLabels = [];

  try {
    for (const [index, item] of learningAssistanceProfileCommands.entries()) {
      const logPath = path.join(runnerTemp, `trainingos-profile-${index + 1}.log`);
      const descriptor = openSync(logPath, 'w', 0o600);
      const result = spawnSync(item.executable, item.args, {
        cwd: privateRepoPath,
        env: process.env,
        stdio: ['ignore', descriptor, descriptor],
        shell: false,
      });
      closeSync(descriptor);
      const text = await readFile(logPath, 'utf8');
      if (item.kind === 'node') {
        const parsed = parseNode(text);
        nodeTests += parsed.tests;
        nodePassed += parsed.passed;
        nodeFailed += parsed.failed;
      }
      if (item.kind === 'python') pythonTests += parsePython(text).tests;
      if (result.status === 0) passedSteps += 1;
      else if (item.label === 'database-replay') {
        failedLabels.push(databaseFailureLabel(text));
      } else failedLabels.push(item.label);
    }
  } finally {
    await rm(path.join(runnerTemp, 'trainingos-scope-contract.env'), { force: true });
  }

  const expectedNode = Number(expectedNodeCount);
  const expectedPython = Number(expectedPythonCount);
  const countsPassed = nodeTests === expectedNode
    && nodePassed === expectedNode
    && nodeFailed === 0
    && pythonTests === expectedPython;
  const ok = passedSteps === learningAssistanceProfileCommands.length && countsPassed;
  return {
    ok,
    status: formatProfileStatus({ ok, failedLabels, countsPassed }),
    failedLabels: Object.freeze([...failedLabels]),
    stepCount: learningAssistanceProfileCommands.length,
    passedStepCount: passedSteps,
    nodeTests,
    nodePassed,
    nodeFailed,
    pythonTests,
    selectedSuite: 'learning-assistance-governance',
  };
}

export async function runProfile(input) {
  if (input.profile === 'generic-owned') {
    const files = await changedFiles(input);
    if (isLearningAssistanceGovernanceFiles(files)) {
      return runFixedProfile(input);
    }
  }
  return runStage8Profile(input);
}

export { formatProfileStatus, profileCommands };
