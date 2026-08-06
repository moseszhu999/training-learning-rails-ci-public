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

export const MARKETPLACE_REAL_PILOT_EXACT_FILES = new Set([
  'docs/operations/trainingos-marketplace-real-pilot-operations-pack-v1.md',
  'docs/operations/trainingos-marketplace-pilot-operator-checklist-v1.md',
  'tests/fixtures/trainingos_marketplace_real_pilot_evidence_v1.json',
  'tests/test_trainingos_marketplace_real_pilot_operations_pack_v1.py',
  'public/trainingos-marketplace-real-pilot-operator-console-v1.html',
]);

const EXPECTED_NODE_COUNT = 0;
const EXPECTED_MIGRATION_COUNT = 368;

const command = (label, executable, args, kind = 'status') => Object.freeze({
  label,
  executable,
  args: Object.freeze(args),
  kind,
});

const PYTHON_FUNCTION_RUNNER = String.raw`
import importlib.util
import pathlib
import traceback

paths = [
    pathlib.Path('tests/test_trainingos_marketplace_onboarding_acceptance_v1.py'),
    pathlib.Path('tests/test_trainingos_viral_growth_loop_v1.py'),
    pathlib.Path('tests/test_trainingos_viral_marketplace_entry_v1.py'),
]
count = 0
failures = 0
for index, test_path in enumerate(paths):
    spec = importlib.util.spec_from_file_location(f'trainingos_roadmap_contract_{index}', test_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f'cannot load fixed test file: {test_path}')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    for name in sorted(vars(module)):
        candidate = getattr(module, name)
        if name.startswith('test_') and callable(candidate):
            count += 1
            try:
                candidate()
            except Exception:
                failures += 1
                traceback.print_exc()
print(f'Ran {count} tests')
raise SystemExit(1 if failures else 0)
`;

export const saasMilestoneRoadmapCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('python-contracts', 'python', ['-c', PYTHON_FUNCTION_RUNNER], 'python'),
  command('svg-well-formed', 'python', [
    '-c',
    "import xml.etree.ElementTree as ET; ET.parse('docs/product/assets/trainingos-saas-milestone-roadmap-v1.svg')",
  ]),
  command('typecheck', 'npm', ['run', 'typecheck']),
  command('production-build', 'npm', ['run', 'build']),
  command('bundle-verification', 'npm', ['run', 'verify:build']),
]);

export const marketplaceRealPilotCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('python-contracts', 'python', [
    '-m', 'unittest', '-v',
    'tests.test_trainingos_marketplace_real_pilot_operations_pack_v1',
  ], 'python'),
  command('typecheck', 'npm', ['run', 'typecheck']),
  command('production-build', 'npm', ['run', 'build']),
  command('bundle-verification', 'npm', ['run', 'verify:build']),
]);

const PROFILES = Object.freeze([
  Object.freeze({
    suite: 'saas-milestone-roadmap',
    files: SAAS_MILESTONE_ROADMAP_EXACT_FILES,
    expectedChangedFileCount: 8,
    expectedPythonCount: 16,
    commands: saasMilestoneRoadmapCommands,
  }),
  Object.freeze({
    suite: 'marketplace-real-pilot-operations-pack',
    files: MARKETPLACE_REAL_PILOT_EXACT_FILES,
    expectedChangedFileCount: 5,
    expectedPythonCount: 14,
    commands: marketplaceRealPilotCommands,
  }),
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

function isExactScope(files, expected) {
  const names = [...files];
  return names.length === expected.size
    && names.every((name) => expected.has(name))
    && names.every((name) => !name.startsWith('supabase/migrations/'))
    && names.every((name) => !name.startsWith('packages/'))
    && names.every((name) => !name.startsWith('apps/'));
}

export function isSaasMilestoneRoadmapScope(files) {
  return isExactScope(files, SAAS_MILESTONE_ROADMAP_EXACT_FILES);
}

export function isMarketplaceRealPilotScope(files) {
  return isExactScope(files, MARKETPLACE_REAL_PILOT_EXACT_FILES);
}

function findProfile(files) {
  return PROFILES.find((profile) => isExactScope(files, profile.files));
}

function fixedInputContract(input, scope, profile) {
  return Number(input.expectedNodeCount) === EXPECTED_NODE_COUNT
    && Number(input.expectedPythonCount) === profile.expectedPythonCount
    && String(process.env.EXPECTED_MIGRATION_COUNT) === String(EXPECTED_MIGRATION_COUNT)
    && scope.expected_changed_file_count === String(profile.expectedChangedFileCount)
    && scope.migration_start === 'none'
    && scope.migration_end === 'none';
}

function failedContractResult(profile) {
  return {
    ok: false,
    status: 'FAIL:fixed-input-contract',
    failedLabels: Object.freeze(['fixed-input-contract']),
    stepCount: profile.commands.length,
    passedStepCount: 0,
    nodeTests: 0,
    nodePassed: 0,
    nodeFailed: 0,
    pythonTests: 0,
    selectedSuite: profile.suite,
  };
}

export async function maybeRunSaasMilestoneRoadmapProfile(input) {
  if (input.profile !== 'generic-owned') return null;
  const { files, scope } = await exactChangedFiles(input);
  const profile = findProfile(files);
  if (!profile) return null;

  if (!fixedInputContract(input, scope, profile)) {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
    return failedContractResult(profile);
  }

  await mkdir(input.runnerTemp, { recursive: true });
  let passedStepCount = 0;
  let pythonTests = 0;
  const failedLabels = [];

  try {
    for (const [index, item] of profile.commands.entries()) {
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

  const countsPassed = pythonTests === profile.expectedPythonCount;
  const ok = passedStepCount === profile.commands.length && countsPassed;
  const failure = failedLabels.length ? failedLabels.join(',') : 'count-contract';
  return {
    ok,
    status: ok ? 'PASS' : `FAIL:${failure}`,
    failedLabels: Object.freeze([...failedLabels]),
    stepCount: profile.commands.length,
    passedStepCount,
    nodeTests: 0,
    nodePassed: 0,
    nodeFailed: 0,
    pythonTests,
    selectedSuite: profile.suite,
  };
}
