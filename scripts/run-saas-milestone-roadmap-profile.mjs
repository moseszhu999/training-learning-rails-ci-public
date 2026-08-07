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

export const COURSE_VIDEO_SHARED_MEDIA_EXACT_FILES = new Set([
  'docs/architecture/trainingos-course-video-shared-media-adapter-v1.md',
  'packages/training-course-video-shared-media-adapter/package.json',
  'packages/training-course-video-shared-media-adapter/src/index.d.ts',
  'packages/training-course-video-shared-media-adapter/src/index.mjs',
  'packages/training-course-video-shared-media-adapter/test/course-video-adapter.test.mjs',
  'tests/test_trainingos_course_video_shared_media_adapter_v1.py',
]);

export const LIVE_CLASSROOM_STACK_EXACT_FILES = new Set([
  'apps/training-web/src/components/TrainingOsAdvancedOperations.tsx',
  'apps/training-web/src/components/TrainingOsLiveClassroomSurface.tsx',
  'apps/training-web/src/lib/trainingos-live-classroom-contract.ts',
  'apps/training-web/src/lib/trainingos-live-classroom-postclass-evidence.ts',
  'apps/training-web/src/lib/trainingos-live-classroom-teaching-interactions.ts',
  'apps/training-web/src/lib/trainingos-live-classroom-tencent-bootstrap.ts',
  'apps/training-web/src/lib/trainingos-live-classroom-tencent-provider.ts',
  'apps/training-web/src/trainingos-live-classroom.css',
  'docs/architecture/trainingos-live-classroom-contract-v1.md',
  'docs/architecture/trainingos-live-classroom-postclass-evidence-v1.md',
  'docs/architecture/trainingos-live-classroom-teaching-interactions-v1.md',
  'docs/architecture/trainingos-live-classroom-tencent-provider-v1.md',
  'docs/testing/trainingos-live-classroom-browser-network-cost-matrix-v1.md',
  'public/trainingos-live-classroom-runtime-matrix-v1.html',
  'tests/test_trainingos_live_classroom_contract_v1.py',
  'tests/test_trainingos_live_classroom_postclass_evidence_v1.py',
  'tests/test_trainingos_live_classroom_runtime_matrix_v1.py',
  'tests/test_trainingos_live_classroom_teaching_interactions_v1.py',
  'tests/test_trainingos_live_classroom_tencent_provider_v1.py',
  'tests/trainingos-ui-e2e/live-classroom-runtime-matrix.config.ts',
  'tests/trainingos-ui-e2e/live-classroom-runtime-matrix.spec.ts',
]);

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

export const courseVideoSharedMediaCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('package-syntax', 'node', ['--check', 'packages/training-course-video-shared-media-adapter/src/index.mjs']),
  command('focused-node-contracts', 'node', ['--test', 'packages/training-course-video-shared-media-adapter/test/course-video-adapter.test.mjs'], 'node'),
  command('focused-python-contracts', 'python', ['tests/test_trainingos_course_video_shared_media_adapter_v1.py', '-v'], 'python'),
  command('declaration-typecheck', 'npx', [
    'tsc', '--noEmit', '--strict', '--skipLibCheck', 'false',
    '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--target', 'ES2022',
    'packages/training-course-video-shared-media-adapter/src/index.d.ts',
  ]),
  command('typecheck', 'npm', ['run', 'typecheck']),
  command('production-build', 'npm', ['run', 'build']),
  command('bundle-verification', 'npm', ['run', 'verify:build']),
]);

export const liveClassroomStackCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('focused-python-contracts', 'python', [
    '-m', 'unittest', '-v',
    'tests.test_trainingos_live_classroom_contract_v1',
    'tests.test_trainingos_live_classroom_tencent_provider_v1',
    'tests.test_trainingos_live_classroom_teaching_interactions_v1',
    'tests.test_trainingos_live_classroom_postclass_evidence_v1',
    'tests.test_trainingos_live_classroom_runtime_matrix_v1',
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
    expectedNodeCount: 0,
    expectedPythonCount: 16,
    commands: saasMilestoneRoadmapCommands,
  }),
  Object.freeze({
    suite: 'marketplace-real-pilot-operations-pack',
    files: MARKETPLACE_REAL_PILOT_EXACT_FILES,
    expectedChangedFileCount: 5,
    expectedNodeCount: 0,
    expectedPythonCount: 14,
    commands: marketplaceRealPilotCommands,
  }),
  Object.freeze({
    suite: 'course-video-shared-media-adapter',
    files: COURSE_VIDEO_SHARED_MEDIA_EXACT_FILES,
    expectedChangedFileCount: 6,
    expectedNodeCount: 12,
    expectedPythonCount: 9,
    commands: courseVideoSharedMediaCommands,
  }),
  Object.freeze({
    suite: 'live-classroom-stack',
    files: LIVE_CLASSROOM_STACK_EXACT_FILES,
    expectedChangedFileCount: 21,
    expectedNodeCount: 0,
    expectedPythonCount: 40,
    commands: liveClassroomStackCommands,
  }),
]);

function parseNode(text) {
  return [...String(text).matchAll(/^# tests\s+(\d+)$/gm)]
    .reduce((sum, match) => sum + Number(match[1]), 0);
}

function parseNodePassed(text) {
  return [...String(text).matchAll(/^# pass\s+(\d+)$/gm)]
    .reduce((sum, match) => sum + Number(match[1]), 0);
}

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
    && names.every((name) => !name.startsWith('supabase/migrations/'));
}

export function isSaasMilestoneRoadmapScope(files) {
  return isExactScope(files, SAAS_MILESTONE_ROADMAP_EXACT_FILES);
}

export function isMarketplaceRealPilotScope(files) {
  return isExactScope(files, MARKETPLACE_REAL_PILOT_EXACT_FILES);
}

export function isCourseVideoSharedMediaScope(files) {
  return isExactScope(files, COURSE_VIDEO_SHARED_MEDIA_EXACT_FILES);
}

export function isLiveClassroomStackScope(files) {
  return isExactScope(files, LIVE_CLASSROOM_STACK_EXACT_FILES);
}

function findProfile(files) {
  return PROFILES.find((profile) => isExactScope(files, profile.files));
}

function fixedInputContract(input, scope, profile) {
  return Number(input.expectedNodeCount) === profile.expectedNodeCount
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
  let nodeTests = 0;
  let nodePassed = 0;
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
      if (item.kind === 'node') {
        nodeTests += parseNode(output);
        nodePassed += parseNodePassed(output);
      }
      if (item.kind === 'python') pythonTests += parsePython(output);
      if (result.status === 0) passedStepCount += 1;
      else failedLabels.push(item.label);
    }
  } finally {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
  }

  const countsPassed = nodeTests === profile.expectedNodeCount
    && nodePassed === profile.expectedNodeCount
    && pythonTests === profile.expectedPythonCount;
  const ok = passedStepCount === profile.commands.length && countsPassed;
  const failure = failedLabels.length ? failedLabels.join(',') : 'count-contract';
  return {
    ok,
    status: ok ? 'PASS' : `FAIL:${failure}`,
    failedLabels: Object.freeze([...failedLabels]),
    stepCount: profile.commands.length,
    passedStepCount,
    nodeTests,
    nodePassed,
    nodeFailed: nodeTests - nodePassed,
    pythonTests,
    selectedSuite: profile.suite,
  };
}
