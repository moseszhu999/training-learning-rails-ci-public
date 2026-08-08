import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LIVE_CLASSROOM_TENCENT_PROVIDER_EXACT_FILES,
  liveClassroomTencentProviderCommands,
  isLiveClassroomTencentProviderScope,
} from '../scripts/run-live-classroom-tencent-provider-current-main-profile.mjs';

test('selector accepts exact four-file current-main provider scope', () => {
  assert.equal(LIVE_CLASSROOM_TENCENT_PROVIDER_EXACT_FILES.size, 4);
  assert.equal(isLiveClassroomTencentProviderScope(LIVE_CLASSROOM_TENCENT_PROVIDER_EXACT_FILES), true);
  assert.equal(isLiveClassroomTencentProviderScope([...LIVE_CLASSROOM_TENCENT_PROVIDER_EXACT_FILES, 'apps/training-web/src/lib/trainingos-live-classroom-contract.ts']), false);
  assert.equal([...LIVE_CLASSROOM_TENCENT_PROVIDER_EXACT_FILES].some((name) => name.startsWith('supabase/migrations/')), false);
});

test('profile uses bounded no-network validation stages', () => {
  assert.deepEqual(liveClassroomTencentProviderCommands.map((item) => item.label), [
    'install', 'focused-python-contracts', 'typecheck',
    'direct-vite-production-build', 'postbuild-copy', 'bundle-verification',
  ]);
  assert.deepEqual(liveClassroomTencentProviderCommands.find((item) => item.label === 'focused-python-contracts')?.args,
    ['-m', 'unittest', '-v', 'tests.test_trainingos_live_classroom_tencent_provider_v1']);
});

test('fixed current-main counts stay locked', () => {
  const source = readFileSync(new URL('../scripts/run-live-classroom-tencent-provider-current-main-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    'const EXPECTED_CHANGED_FILE_COUNT = 4;',
    'const EXPECTED_NODE_COUNT = 0;',
    'const EXPECTED_PYTHON_COUNT = 8;',
    'const EXPECTED_MIGRATION_COUNT = 369;',
    "selectedSuite: 'live-classroom-tencent-provider-current-main'",
  ]) assert.equal(source.includes(token), true, token);
});

test('stage15 routes provider profile before generic fallback', () => {
  const router = readFileSync(new URL('../scripts/run-private-profile-stage15.mjs', import.meta.url), 'utf8');
  assert.equal(router.includes("import { maybeRunLiveClassroomTencentProviderCurrentMainProfile } from './run-live-classroom-tencent-provider-current-main-profile.mjs';"), true);
  const provider = router.indexOf('maybeRunLiveClassroomTencentProviderCurrentMainProfile(input)');
  const fallback = router.indexOf('runStage14Profile(input)');
  assert.ok(provider >= 0 && fallback > provider);
});

test('profile cannot execute provider/network/deploy actions', () => {
  const text = JSON.stringify(liveClassroomTencentProviderCommands).toLowerCase();
  for (const forbidden of ['curl', 'wget', 'ssh', 'tencent', 'createroom', 'joinclass', 'netlify deploy', 'vercel deploy', 'supabase db', 'psql', 'playwright']) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
});
