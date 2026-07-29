import { mkdir, readFile, rm } from 'node:fs/promises';
import { closeSync, openSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { databaseFailureLabel } from './run-private-profile-stage2.mjs';
import {
  formatProfileStatus,
  profileCommands,
  runProfile as runStage7Profile,
} from './run-private-profile-stage7.mjs';

const publicRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const command = (label, executable, args, kind = 'status') => Object.freeze({
  label,
  executable,
  args: Object.freeze(args),
  kind,
});

export const educationPartnerSupplyProfileCommands = Object.freeze([
  command('install', 'npm', ['ci']),
  command('syntax-package', 'node', ['--check', 'packages/training-education-partner-supply/src/index.mjs']),
  command('syntax-gateway', 'node', ['--check', 'lib/trainingos-agent-gateway/education-partner-supply-runtime.mjs']),
  command('node-contract', 'node', [
    '--test',
    'prototypes/trainingos-agent-mvp-v1/test/education-partner-supply-v1.test.mjs',
  ], 'node'),
  command('python-contract', 'python', [
    '-m',
    'unittest',
    '-v',
    'tests.test_trainingos_education_partner_supply_v1_contract',
  ], 'python'),
  command('typecheck', 'npm', ['run', 'typecheck']),
  command('production-build', 'npx', ['vite', 'build', '--config', 'vite.config.ts']),
  command('database-replay', 'bash', [path.join(publicRoot, 'scripts/run-education-partner-supply-database.sh')]),
]);

const EDUCATION_PARTNER_SUPPLY_EXACT_FILES = new Set([
  'docs/architecture/trainingos-education-partner-supply-rights-runtime-v1.md',
  'docs/testing/trainingos-education-partner-supply-validation-v1.md',
  'lib/trainingos-agent-gateway/education-partner-supply-runtime.mjs',
  'packages/training-education-partner-supply/package.json',
  'packages/training-education-partner-supply/src/index.mjs',
  'prototypes/trainingos-agent-mvp-v1/test/education-partner-supply-v1.test.mjs',
  'tests/sql/trainingos_education_partner_supply_v1_e2e.sql',
  'tests/sql/trainingos_education_partner_supply_v1_e2e_runner.sql',
  'tests/test_trainingos_education_partner_supply_v1_contract.py',
]);

const EDUCATION_PARTNER_SUPPLY_MIGRATION = /^supabase\/migrations\/2026073010[0-5][0-9][0-5][0-9]_trainingos_education_partner_supply_[a-z0-9_]+_v1\.sql$/;

const EDUCATION_DATABASE_REASON_ALLOWLIST = new Set([
  'assertion-agent-review',
  'assertion-self-review',
  'assertion-public-display',
  'assertion-revoked-use',
  'assertion-raw-table',
  'assertion-history',
  'assertion-validation',
  'assertion',
  'commercial-plan',
  'account-binding',
  'partner-operator',
  'self-review',
  'material-approval',
  'target-owner',
  'target-account',
  'public-display',
  'rights-feature',
  'rights-routine',
  'rights-external',
  'rights-schema',
  'rights-check-option',
  'rights-resource',
  'rights-operator',
  'rights-system',
  'rights-other',
  'rights',
  'usage',
  'review',
  'source',
  'agreement',
  'partner',
  'assessment-fixture',
  'not-null',
  'foreign-key',
  'duplicate',
  'undefined-column',
  'undefined-relation',
  'sql-syntax',
  'unclassified',
]);

export function educationDatabaseFailureLabel(text) {
  const base = databaseFailureLabel(text);
  const reason = String(text).match(
    /CHALLENGE_DATABASE status=FAIL stage=[a-z0-9-]+ reason=([a-z0-9-]+)/,
  )?.[1] ?? '';
  return EDUCATION_DATABASE_REASON_ALLOWLIST.has(reason)
    ? `${base}-${reason}`
    : base;
}

export function isEducationPartnerSupplyFiles(files) {
  const names = [...files];
  if (!names.length) return false;
  const migrations = names.filter((name) => name.startsWith('supabase/migrations/'));
  const allOwned = names.every((name) => (
    EDUCATION_PARTNER_SUPPLY_EXACT_FILES.has(name)
      || EDUCATION_PARTNER_SUPPLY_MIGRATION.test(name)
  ));
  return allOwned
    && names.includes('packages/training-education-partner-supply/src/index.mjs')
    && names.includes('tests/test_trainingos_education_partner_supply_v1_contract.py')
    && names.includes('tests/sql/trainingos_education_partner_supply_v1_e2e_runner.sql')
    && migrations.length === 5;
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
  commands,
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
    for (const [index, item] of commands.entries()) {
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
        failedLabels.push(educationDatabaseFailureLabel(text));
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
  const ok = passedSteps === commands.length && countsPassed;
  return {
    ok,
    status: formatProfileStatus({ ok, failedLabels, countsPassed }),
    failedLabels: Object.freeze([...failedLabels]),
    stepCount: commands.length,
    passedStepCount: passedSteps,
    nodeTests,
    nodePassed,
    nodeFailed,
    pythonTests,
    selectedSuite: 'education-partner-supply',
  };
}

export async function runProfile(input) {
  if (input.profile === 'generic-owned') {
    const files = await changedFiles(input);
    if (isEducationPartnerSupplyFiles(files)) {
      return runFixedProfile({
        ...input,
        commands: educationPartnerSupplyProfileCommands,
      });
    }
  }
  return runStage7Profile(input);
}

export { formatProfileStatus, profileCommands };
