import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ORGANIZATION_MEMBERSHIP_PERSISTENCE_EXACT_FILES,
  organizationMembershipPersistenceCommands,
  isOrganizationMembershipPersistenceScope,
} from '../scripts/run-organization-membership-persistence-profile.mjs';

test('persistence selector accepts exactly five private owner files', () => {
  assert.equal(ORGANIZATION_MEMBERSHIP_PERSISTENCE_EXACT_FILES.size, 5);
  assert.equal(ORGANIZATION_MEMBERSHIP_PERSISTENCE_EXACT_FILES.has('supabase/migrations/20260810051911_trainingos_organization_membership_private_helper_acl_hardening_v1.sql'), true);
  assert.equal(isOrganizationMembershipPersistenceScope(ORGANIZATION_MEMBERSHIP_PERSISTENCE_EXACT_FILES), true);
  assert.equal(isOrganizationMembershipPersistenceScope([...ORGANIZATION_MEMBERSHIP_PERSISTENCE_EXACT_FILES, 'netlify.toml']), false);
  assert.equal(isOrganizationMembershipPersistenceScope([...ORGANIZATION_MEMBERSHIP_PERSISTENCE_EXACT_FILES].slice(1)), false);
});

test('persistence profile runs focused contracts then repository build gates only', () => {
  assert.deepEqual(organizationMembershipPersistenceCommands.map((item) => item.label), [
    'install',
    'focused-node-contracts',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  assert.deepEqual(
    organizationMembershipPersistenceCommands.find((item) => item.label === 'focused-node-contracts')?.args,
    ['--test', 'tests/training-organization-membership-persistence-v1.test.mjs'],
  );
});

test('persistence profile locks generated migration range and fixed counts', () => {
  const source = readFileSync(new URL('../scripts/run-organization-membership-persistence-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    'const EXPECTED_CHANGED_FILE_COUNT = 5;',
    'const EXPECTED_NODE_COUNT = 8;',
    'const EXPECTED_PYTHON_COUNT = 0;',
    'const EXPECTED_MIGRATION_COUNT = 375;',
    "const EXPECTED_MIGRATION_START = '20260810004120';",
    "const EXPECTED_MIGRATION_END = '20260810051911';",
    'scope.migration_start === EXPECTED_MIGRATION_START',
    'scope.migration_end === EXPECTED_MIGRATION_END',
    "selectedSuite: 'organization-membership-persistence'",
  ]) assert.equal(source.includes(token), true, token);
});

test('stage15 routes persistence after contract core and before generic fallback', () => {
  const router = readFileSync(new URL('../scripts/run-private-profile-stage15.mjs', import.meta.url), 'utf8');
  assert.equal(router.includes("import { maybeRunOrganizationMembershipPersistenceProfile } from './run-organization-membership-persistence-profile.mjs';"), true);
  const core = router.indexOf('maybeRunOrganizationMembershipCoreProfile');
  const persistence = router.indexOf('maybeRunOrganizationMembershipPersistenceProfile');
  const fallback = router.indexOf('runStage14Profile(input)');
  assert.ok(core >= 0 && persistence > core && fallback > persistence);
});

test('public persistence profile contains no database deploy network or arbitrary shell primitive', () => {
  const text = JSON.stringify(organizationMembershipPersistenceCommands).toLowerCase();
  for (const forbidden of [
    'curl', 'wget', 'ssh', 'scp', 'netlify deploy', 'vercel deploy', 'supabase db', 'psql',
    'playwright', 'payment', 'settlement', 'wallet', 'token movement', 'bash -c', 'sh -c',
  ]) assert.equal(text.includes(forbidden), false, forbidden);
});
