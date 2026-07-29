import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  educationPartnerSupplyProfileCommands,
  isEducationPartnerSupplyFiles,
} from '../scripts/run-private-profile-stage8.mjs';

const ownedFiles = [
  'docs/architecture/trainingos-education-partner-supply-rights-runtime-v1.md',
  'docs/testing/trainingos-education-partner-supply-validation-v1.md',
  'lib/trainingos-agent-gateway/education-partner-supply-runtime.mjs',
  'packages/training-education-partner-supply/package.json',
  'packages/training-education-partner-supply/src/index.mjs',
  'prototypes/trainingos-agent-mvp-v1/test/education-partner-supply-v1.test.mjs',
  'supabase/migrations/20260730100000_trainingos_education_partner_supply_schema_v1.sql',
  'supabase/migrations/20260730101000_trainingos_education_partner_supply_private_helpers_v1.sql',
  'supabase/migrations/20260730102000_trainingos_education_partner_supply_authoring_review_rpc_v1.sql',
  'supabase/migrations/20260730103000_trainingos_education_partner_supply_rights_usage_rpc_v1.sql',
  'supabase/migrations/20260730105000_trainingos_education_partner_supply_acl_immutability_v1.sql',
  'tests/sql/trainingos_education_partner_supply_v1_e2e.sql',
  'tests/sql/trainingos_education_partner_supply_v1_e2e_runner.sql',
  'tests/test_trainingos_education_partner_supply_v1_contract.py',
];

test('Education Partner Supply suite selects only the exact bounded private scope', () => {
  assert.equal(isEducationPartnerSupplyFiles(ownedFiles), true);
  assert.equal(isEducationPartnerSupplyFiles(ownedFiles.filter((name) => !name.includes('105000_'))), false);
  assert.equal(isEducationPartnerSupplyFiles([...ownedFiles, 'apps/training-web/src/RootApp.tsx']), false);
  assert.equal(isEducationPartnerSupplyFiles([...ownedFiles, 'packages/training-education-ecosystem/src/index.mjs']), false);
  assert.equal(isEducationPartnerSupplyFiles([...ownedFiles, 'packages/training-challenge/src/runtime.mjs']), false);
  assert.equal(isEducationPartnerSupplyFiles(ownedFiles.map((name) => name.replace('20260730100000', '20260730090000'))), false);
  assert.equal(isEducationPartnerSupplyFiles(ownedFiles.map((name) => name.replace('20260730100000', '2026073010000'))), false);
  assert.equal(isEducationPartnerSupplyFiles(ownedFiles.map((name) => name.replace('20260730100000', '20260730106000'))), false);
});

test('Education Partner Supply command map is fixed, reviewable, and complete', () => {
  assert.deepEqual(educationPartnerSupplyProfileCommands.map((item) => item.label), [
    'install',
    'syntax-package',
    'syntax-gateway',
    'node-contract',
    'python-contract',
    'typecheck',
    'production-build',
    'database-replay',
  ]);
  for (const item of educationPartnerSupplyProfileCommands) {
    assert.equal(typeof item.executable, 'string');
    assert.ok(Array.isArray(item.args));
    assert.equal(Object.hasOwn(item, 'shell'), false);
  }
  const rendered = JSON.stringify(educationPartnerSupplyProfileCommands);
  for (const marker of [
    'education-partner-supply-v1.test.mjs',
    'tests.test_trainingos_education_partner_supply_v1_contract',
    'run-education-partner-supply-database.sh',
  ]) assert.match(rendered, new RegExp(marker.replaceAll('.', '\\.')));
});

test('Education Partner Supply database gate is exact-head, replayed, transactional, and non-deploying', async () => {
  const scriptPath = 'scripts/run-education-partner-supply-database.sh';
  const script = await readFile(scriptPath, 'utf8');
  assert.equal(spawnSync('bash', ['-n', scriptPath], { encoding: 'utf8' }).status, 0);
  for (const marker of [
    '20260730100000',
    '20260730105959',
    'trainingos_education_partner_supply_v1_e2e_runner.sql',
    'trainingos_education_partner_supply_acl_immutability_v1.sql',
    'migration up --local',
    'cleanup=PASS',
    'npx --yes supabase@latest',
  ]) assert.ok(script.includes(marker), marker);
  assert.equal((script.match(/db reset --local --no-seed/g) || []).length, 2);
  assert.match(script, /2026073010\[0-5\]\[0-9\]\[0-5\]\[0-9\]/);
  assert.match(script, /merge-base/);
  assert.match(script, /PRIVATE_EXACT_SHA/);
  assert.doesNotMatch(script, /upload-artifact|supabase link|supabase db push|vercel|netlify|production database|\beval\b/i);
});

test('entrypoint delegates through stage8 and selected suite stays sanitized', async () => {
  const entry = await readFile('scripts/run-private-profile.mjs', 'utf8');
  const stage8 = await readFile('scripts/run-private-profile-stage8.mjs', 'utf8');
  assert.match(entry, /run-private-profile-stage8\.mjs/);
  assert.doesNotMatch(entry, /runBaseProfile.*stage7/);
  assert.match(stage8, /selectedSuite: 'education-partner-supply'/);
  assert.match(entry, /selected_suite=/);
  assert.doesNotMatch(entry, /readFile\([^)]*private.*source|upload-artifact/i);
});
