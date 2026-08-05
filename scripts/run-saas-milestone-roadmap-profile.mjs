import { closeSync, openSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const SAAS_MILESTONE_ROADMAP_EXACT_FILES = new Set([
  'docs/product/assets/trainingos-saas-milestone-roadmap-v1.svg',
  'docs/product/trainingos-saas-milestone-roadmap-v1.md',
  'public/trainingos-marketplace-onboarding-acceptance-v1.html',
  'public/trainingos-viral-growth-loop-v1.html',
  'public/trainingos-viral-marketplace-entry-v1.html',
  'tests/test_trainingos_marketplace_onboarding_acceptance_v1.py',
  'tests/test_trainingos_viral_growth_loop_v1.py',
  'tests/test_trainingos_viral_marketplace_entry_v1.py',
]);

const EXPECTED_NODE_COUNT = 0;
const EXPECTED_PYTHON_COUNT = 16;
const EXPECTED_MIGRATION_COUNT = 368;

const command = (label, executable, args, kind = 'status') => Object.freeze({
  label,
  executable,
  args: Object.freeze(args),
  kind,
});

export const saasMilestoneRoadmapCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('python-contracts', 'python', [
    '-m', 'unittest', '-v',
    'tests.test_trainingos_marketplace_onboarding_acceptance_v1',
    'tests.test_trainingos_viral_growth_loop_v1',
    'tests.test_trainingos_viral_marketplace_entry_v1',
  ], 'python'),
  command('svg-well-formed', 'python', [
    '-c',
    "import xml.etree.ElementTree as ET; ET.parse('docs/product/assets/trainingos-saas-milestone-roadmap-v1.svg')",
  ]),
  command('typecheck', 'npm', ['run', 'typecheck']),
  command('production-build', 'npm', ['run', 'build']),
  command('bundle-verification', 'npm', ['run', 'verify:build']),
]);

function parsePython(text) {
  return [...String(text).matchAll(/Ran\s+(\d+)\s+tests?/g)]
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

export function isSaasMilestoneRoadmapScope(files) {
  const names = [...files];
  return names.length === SAAS_MILESTONE_ROADMAP_EXACT_FILES.size
    && names.every((name) => SAAS_MILESTONE_ROADMAP_EXACT_FILES.has(name))
    && names.every((name) => !name.startsWith('supabase/migrations/'));
}

function fixedInputContract(input, scope) {
  return Number(input.expectedNodeCount) === EXPECTED_NODE_COUNT
    && Number(input.expectedPythonCount) === EXPECTED_PYTHON_COUNT
    && String(process.env.EXPECTED_MIGRATION_COUNT) === String(EXPECTED_MIGRATION_COUNT)
    && scope.expected_changed_file_count === '8'
    && scope.migration_start === 'none'
    && scope.migration_end === 'none';
}

export async function maybeRunSaasMilestoneRoadmapProfile(input) {
  if (input.profile !== 'generic-owned') return null;
  const { files, scope } = await exactChangedFiles(input);
  if (!isSaasMilestoneRoadmapScope(files)) return null;

  if (!fixedInputContract(input, scope)) {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
    return {
      ok: false,
      status: 'FAIL:fixed-input-contract',
      failedLabels: Object.freeze(['fixed-input-contract']),
      stepCount: saasMilestoneRoadmapCommands.length,
      passedStepCount: 0,
      nodeTests: 0,
      nodePassed: 0,
      nodeFailed: 0,
      pythonTests: 0,
      selectedSuite: 'saas-milestone-roadmap',
    };
  }

  await mkdir(input.runnerTemp, { recursive: true });
  let passedStepCount = 0;
  let pythonTests = 0;
  const failedLabels = [];

  try {
    for (const [index, item] of saasMilestoneRoadmapCommands.entries()) {
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

  const countsPassed = pythonTests === EXPECTED_PYTHON_COUNT;
  const ok = passedStepCount === saasMilestoneRoadmapCommands.length && countsPassed;
  const failure = failedLabels.length ? failedLabels.join(',') : 'count-contract';
  return {
    ok,
    status: ok ? 'PASS' : `FAIL:${failure}`,
    failedLabels: Object.freeze([...failedLabels]),
    stepCount: saasMilestoneRoadmapCommands.length,
    passedStepCount,
    nodeTests: 0,
    nodePassed: 0,
    nodeFailed: 0,
    pythonTests,
    selectedSuite: 'saas-milestone-roadmap',
  };
}
