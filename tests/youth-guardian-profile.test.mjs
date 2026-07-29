import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  isYouthGuardianFiles,
  youthGuardianProfileCommands,
} from '../scripts/run-private-profile-stage5.mjs';

const ownedFiles = [
  'docs/architecture/trainingos-youth-safety-runtime-v1.md',
  'docs/testing/trainingos-youth-safety-runtime-v1-verification.md',
  'lib/trainingos-agent-gateway/youth-safety-runtime.mjs',
  'packages/training-youth-safety/package.json',
  'packages/training-youth-safety/src/index.mjs',
  'prototypes/trainingos-agent-mvp-v1/test/youth-safety-v1.test.mjs',
  'supabase/migrations/20260730090000_trainingos_youth_guardian_safety_v1_schema.sql',
  'supabase/migrations/20260730091000_trainingos_youth_guardian_safety_v1_rpc.sql',
  'supabase/migrations/20260730092000_trainingos_youth_guardian_safety_v1_acl.sql',
  'supabase/migrations/20260730093000_trainingos_youth_guardian_safety_v1_revocation_permission.sql',
  'tests/sql/trainingos_youth_guardian_safety_v1_e2e.sql',
  'tests/sql/trainingos_youth_guardian_safety_v1_e2e_runner.sql',
  'tests/test_trainingos_youth_guardian_safety_v1_contract.py',
];

test('Youth Guardian suite selects only the exact bounded private scope', () => {
  assert.equal(isYouthGuardianFiles(ownedFiles), true);
  assert.equal(isYouthGuardianFiles(ownedFiles.filter((name) => !name.includes('93000_'))), false);
  assert.equal(isYouthGuardianFiles([...ownedFiles, 'apps/training-web/src/RootApp.tsx']), false);
  assert.equal(isYouthGuardianFiles([...ownedFiles, 'packages/training-challenge-proof/src/index.mjs']), false);
  assert.equal(isYouthGuardianFiles(ownedFiles.map((name) => name.replace('20260730090000', '20260730100000'))), false);
});

test('Youth Guardian command map is fixed, reviewable, and complete', () => {
  assert.deepEqual(youthGuardianProfileCommands.map((item) => item.label), [
    'install',
    'syntax-package',
    'syntax-gateway',
    'node-contract',
    'python-contract',
    'typecheck',
    'production-build',
    'database-replay',
  ]);
  for (const item of youthGuardianProfileCommands) {
    assert.equal(typeof item.executable, 'string');
    assert.ok(Array.isArray(item.args));
    assert.equal(Object.hasOwn(item, 'shell'), false);
  }
  const rendered = JSON.stringify(youthGuardianProfileCommands);
  for (const marker of [
    'youth-safety-v1.test.mjs',
    'tests.test_trainingos_youth_guardian_safety_v1_contract',
    'run-youth-guardian-database.sh',
  ]) assert.match(rendered, new RegExp(marker.replaceAll('.', '\\.')));
});

test('Youth Guardian database gate is exact-head, replayed, transactional, and non-deploying', async () => {
  const scriptPath = 'scripts/run-youth-guardian-database.sh';
  const script = await readFile(scriptPath, 'utf8');
  assert.equal(spawnSync('bash', ['-n', scriptPath], { encoding: 'utf8' }).status, 0);
  for (const marker of [
    '20260730090000',
    '20260730095959',
    'trainingos_youth_guardian_safety_v1_e2e_runner.sql',
    'trainingos_youth_guardian_safety_v1_revocation_permission.sql',
    'migration up --local',
    'cleanup=PASS',
  ]) assert.ok(script.includes(marker), marker);
  assert.equal((script.match(/db reset --local --no-seed/g) || []).length, 2);
  assert.match(script, /merge-base/);
  assert.match(script, /PRIVATE_EXACT_SHA/);
  assert.doesNotMatch(script, /upload-artifact|supabase link|supabase db push|vercel|netlify|production database|\beval\b/i);
});

test('selected suite is publicly tagged without exposing private output', async () => {
  const stage7 = await readFile('scripts/run-private-profile-stage7.mjs', 'utf8');
  const entry = await readFile('scripts/run-private-profile.mjs', 'utf8');
  assert.match(stage7, /selectedSuite = 'youth-guardian'/);
  assert.match(entry, /selected_suite=/);
  assert.doesNotMatch(entry, /readFile\([^)]*private.*source|upload-artifact/i);
});
