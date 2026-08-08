import { closeSync, openSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const CANONICAL_NORTH_STAR_EXACT_FILES = new Set([
  'AGENTS.md',
  'CLAUDE.md',
  'docs/product/trainingos-north-star.md',
]);

const EXPECTED_CHANGED_FILE_COUNT = 3;
const EXPECTED_NODE_COUNT = 0;
const EXPECTED_PYTHON_COUNT = 0;
const EXPECTED_MIGRATION_COUNT = 369;

const canonicalContextCheck = String.raw`
const fs = require('node:fs');
const target = 'docs/product/trainingos-north-star.md';
const agents = fs.readFileSync('AGENTS.md', 'utf8');
const claude = fs.readFileSync('CLAUDE.md', 'utf8');
const north = fs.readFileSync(target, 'utf8');
const required = [
  north.includes('# TrainingOS Product North Star'),
  north.includes('AI-agent-native education operating environment'),
  north.includes('Marketplace capability'),
  north.includes('human gate'),
  north.includes('Live Classroom'),
  agents.includes(target),
  claude.includes(target),
  !agents.includes('trainingos-project-guardrails-v1.md'),
  !claude.includes('trainingos-project-guardrails-v1.md'),
];
if (required.some((value) => !value)) process.exit(2);
`;

const command = (label, executable, args) => Object.freeze({ label, executable, args: Object.freeze(args), kind: 'status' });

export const canonicalNorthStarCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('canonical-context-contract', 'node', ['-e', canonicalContextCheck]),
  command('typecheck', 'npm', ['run', 'typecheck']),
  command('direct-vite-production-build', 'npx', ['vite', 'build', '--config', 'vite.config.ts']),
  command('postbuild-copy', 'node', ['scripts/copy-trainingos-marketplace-web.mjs']),
  command('bundle-verification', 'npm', ['run', 'verify:build']),
]);

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

export function isCanonicalNorthStarScope(files) {
  const names = [...files];
  return names.length === CANONICAL_NORTH_STAR_EXACT_FILES.size
    && names.every((name) => CANONICAL_NORTH_STAR_EXACT_FILES.has(name))
    && names.every((name) => !name.startsWith('supabase/migrations/'));
}

function failedContractResult() {
  return {
    ok: false,
    status: 'FAIL:fixed-input-contract',
    failedLabels: Object.freeze(['fixed-input-contract']),
    stepCount: canonicalNorthStarCommands.length,
    passedStepCount: 0,
    nodeTests: 0,
    nodePassed: 0,
    nodeFailed: 0,
    pythonTests: 0,
    selectedSuite: 'canonical-north-star-current-main',
  };
}

export async function maybeRunCanonicalNorthStarCurrentMainProfile(input) {
  if (input.profile !== 'generic-owned') return null;
  const { files, scope } = await exactChangedFiles(input);
  if (!isCanonicalNorthStarScope(files)) return null;

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
  const failedLabels = [];
  try {
    for (const [index, item] of canonicalNorthStarCommands.entries()) {
      const logPath = path.join(input.runnerTemp, `trainingos-profile-${index + 1}.log`);
      const descriptor = openSync(logPath, 'w', 0o600);
      const result = spawnSync(item.executable, item.args, {
        cwd: input.privateRepoPath,
        env: process.env,
        stdio: ['ignore', descriptor, descriptor],
        shell: false,
      });
      closeSync(descriptor);
      if (result.status === 0) passedStepCount += 1;
      else failedLabels.push(item.label);
    }
  } finally {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
  }

  const stepCount = canonicalNorthStarCommands.length;
  const ok = passedStepCount === stepCount;
  return {
    ok,
    status: ok ? 'PASS' : `FAIL:${failedLabels.length ? failedLabels.join(',') : 'count-contract'}`,
    failedLabels: Object.freeze([...failedLabels]),
    stepCount,
    passedStepCount,
    nodeTests: 0,
    nodePassed: 0,
    nodeFailed: 0,
    pythonTests: 0,
    selectedSuite: 'canonical-north-star-current-main',
  };
}
