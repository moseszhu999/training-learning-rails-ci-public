import { closeSync, openSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  formatProfileStatus,
  profileCommands,
  runProfile as runStage5Profile,
} from './run-private-profile-stage5.mjs';

const SAFE_TEST_MODULE = /^test_[a-z0-9_]{1,120}$/;
const PYTHON_FAILURE_LINE = /\((?:tests\.)?(test_[a-z0-9_]+)\.[A-Za-z0-9_]+\.[A-Za-z0-9_]+\)\s+\.\.\.\s+(?:FAIL|ERROR)\s*$/gm;
const command = (label, executable, args, kind = 'status') => Object.freeze({
  label,
  executable,
  args: Object.freeze(args),
  kind,
});

export const educationEcosystemProfileCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('syntax-core', 'node', ['--check', 'packages/training-education-ecosystem/src/index.mjs']),
  command('syntax-openmaic', 'node', ['--check', 'packages/training-education-ecosystem/src/openmaic-mock.mjs']),
  command('syntax-marble', 'node', ['--check', 'packages/training-education-ecosystem/src/marble-mock.mjs']),
  command('syntax-gateway', 'node', ['--check', 'lib/trainingos-agent-gateway/education-ecosystem-adapter.mjs']),
  command('node-contract', 'node', [
    '--test',
    'tests/training-education-ecosystem/education-ecosystem-adapter.test.mjs',
  ], 'node'),
  command('typecheck', 'npm', ['run', 'typecheck']),
]);

const educationEcosystemPatterns = Object.freeze([
  /^packages\/training-education-ecosystem\//,
  /^lib\/trainingos-agent-gateway\/education-ecosystem-[^/]+\.mjs$/,
  /^docs\/architecture\/trainingos-education-ecosystem-[^/]+\.md$/,
  /^docs\/testing\/trainingos-education-ecosystem-[^/]+\.md$/,
  /^tests\/training-education-ecosystem\//,
]);

export function isEducationEcosystemFiles(files) {
  const names = [...files];
  if (names.length === 0 || !names.every((name) => educationEcosystemPatterns.some((pattern) => pattern.test(name)))) {
    return false;
  }
  return names.some((name) => name.startsWith('packages/training-education-ecosystem/'))
    && names.some((name) => name.startsWith('lib/trainingos-agent-gateway/education-ecosystem-'))
    && names.some((name) => name.startsWith('docs/architecture/trainingos-education-ecosystem-'))
    && names.some((name) => name.startsWith('docs/testing/trainingos-education-ecosystem-'))
    && names.some((name) => name.startsWith('tests/training-education-ecosystem/'));
}

export function shouldUseEducationEcosystemProfile(profile, files) {
  return (profile === 'education-ecosystem' || profile === 'generic-owned')
    && isEducationEcosystemFiles(files);
}

function parseNode(text) {
  return {
    tests: [...text.matchAll(/^# tests\s+(\d+)\s*$/gm)].reduce((sum, match) => sum + Number(match[1]), 0),
    passed: [...text.matchAll(/^# pass\s+(\d+)\s*$/gm)].reduce((sum, match) => sum + Number(match[1]), 0),
    failed: [...text.matchAll(/^# fail\s+(\d+)\s*$/gm)].reduce((sum, match) => sum + Number(match[1]), 0),
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

async function runEducationEcosystemProfile({
  privateRepoPath,
  runnerTemp,
  expectedNodeCount,
  expectedPythonCount,
}) {
  await mkdir(runnerTemp, { recursive: true });
  const files = await changedFiles({ privateRepoPath, runnerTemp });
  if (!isEducationEcosystemFiles(files)) {
    await rm(path.join(runnerTemp, 'trainingos-scope-contract.env'), { force: true });
    return {
      ok: false,
      status: 'FAIL:education-ecosystem-scope',
      failedLabels: Object.freeze(['education-ecosystem-scope']),
      stepCount: 0,
      passedStepCount: 0,
      nodeTests: 0,
      nodePassed: 0,
      nodeFailed: 0,
      pythonTests: 0,
    };
  }

  let nodeTests = 0;
  let nodePassed = 0;
  let nodeFailed = 0;
  let passedSteps = 0;
  const failedLabels = [];

  try {
    for (const [index, item] of educationEcosystemProfileCommands.entries()) {
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
      if (result.status === 0) passedSteps += 1;
      else failedLabels.push(item.label);
    }
  } finally {
    await rm(path.join(runnerTemp, 'trainingos-scope-contract.env'), { force: true });
  }

  const expectedNode = Number(expectedNodeCount);
  const expectedPython = Number(expectedPythonCount);
  const countsPassed = nodeTests === expectedNode
    && nodePassed === expectedNode
    && nodeFailed === 0
    && expectedPython === 0;
  const ok = passedSteps === educationEcosystemProfileCommands.length && countsPassed;
  return {
    ok,
    status: formatProfileStatus({ ok, failedLabels, countsPassed }),
    failedLabels: Object.freeze([...failedLabels]),
    stepCount: educationEcosystemProfileCommands.length,
    passedStepCount: passedSteps,
    nodeTests,
    nodePassed,
    nodeFailed,
    pythonTests: 0,
  };
}

export function sanitizePythonFailureIdentifiers(text) {
  const identifiers = [];
  for (const match of String(text ?? '').matchAll(PYTHON_FAILURE_LINE)) {
    const moduleName = match[1];
    if (!SAFE_TEST_MODULE.test(moduleName) || identifiers.includes(moduleName)) continue;
    identifiers.push(moduleName);
    if (identifiers.length === 5) break;
  }
  return identifiers.length ? Object.freeze(identifiers) : Object.freeze(['unknown']);
}

async function readOwnedProfileLog(runnerTemp) {
  try {
    return await readFile(path.join(runnerTemp, 'trainingos-profile-2.log'), 'utf8');
  } catch {
    return '';
  }
}

export async function runProfile(input) {
  if (input.profile === 'education-ecosystem') {
    return runEducationEcosystemProfile(input);
  }

  if (input.profile === 'generic-owned') {
    const files = await changedFiles(input);
    if (shouldUseEducationEcosystemProfile(input.profile, files)) {
      return runEducationEcosystemProfile(input);
    }
  }

  const result = await runStage5Profile(input);
  if (
    input.profile !== 'generic-owned'
    || result.ok
    || !result.failedLabels.includes('owned-python-contracts')
  ) {
    return result;
  }

  const pythonFailureIdentifiers = sanitizePythonFailureIdentifiers(
    await readOwnedProfileLog(input.runnerTemp),
  );

  return {
    ...result,
    status: `${result.status}|py=${pythonFailureIdentifiers.join(',')}`,
    pythonFailureIdentifiers,
  };
}

export { formatProfileStatus, profileCommands };
