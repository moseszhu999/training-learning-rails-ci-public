import { closeSync, openSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const SKILL_LIBRARY_SEED_EXACT_FILES = new Set([
  'data/trainingos-skill-library/pilots/ai-video-formal-learning-readiness-v0.1.json',
  'data/trainingos-skill-library/pilots/ai-video-production-pilot-v0.1.json',
  'data/trainingos-skill-library/seed-skills-v0.1.json',
  'docs/product/previews/trainingos-ai-video-production-pilot-v1.html',
  'docs/product/previews/trainingos-skill-library-system-map-v1.html',
  'docs/product/trainingos-ai-video-production-end-to-end-pilot-v1.md',
  'docs/product/trainingos-skill-library-platform-integration-ux-v1.md',
  'docs/product/trainingos-skill-library-tutorial-ingestion-v1.md',
]);

const EXPECTED_CHANGED_FILE_COUNT = 8;
const EXPECTED_NODE_COUNT = 0;
const EXPECTED_PYTHON_COUNT = 0;
const EXPECTED_MIGRATION_COUNT = 378;

const command = (label, executable, args) => Object.freeze({
  label,
  executable,
  args: Object.freeze(args),
});

const jsonValidationProgram = [
  'const fs=require("node:fs");',
  'for (const p of process.argv.slice(1)) JSON.parse(fs.readFileSync(p,"utf8"));',
].join('');

export const skillLibrarySeedCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('seed-json-parse', 'node', ['-e', jsonValidationProgram,
    'data/trainingos-skill-library/pilots/ai-video-formal-learning-readiness-v0.1.json',
    'data/trainingos-skill-library/pilots/ai-video-production-pilot-v0.1.json',
    'data/trainingos-skill-library/seed-skills-v0.1.json',
  ]),
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

export function isSkillLibrarySeedScope(files) {
  const names = [...files];
  return names.length === SKILL_LIBRARY_SEED_EXACT_FILES.size
    && names.every((name) => SKILL_LIBRARY_SEED_EXACT_FILES.has(name))
    && names.every((name) => !name.startsWith('supabase/migrations/'));
}

function failedContractResult() {
  return {
    ok: false,
    status: 'FAIL:fixed-input-contract',
    failedLabels: Object.freeze(['fixed-input-contract']),
    stepCount: skillLibrarySeedCommands.length,
    passedStepCount: 0,
    nodeTests: 0,
    nodePassed: 0,
    nodeFailed: 0,
    pythonTests: 0,
    selectedSuite: 'skill-library-seed',
  };
}

export async function maybeRunSkillLibrarySeedProfile(input) {
  if (input.profile !== 'generic-owned') return null;
  const { files, scope } = await exactChangedFiles(input);
  if (!isSkillLibrarySeedScope(files)) return null;

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
    for (const [index, item] of skillLibrarySeedCommands.entries()) {
      const logPath = path.join(input.runnerTemp, `trainingos-profile-${index + 1}.log`);
      const descriptor = openSync(logPath, 'w', 0o600);
      const commandResult = spawnSync(item.executable, item.args, {
        cwd: input.privateRepoPath,
        env: process.env,
        stdio: ['ignore', descriptor, descriptor],
        shell: false,
      });
      closeSync(descriptor);
      if (commandResult.status === 0) passedStepCount += 1;
      else failedLabels.push(item.label);
    }
  } finally {
    await rm(path.join(input.runnerTemp, 'trainingos-scope-contract.env'), { force: true });
  }

  const stepCount = skillLibrarySeedCommands.length;
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
    selectedSuite: 'skill-library-seed',
  };
}
