import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CAPABILITY_INITIATIVE_EXACT_FILES,
  capabilityInitiativeCommands,
  isCapabilityInitiativeScope,
} from '../scripts/run-capability-initiative-profile.mjs';

test('Capability Initiative selector accepts exactly the five private owner files', () => {
  assert.equal(CAPABILITY_INITIATIVE_EXACT_FILES.size, 5);
  assert.equal(isCapabilityInitiativeScope(CAPABILITY_INITIATIVE_EXACT_FILES), true);
  assert.equal(isCapabilityInitiativeScope([...CAPABILITY_INITIATIVE_EXACT_FILES, 'netlify.toml']), false);
  const missing = [...CAPABILITY_INITIATIVE_EXACT_FILES].slice(1);
  assert.equal(isCapabilityInitiativeScope(missing), false);
  const replaced = [...CAPABILITY_INITIATIVE_EXACT_FILES];
  replaced[0] = 'supabase/migrations/20260808999999_not_allowed.sql';
  assert.equal(isCapabilityInitiativeScope(replaced), false);
});

test('Capability Initiative profile runs exact contracts and repository build gates', () => {
  assert.deepEqual(capabilityInitiativeCommands.map((item) => item.label), [
    'install',
    'contract-syntax',
    'focused-node-contracts',
    'focused-python-contracts',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  assert.deepEqual(capabilityInitiativeCommands.find((item) => item.label === 'focused-node-contracts')?.args,
    ['--test', 'packages/training-industry-role-pack-core/test/capability-initiative.test.mjs']);
  assert.deepEqual(capabilityInitiativeCommands.find((item) => item.label === 'focused-python-contracts')?.args,
    ['-m', 'unittest', '-v', 'tests.test_trainingos_capability_initiative_v1']);
});

test('Capability Initiative profile locks 5 files 10 node 8 python and migration metadata 371', () => {
  const source = readFileSync(new URL('../scripts/run-capability-initiative-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    'const EXPECTED_CHANGED_FILE_COUNT = 5;',
    'const EXPECTED_NODE_COUNT = 10;',
    'const EXPECTED_PYTHON_COUNT = 8;',
    'const EXPECTED_MIGRATION_COUNT = 371;',
    "selectedSuite: 'capability-initiative'",
  ]) assert.equal(source.includes(token), true, token);
});

test('stage15 routes Capability Initiative after course canonicalization and before generic fallback', () => {
  const router = readFileSync(new URL('../scripts/run-private-profile-stage15.mjs', import.meta.url), 'utf8');
  assert.equal(router.includes("import { maybeRunCapabilityInitiativeProfile } from './run-capability-initiative-profile.mjs';"), true);
  const canonicalization = router.indexOf('maybeRunJavaCourseCanonicalizationProfile(input)');
  const capability = router.indexOf('maybeRunCapabilityInitiativeProfile(input)');
  const fallback = router.indexOf('runStage14Profile(input)');
  assert.ok(canonicalization >= 0 && capability > canonicalization && fallback > capability);
});

test('public Capability Initiative profile contains no deployment database provider or arbitrary shell primitive', () => {
  const text = JSON.stringify(capabilityInitiativeCommands).toLowerCase();
  for (const forbidden of [
    'curl', 'wget', 'ssh', 'scp', 'netlify deploy', 'vercel deploy', 'supabase db', 'psql',
    'playwright', 'tencent', 'createroom', 'bash -c', 'sh -c',
  ]) assert.equal(text.includes(forbidden), false, forbidden);
});
