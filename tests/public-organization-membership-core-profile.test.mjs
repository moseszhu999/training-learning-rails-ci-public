import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ORGANIZATION_MEMBERSHIP_CORE_EXACT_FILES,
  ORGANIZATION_MEMBERSHIP_CORE_NODE_CASES,
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

test('organization membership profile isolates eight fixed private contract cases', () => {
  assert.equal(ORGANIZATION_MEMBERSHIP_CORE_NODE_CASES.length, 8);
  assert.deepEqual(ORGANIZATION_MEMBERSHIP_CORE_NODE_CASES.map((item) => item.label), [
    'node-case-01-organization',
    'node-case-02-membership-boundary',
    'node-case-03-lifecycle',
    'node-case-04-class-rejection',
    'node-case-05-private-ref-rejection',
    'node-case-06-shape-role-rejection',
    'node-case-07-validity-evidence-rejection',
    'node-case-08-status-boundary',
  ]);
  for (const item of ORGANIZATION_MEMBERSHIP_CORE_NODE_CASES) {
    const command = organizationMembershipCoreCommands.find((entry) => entry.label === item.label);
    assert.equal(command?.executable, 'node');
    assert.equal(command?.kind, 'node-case');
    assert.equal(command?.args[0], '--test');
    assert.equal(command?.args.at(-1), 'tests/training-organization-membership-core-v1.test.mjs');
  }
});

test('organization membership profile retains fixed build and type gates around isolated tests', () => {
  const labels = organizationMembershipCoreCommands.map((item) => item.label);
  assert.equal(labels[0], 'install');
  assert.equal(labels[1], 'contract-syntax');
  assert.equal(labels.includes('declaration-typecheck'), true);
  assert.equal(labels.includes('typecheck'), true);
  assert.equal(labels.includes('direct-vite-production-build'), true);
  assert.equal(labels.includes('postbuild-copy'), true);
  assert.equal(labels.at(-1), 'bundle-verification');
  assert.equal(labels.length, 15);
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
