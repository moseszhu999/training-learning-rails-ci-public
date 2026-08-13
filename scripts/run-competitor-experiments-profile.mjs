import { closeSync, openSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const EXPECTED_MIGRATION_COUNT = 378;

const command = (label, executable, args, kind = 'status') => Object.freeze({
  label,
  executable,
  args: Object.freeze(args),
  kind,
});

export const COMPETITOR_EXPERIMENT_PROFILES = Object.freeze([
  Object.freeze({
    id: 'assistance-aware-roleplay',
    expectedNodeCount: 9,
    exactFiles: Object.freeze(new Set([
      'docs/architecture/trainingos-assistance-aware-roleplay-benchmark-v1.md',
      'packages/training-roleplay-benchmark-core/package.json',
      'packages/training-roleplay-benchmark-core/src/index.mjs',
      'packages/training-roleplay-benchmark-core/test/roleplay-benchmark.test.mjs',
    ])),
    commands: Object.freeze([
      command('install', 'npm', ['ci']),
      command('roleplay-syntax', 'node', ['--check', 'packages/training-roleplay-benchmark-core/src/index.mjs']),
      command('focused-node-contracts', 'node', ['--test', 'packages/training-roleplay-benchmark-core/test/roleplay-benchmark.test.mjs'], 'node'),
      command('repository-typecheck', 'npm', ['run', 'typecheck']),
      command('direct-vite-production-build', 'npx', ['vite', 'build', '--config', 'vite.config.ts']),
      command('postbuild-copy', 'node', ['scripts/copy-trainingos-marketplace-web.mjs']),
      command('bundle-verification', 'npm', ['run', 'verify:build']),
    ]),
  }),
  Object.freeze({
    id: 'roleplay-experience',
    expectedNodeCount: 10,
    exactFiles: Object.freeze(new Set([
      'docs/product/previews/trainingos-roleplay-experience-v1.html',
      'docs/product/trainingos-roleplay-experience-v1.md',
      'packages/training-roleplay-experience-core/package.json',
      'packages/training-roleplay-experience-core/src/index.mjs',
      'packages/training-roleplay-experience-core/test/roleplay-experience.test.mjs',
    ])),
    commands: Object.freeze([
      command('install', 'npm', ['ci']),
      command('roleplay-experience-syntax', 'node', ['--check', 'packages/training-roleplay-experience-core/src/index.mjs']),
      command('focused-node-contracts', 'node', ['--test', 'packages/training-roleplay-experience-core/test/roleplay-experience.test.mjs'], 'node'),
      command('repository-typecheck', 'npm', ['run', 'typecheck']),
      command('direct-vite-production-build', 'npx', ['vite', 'build', '--config', 'vite.config.ts']),
      command('postbuild-copy', 'node', ['scripts/copy-trainingos-marketplace-web.mjs']),
      command('bundle-verification', 'npm', ['run', 'verify:build']),
    ]),
  }),
  Object.freeze({
    id: 'verified-skill-evidence',
    expectedNodeCount: 9,
    exactFiles: Object.freeze(new Set([
      'docs/architecture/trainingos-verified-skill-evidence-benchmark-v1.md',
      'packages/training-verified-skill-benchmark-core/package.json',
      'packages/training-verified-skill-benchmark-core/src/index.mjs',
      'packages/training-verified-skill-benchmark-core/test/verified-skill-benchmark.test.mjs',
    ])),
    commands: Object.freeze([
      command('install', 'npm', ['ci']),
      command('verified-skill-syntax', 'node', ['--check', 'packages/training-verified-skill-benchmark-core/src/index.mjs']),
      command('focused-node-contracts', 'node', ['--test', 'packages/training-verified-skill-benchmark-core/test/verified-skill-benchmark.test.mjs'], 'node'),
      command('repository-typecheck', 'npm', ['run', 'typecheck']),
      command('direct-vite-production-build', 'npx', ['vite', 'build', '--config', 'vite.config.ts']),
      command('postbuild-copy', 'node', ['scripts/copy-trainingos-marketplace-web.mjs']),
      command('bundle-verification', 'npm', ['run', 'verify:build']),
    ]),
  }),
  Object.freeze({
    id: 'expert-to-skill-ingestion',
    expectedNodeCount: 8,
    exactFiles: Object.freeze(new Set([
      'docs/architecture/trainingos-expert-to-skill-ingestion-benchmark-v1.md',
      'packages/training-expert-to-skill-benchmark-core/package.json',
      'packages/training-expert-to-skill-benchmark-core/src/index.mjs',
      'packages/training-expert-to-skill-benchmark-core/test/expert-to-skill-benchmark.test.mjs',
    ])),
    commands: Object.freeze([
      command('install', 'npm', ['ci']),
      command('expert-skill-syntax', 'node', ['--check', 'packages/training-expert-to-skill-benchmark-core/src/index.mjs']),
      command('focused-node-contracts', 'node', ['--test', 'packages/training-expert-to-skill-benchmark-core/test/expert-to-skill-benchmark.test.mjs'], 'node'),
      command('repository-typecheck', 'npm', ['run', 'typecheck']),
      command('direct-vite-production-build', 'npx', ['vite', 'build', '--config', 'vite.config.ts']),
      command('postbuild-copy', 'node', ['scripts/copy-trainingos-marketplace-web.mjs']),
      command('bundle-verification', 'npm', ['run', 'verify:build']),
    ]),
  }),
]);

const sumMatches = (text, regex) => [...String(text).matchAll(regex)]
  .reduce((sum, match) => sum + Number(match[1]), 0);

async function exactChangedFiles(input) {
  const scopePath = path.join(input.runnerTemp, 'trainingos-scope-contract.env');
  const scopeText = await readFile(scopePath, 'utf8');
  const scope = Object.fromEntries(scopeText.trim().split('\n').map((line) => {
    const index = line.indexOf('=');
    return [line.slice(0, index), line.slice(index + 1)];
  }));
  const result = spawnSync(
    'git',
    ['-C', input.privateRepoPath, 'diff', '--name-only', scope.expected_base_sha, input.privateExactSha],
    { encoding: 'utf8', shell: false },
  );
  if (result.status !== 0) throw new Error('git scope failed');
  return {
    files: result.stdout.trim() ? result.stdout.trim().split('\n').sort() : [],
    scope,
  };
}

export function resolveCompetitorExperimentProfile(files) {
  const names = [...files];
  if (names.some((name) => name.startsWith('supabase/migrations/'))) return null;
  return COMPETITOR_EXPERIMENT_PROFILES.find((profile) => (
    names.length === profile.exactFiles.size
    && names.every((name) => profile.exactFiles.has(name))
  )) ?? null;
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
    selectedSuite: `competitor-${profile.id}`,
  };
}

