import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  GROUP_WORK_ENTRY_ADAPTER_EXACT_FILES,
  groupWorkEntryAdapterCommands,
  isGroupWorkEntryAdapterScope,
} from '../scripts/run-group-work-entry-adapter-profile.mjs';

test('group Work Entry adapter selector accepts exactly the five private owner files', () => {
  assert.equal(GROUP_WORK_ENTRY_ADAPTER_EXACT_FILES.size, 5);
  assert.equal(isGroupWorkEntryAdapterScope(GROUP_WORK_ENTRY_ADAPTER_EXACT_FILES), true);
  assert.equal(isGroupWorkEntryAdapterScope([...GROUP_WORK_ENTRY_ADAPTER_EXACT_FILES, 'netlify.toml']), false);
  assert.equal(isGroupWorkEntryAdapterScope([...GROUP_WORK_ENTRY_ADAPTER_EXACT_FILES].slice(1)), false);
  const replaced = [...GROUP_WORK_ENTRY_ADAPTER_EXACT_FILES];
  replaced[0] = 'supabase/migrations/20260810999999_not_allowed.sql';
  assert.equal(isGroupWorkEntryAdapterScope(replaced), false);
});

test('group Work Entry adapter profile runs only fixed contract and repository build gates', () => {
  assert.deepEqual(groupWorkEntryAdapterCommands.map((item) => item.label), [
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
    groupWorkEntryAdapterCommands.find((item) => item.label === 'focused-node-contracts')?.args,
    ['--test', 'tests/training-group-work-entry-adapter-v1.test.mjs'],
  );
});

test('group Work Entry adapter profile locks exact counts and migration compatibility input', () => {
  const source = readFileSync(new URL('../scripts/run-group-work-entry-adapter-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    'const EXPECTED_CHANGED_FILE_COUNT = 5;',
    'const EXPECTED_NODE_COUNT = 9;',
    'const EXPECTED_PYTHON_COUNT = 0;',
    'const EXPECTED_MIGRATION_COUNT = 373;',
    "selectedSuite: 'group-work-entry-adapter'",
  ]) assert.equal(source.includes(token), true, token);
});

test('stage15 routes group Work Entry adapter profile before generic fallback', () => {
  const router = readFileSync(new URL('../scripts/run-private-profile-stage15.mjs', import.meta.url), 'utf8');
  assert.equal(router.includes("import { maybeRunGroupWorkEntryAdapterProfile } from './run-group-work-entry-adapter-profile.mjs';"), true);
  const credential = router.indexOf('maybeRunCapabilityCredentialCoreProfile(input)');
  const workEntry = router.indexOf('maybeRunGroupWorkEntryAdapterProfile(input)');
  const fallback = router.indexOf('runStage14Profile(input)');
  assert.ok(credential >= 0 && workEntry > credential && fallback > workEntry);
});

test('public group Work Entry adapter profile contains no network deploy database or arbitrary shell primitive', () => {
  const text = JSON.stringify(groupWorkEntryAdapterCommands).toLowerCase();
  for (const forbidden of [
    'curl', 'wget', 'ssh', 'scp', 'netlify deploy', 'vercel deploy', 'supabase db', 'psql',
    'playwright', 'payment', 'settlement', 'wallet', 'token movement', 'bash -c', 'sh -c',
  ]) assert.equal(text.includes(forbidden), false, forbidden);
});
