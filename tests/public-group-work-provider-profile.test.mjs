import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  GROUP_WORK_PROVIDER_EXACT_FILES,
  groupWorkProviderCommands,
  isGroupWorkProviderScope,
} from '../scripts/run-group-work-provider-profile.mjs';

test('Group Work provider selector accepts exactly the 14 private owner files', () => {
  assert.equal(GROUP_WORK_PROVIDER_EXACT_FILES.size, 14);
  assert.equal(isGroupWorkProviderScope(GROUP_WORK_PROVIDER_EXACT_FILES), true);
  assert.equal(isGroupWorkProviderScope([...GROUP_WORK_PROVIDER_EXACT_FILES].slice(1)), false);
  assert.equal(isGroupWorkProviderScope([...GROUP_WORK_PROVIDER_EXACT_FILES, 'supabase/migrations/not-allowed.sql']), false);
  assert.equal([...GROUP_WORK_PROVIDER_EXACT_FILES].filter((name) => name.startsWith('supabase/migrations/')).length, 0);
});

test('Group Work provider profile runs bounded local contracts and compatibility build only', () => {
  assert.deepEqual(groupWorkProviderCommands.map((item) => item.label), [
    'install',
    'function-module-load',
    'legacy-provider-core-contracts',
    'work-entry-adapter-contracts',
    'focused-node-truth-gates',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  assert.deepEqual(
    groupWorkProviderCommands.find((item) => item.label === 'focused-node-truth-gates')?.args,
    [
      '--test',
      'tests/training-group-work-provider-verified-v1.test.mjs',
      'tests/trainingos-group-work-provider-http-v1.test.mjs',
    ],
  );
});

test('Group Work provider profile locks current scope and zero migration delta', () => {
  const source = readFileSync(new URL('../scripts/run-group-work-provider-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    'const EXPECTED_CHANGED_FILE_COUNT = 14;',
    'const EXPECTED_NODE_COUNT = 19;',
    'const EXPECTED_PYTHON_COUNT = 0;',
    'const EXPECTED_MIGRATION_COUNT = 378;',
    "scope.migration_start === 'none'",
    "scope.migration_end === 'none'",
    "selectedSuite: 'group-work-provider'",
  ]) assert.equal(source.includes(token), true, token);
});

test('stage15 routes Group Work provider before generic fallback', () => {
  const router = readFileSync(new URL('../scripts/run-private-profile-stage15.mjs', import.meta.url), 'utf8');
  assert.equal(router.includes("import { maybeRunGroupWorkProviderProfile } from './run-group-work-provider-profile.mjs';"), true);
  const provider = router.indexOf('maybeRunGroupWorkProviderProfile');
  const fallback = router.indexOf('runStage14Profile(input)');
  assert.ok(provider >= 0 && fallback > provider);
});

test('public Group Work provider profile performs no DB, deploy, browser, network or arbitrary shell action', () => {
  const text = JSON.stringify(groupWorkProviderCommands).toLowerCase();
  for (const forbidden of [
    'playwright', 'curl', 'wget', 'ssh', 'scp', 'netlify deploy', 'vercel deploy',
    'supabase db', 'psql', 'database_url', 'bash -c', 'sh -c', 'payment', 'settlement', 'wallet',
  ]) assert.equal(text.includes(forbidden), false, forbidden);
});
