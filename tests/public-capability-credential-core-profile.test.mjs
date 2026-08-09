import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CAPABILITY_CREDENTIAL_CORE_EXACT_FILES,
  capabilityCredentialCoreCommands,
  isCapabilityCredentialCoreScope,
} from '../scripts/run-capability-credential-core-profile.mjs';

test('CapabilityCredential selector accepts exactly the five private owner files', () => {
  assert.equal(CAPABILITY_CREDENTIAL_CORE_EXACT_FILES.size, 5);
  assert.equal(isCapabilityCredentialCoreScope(CAPABILITY_CREDENTIAL_CORE_EXACT_FILES), true);
  assert.equal(isCapabilityCredentialCoreScope([...CAPABILITY_CREDENTIAL_CORE_EXACT_FILES, 'netlify.toml']), false);
  assert.equal(isCapabilityCredentialCoreScope([...CAPABILITY_CREDENTIAL_CORE_EXACT_FILES].slice(1)), false);
  const replaced = [...CAPABILITY_CREDENTIAL_CORE_EXACT_FILES];
  replaced[0] = 'supabase/migrations/20260809999999_not_allowed.sql';
  assert.equal(isCapabilityCredentialCoreScope(replaced), false);
});

test('CapabilityCredential profile runs only fixed contract and repository build gates', () => {
  assert.deepEqual(capabilityCredentialCoreCommands.map((item) => item.label), [
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
    capabilityCredentialCoreCommands.find((item) => item.label === 'focused-node-contracts')?.args,
    ['--test', 'tests/training-capability-credential-core-v1.test.mjs'],
  );
});

test('CapabilityCredential profile locks exact counts and compatibility input', () => {
  const source = readFileSync(new URL('../scripts/run-capability-credential-core-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    'const EXPECTED_CHANGED_FILE_COUNT = 5;',
    'const EXPECTED_NODE_COUNT = 11;',
    'const EXPECTED_PYTHON_COUNT = 0;',
    'const EXPECTED_MIGRATION_COUNT = 368;',
    "selectedSuite: 'capability-credential-core'",
  ]) assert.equal(source.includes(token), true, token);
});

test('stage15 routes CapabilityCredential profile before generic fallback', () => {
  const router = readFileSync(new URL('../scripts/run-private-profile-stage15.mjs', import.meta.url), 'utf8');
  assert.equal(router.includes("import { maybeRunCapabilityCredentialCoreProfile } from './run-capability-credential-core-profile.mjs';"), true);
  const initiative = router.indexOf('maybeRunCapabilityInitiativeProfile(input)');
  const credential = router.indexOf('maybeRunCapabilityCredentialCoreProfile(input)');
  const fallback = router.indexOf('runStage14Profile(input)');
  assert.ok(initiative >= 0 && credential > initiative && fallback > credential);
});

test('public CapabilityCredential profile contains no network deploy database or arbitrary shell primitive', () => {
  const text = JSON.stringify(capabilityCredentialCoreCommands).toLowerCase();
  for (const forbidden of [
    'curl', 'wget', 'ssh', 'scp', 'netlify deploy', 'vercel deploy', 'supabase db', 'psql',
    'playwright', 'payment', 'settlement', 'wallet', 'token movement', 'bash -c', 'sh -c',
  ]) assert.equal(text.includes(forbidden), false, forbidden);
});