export async function maybeRunCompetitorExperimentsProfile(input) {
  if (input.profile !== 'generic-owned') return null;
  const scopePath = path.join(input.runnerTemp, 'trainingos-scope-contract.env');
  const { files, scope } = await exactChangedFiles(input);
  const selected = resolveCompetitorExperimentProfile(files);
  if (!selected) return null;

  const fixedInputs = Number(input.expectedNodeCount) === selected.expectedNodeCount
    && Number(input.expectedPythonCount) === 0
    && String(process.env.EXPECTED_MIGRATION_COUNT) === String(EXPECTED_MIGRATION_COUNT)
    && scope.expected_changed_file_count === String(selected.exactFiles.size)
    && scope.migration_start === 'none'
    && scope.migration_end === 'none';
  if (!fixedInputs) {
    await rm(scopePath, { force: true });
    return failedContractResult(selected);
  }

  let passedStepCount = 0;
  let nodeTests = 0;
  let nodePassed = 0;
  let nodeFailed = 0;
  const failedLabels = [];

  try {
    for (const [index, item] of selected.commands.entries()) {
      const logPath = path.join(input.runnerTemp, `trainingos-profile-${index + 1}.log`);
      const descriptor = openSync(logPath, 'w', 0o600);
      const commandResult = spawnSync(item.executable, item.args, {
        cwd: input.privateRepoPath,
        env: process.env,
        stdio: ['ignore', descriptor, descriptor],
        shell: false,
      });
      closeSync(descriptor);
      const output = await readFile(logPath, 'utf8');
      if (item.kind === 'node') {
        nodeTests += sumMatches(output, /^# tests\s+(\d+)$/gm);
        nodePassed += sumMatches(output, /^# pass\s+(\d+)$/gm);
        nodeFailed += sumMatches(output, /^# fail\s+(\d+)$/gm);
      }
      if (commandResult.status === 0) passedStepCount += 1;
      else failedLabels.push(item.label);
    }
  } finally {
    await rm(scopePath, { force: true });
  }

  const countsPassed = nodeTests === selected.expectedNodeCount
    && nodePassed === selected.expectedNodeCount
    && nodeFailed === 0;
  const stepCount = selected.commands.length;
  const ok = passedStepCount === stepCount && countsPassed;

  return {
    ok,
    status: ok ? 'PASS' : `FAIL:${failedLabels.length ? failedLabels.join(',') : 'count-contract'}`,
    failedLabels: Object.freeze([...failedLabels]),
    stepCount,
    passedStepCount,
    nodeTests,
    nodePassed,
    nodeFailed,
    pythonTests: 0,
    selectedSuite: `competitor-${selected.id}`,
  };
}
