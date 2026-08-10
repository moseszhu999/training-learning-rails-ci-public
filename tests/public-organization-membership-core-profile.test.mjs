import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ORGANIZATION_MEMBERSHIP_CORE_EXACT_FILES,
  organizationMembershipCoreCommands,
  isOrganizationMembershipCoreScope,
} from '../scripts/run-organization-membership-core-profile.mjs';

test('organization membership selector accepts exactly the five private owner files', () => {
  assert.equal(ORGANIZATION_MEMBERSHIP_CORE_EXACT_FILES.size, 5);
  assert.equal(isOrganizationMembershipCoreScope(ORGANIZATION_MEMBERSHIP_CORE_EXACT_FILES), true);
  assert.equal(isOrganizationMembershipCoreScope([...ORGANIZATION_MEMBERSHIP_CORE_EXACT_FILES, 'netlify.toml']), false);
  assert.equal(isOrganizationMembershipCoreScope([...ORGANIZATION_MEMBERSHIP_CORE_EXACT_FILES].slice(1)), false);
  const replaced = [...ORGANIZATION_MEMBERSHIP_CORE_EXACT_FILES];
  replaced[0] = 'supabase/migrations/20260810999999_not_allowed.sql';
  assert.equal(isOrganizationMembershipCoreScope(replaced), false);
});

test('organization membership profile runs only fixed contract and repository build gates', () => {
  assert.deepEqual(organizationMembershipCoreCommands.map((item) => item.label), [
    'install',
    'contract-syntax',
    'focused-node-contracts',
    'declaration-typecheck',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  assert.deepEqual(
    organizationMembershipCoreCommands.find((item) => item.label === 'focused-node-contracts')?.args,
    ['--test', 'tests/training-organization-membership-core-v1.test.mjs'],
  );
});

test('organization membership profile locks exact counts and migration compatibility input', () => {
  const source = readFileSync(new URL('../scripts/run-organization-membership-core-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    'const EXPECTED_CHANGED_FILE_COUNT = 5;',
    'const EXPECTED_NODE_COUNT = 8;',
    'const EXPECTED_PYTHON_COUNT = 0;',
    'const EXPECTED_MIGRATION_COUNT = 373;',
    "selectedSuite: 'organization-membership-core'",
  ]) assert.equal(source.includes(token), true, token);
});

test('stage15 routes organization membership profile before generic fallback', () => {
  const router = readFileSync(new URL('../scripts/run-private-profile-stage15.mjs', import.meta.url), 'utf8');
  assert.equal(router.includes("import { maybeRunOrganizationMembershipCoreProfile } from './run-organization-membership-core-profile.mjs';"), true);
  const workEntry = router.indexOf('maybeRunGroupWorkEntryAdapterProfile(input)');
  const organization = router.indexOf('maybeRunOrganizationMembershipCoreProfile(input)');
  const fallback = router.indexOf('runStage14Profile(input)');
  assert.ok(workEntry >= 0 && organization > workEntry && fallback > organization);
});

test('public organization membership profile contains no network deploy database or arbitrary shell primitive', () => {
  const text = JSON.stringify(organizationMembershipCoreCommands).toLowerCase();
  for (const forbidden of [
    'curl', 'wget', 'ssh', 'scp', 'netlify deploy', 'vercel deploy', 'supabase db', 'psql',
    'playwright', 'payment', 'settlement', 'wallet', 'token movement', 'bash -c', 'sh -c',
  ]) assert.equal(text.includes(forbidden), false, forbidden);
});
