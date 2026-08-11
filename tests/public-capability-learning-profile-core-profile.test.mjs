import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CAPABILITY_LEARNING_PROFILE_CORE_EXACT_FILES,
  capabilityLearningProfileCoreCommands,
  isCapabilityLearningProfileCoreScope,
} from '../scripts/run-capability-learning-profile-core-profile.mjs';

test('Capability Learning Profile selector accepts exactly the five private owner files', () => {
  assert.equal(CAPABILITY_LEARNING_PROFILE_CORE_EXACT_FILES.size, 5);
  assert.equal(isCapabilityLearningProfileCoreScope(CAPABILITY_LEARNING_PROFILE_CORE_EXACT_FILES), true);
  assert.equal(isCapabilityLearningProfileCoreScope([...CAPABILITY_LEARNING_PROFILE_CORE_EXACT_FILES, 'netlify.toml']), false);
  assert.equal(isCapabilityLearningProfileCoreScope([...CAPABILITY_LEARNING_PROFILE_CORE_EXACT_FILES].slice(1)), false);
  const replaced = [...CAPABILITY_LEARNING_PROFILE_CORE_EXACT_FILES];
  replaced[0] = 'supabase/migrations/20260811999999_not_allowed.sql';
  assert.equal(isCapabilityLearningProfileCoreScope(replaced), false);
});

test('Capability Learning Profile runs only fixed contract and repository build gates', () => {
  assert.deepEqual(capabilityLearningProfileCoreCommands.map((item) => item.label), [
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
    capabilityLearningProfileCoreCommands.find((item) => item.label === 'focused-node-contracts')?.args,
    ['--test', 'tests/training-capability-learning-profile-v1.test.mjs'],
  );
});

test('Capability Learning Profile locks exact counts and compatibility input', () => {
  const source = readFileSync(new URL('../scripts/run-capability-learning-profile-core-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    'const EXPECTED_CHANGED_FILE_COUNT = 5;',
    'const EXPECTED_NODE_COUNT = 8;',
    'const EXPECTED_PYTHON_COUNT = 0;',
    'const EXPECTED_MIGRATION_COUNT = 378;',
    "selectedSuite: 'capability-learning-profile-core'",
  ]) assert.equal(source.includes(token), true, token);
});

test('stage15 routes Capability Learning Profile before generic fallback', () => {
  const router = readFileSync(new URL('../scripts/run-private-profile-stage15.mjs', import.meta.url), 'utf8');
  assert.equal(router.includes("import { maybeRunCapabilityLearningProfileCoreProfile } from './run-capability-learning-profile-core-profile.mjs';"), true);
  const credential = router.indexOf('maybeRunCapabilityCredentialCoreProfile(input)');
  const learning = router.indexOf('maybeRunCapabilityLearningProfileCoreProfile(input)');
  const fallback = router.indexOf('runStage14Profile(input)');
  assert.ok(credential >= 0 && learning > credential && fallback > learning);
});

test('public Capability Learning Profile contains no network deploy database or arbitrary shell primitive', () => {
  const text = JSON.stringify(capabilityLearningProfileCoreCommands).toLowerCase();
  for (const forbidden of [
    'curl', 'wget', 'ssh', 'scp', 'netlify deploy', 'vercel deploy', 'supabase db', 'psql',
    'playwright', 'payment', 'settlement', 'wallet', 'token movement', 'bash -c', 'sh -c',
  ]) assert.equal(text.includes(forbidden), false, forbidden);
});
