import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  INDUSTRY_ROLE_PACK_REGISTRY_EXACT_FILES,
  industryRolePackRegistryCommands,
  isIndustryRolePackRegistryScope,
} from '../scripts/run-industry-role-pack-registry-profile.mjs';

test('registry selector accepts exactly the six private owner files', () => {
  assert.equal(INDUSTRY_ROLE_PACK_REGISTRY_EXACT_FILES.size, 6);
  assert.equal(isIndustryRolePackRegistryScope(INDUSTRY_ROLE_PACK_REGISTRY_EXACT_FILES), true);
  assert.equal(isIndustryRolePackRegistryScope([...INDUSTRY_ROLE_PACK_REGISTRY_EXACT_FILES, 'netlify.toml']), false);
  const missing = [...INDUSTRY_ROLE_PACK_REGISTRY_EXACT_FILES].slice(1);
  assert.equal(isIndustryRolePackRegistryScope(missing), false);
  const replaced = [...INDUSTRY_ROLE_PACK_REGISTRY_EXACT_FILES];
  replaced[0] = 'supabase/migrations/20260808999999_not_allowed.sql';
  assert.equal(isIndustryRolePackRegistryScope(replaced), false);
});

test('registry profile runs exact focused contracts and repository build gates', () => {
  assert.deepEqual(industryRolePackRegistryCommands.map((item) => item.label), [
    'install',
    'registry-syntax',
    'focused-node-contracts',
    'focused-python-contracts',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  assert.deepEqual(industryRolePackRegistryCommands.find((item) => item.label === 'focused-node-contracts')?.args,
    ['--test', 'packages/training-industry-role-pack-core/test/registry.test.mjs']);
  assert.deepEqual(industryRolePackRegistryCommands.find((item) => item.label === 'focused-python-contracts')?.args,
    ['-m', 'unittest', '-v', 'tests.test_trainingos_industry_role_pack_registry_v1']);
});

test('registry profile locks 6 files 9 node 8 python zero migration and 369 canonical migrations', () => {
  const source = readFileSync(new URL('../scripts/run-industry-role-pack-registry-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    'const EXPECTED_CHANGED_FILE_COUNT = 6;',
    'const EXPECTED_NODE_COUNT = 9;',
    'const EXPECTED_PYTHON_COUNT = 8;',
    'const EXPECTED_MIGRATION_COUNT = 369;',
    "selectedSuite: 'industry-role-pack-registry'",
  ]) assert.equal(source.includes(token), true, token);
});

test('stage15 routes registry selector before generic fallback', () => {
  const router = readFileSync(new URL('../scripts/run-private-profile-stage15.mjs', import.meta.url), 'utf8');
  assert.equal(router.includes("import { maybeRunIndustryRolePackRegistryProfile } from './run-industry-role-pack-registry-profile.mjs';"), true);
  const selector = router.indexOf('maybeRunIndustryRolePackRegistryProfile(input)');
  const fallback = router.indexOf('runStage14Profile(input)');
  assert.ok(selector >= 0 && fallback > selector);
});

test('public registry profile contains no deployment database provider or arbitrary shell primitive', () => {
  const text = JSON.stringify(industryRolePackRegistryCommands).toLowerCase();
  for (const forbidden of [
    'curl', 'wget', 'ssh', 'scp', 'netlify deploy', 'vercel deploy', 'supabase db', 'psql',
    'playwright', 'tencent', 'createroom', 'bash -c', 'sh -c',
  ]) assert.equal(text.includes(forbidden), false, forbidden);
});
