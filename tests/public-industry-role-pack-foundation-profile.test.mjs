import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  INDUSTRY_ROLE_PACK_EXACT_FILES,
  industryRolePackCommands,
  isIndustryRolePackScope,
} from '../scripts/run-industry-role-pack-foundation-profile.mjs';

test('selector accepts only the exact five role-pack files', () => {
  assert.equal(INDUSTRY_ROLE_PACK_EXACT_FILES.size, 5);
  assert.equal(isIndustryRolePackScope(INDUSTRY_ROLE_PACK_EXACT_FILES), true);
  assert.equal(isIndustryRolePackScope([...INDUSTRY_ROLE_PACK_EXACT_FILES, 'AGENTS.md']), false);
  assert.equal([...INDUSTRY_ROLE_PACK_EXACT_FILES].some((name) => name.startsWith('supabase/migrations/')), false);
});

test('profile runs eight bounded validation stages', () => {
  assert.deepEqual(industryRolePackCommands.map((item) => item.label), [
    'install', 'package-syntax', 'focused-node-contracts', 'focused-python-contracts',
    'typecheck', 'direct-vite-production-build', 'postbuild-copy', 'bundle-verification',
  ]);
  assert.deepEqual(industryRolePackCommands.find((item) => item.label === 'focused-node-contracts')?.args,
    ['--test', 'packages/training-industry-role-pack-core/test/role-pack-core.test.mjs']);
  assert.deepEqual(industryRolePackCommands.find((item) => item.label === 'focused-python-contracts')?.args,
    ['-m', 'unittest', '-v', 'tests.test_trainingos_industry_role_pack_foundation_v1']);
});

test('fixed counts and migration boundary stay locked', () => {
  const source = readFileSync(new URL('../scripts/run-industry-role-pack-foundation-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    'const EXPECTED_CHANGED_FILE_COUNT = 5;',
    'const EXPECTED_NODE_COUNT = 6;',
    'const EXPECTED_PYTHON_COUNT = 6;',
    'const EXPECTED_MIGRATION_COUNT = 369;',
    "selectedSuite: 'industry-role-pack-foundation'",
  ]) assert.equal(source.includes(token), true, token);
});

test('stage15 routes role pack before generic fallback', () => {
  const router = readFileSync(new URL('../scripts/run-private-profile-stage15.mjs', import.meta.url), 'utf8');
  assert.equal(router.includes("import { maybeRunIndustryRolePackFoundationProfile } from './run-industry-role-pack-foundation-profile.mjs';"), true);
  const rolePack = router.indexOf('maybeRunIndustryRolePackFoundationProfile(input)');
  const fallback = router.indexOf('runStage14Profile(input)');
  assert.ok(rolePack >= 0 && fallback > rolePack);
});

test('profile contains no external execution primitive', () => {
  const text = JSON.stringify(industryRolePackCommands).toLowerCase();
  for (const forbidden of ['curl', 'wget', 'ssh', 'netlify deploy', 'vercel deploy', 'supabase db', 'psql', 'playwright']) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
});
