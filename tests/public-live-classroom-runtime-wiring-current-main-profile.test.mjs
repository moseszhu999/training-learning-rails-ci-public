import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LIVE_CLASSROOM_RUNTIME_WIRING_CURRENT_MAIN_EXACT_FILES,
  liveClassroomRuntimeWiringCurrentMainCommands,
  isLiveClassroomRuntimeWiringCurrentMainScope,
} from '../scripts/run-live-classroom-runtime-wiring-current-main-profile.mjs';

test('selector accepts only the exact four F1 current-main files', () => {
  assert.equal(LIVE_CLASSROOM_RUNTIME_WIRING_CURRENT_MAIN_EXACT_FILES.size, 4);
  assert.equal(isLiveClassroomRuntimeWiringCurrentMainScope(LIVE_CLASSROOM_RUNTIME_WIRING_CURRENT_MAIN_EXACT_FILES), true);
  assert.equal(isLiveClassroomRuntimeWiringCurrentMainScope([...LIVE_CLASSROOM_RUNTIME_WIRING_CURRENT_MAIN_EXACT_FILES, 'netlify.toml']), false);
});

test('profile runs exact eight wiring/truth contracts plus build gates', () => {
  assert.deepEqual(liveClassroomRuntimeWiringCurrentMainCommands.map((item) => item.label), [
    'install', 'focused-python-contracts', 'typecheck',
    'direct-vite-production-build', 'postbuild-copy', 'bundle-verification',
  ]);
  assert.deepEqual(liveClassroomRuntimeWiringCurrentMainCommands.find((item) => item.label === 'focused-python-contracts')?.args,
    ['-m', 'unittest', '-v', 'tests.test_trainingos_live_classroom_runtime_wiring_v1']);
});

test('current-main F1 locks canonical migration metadata at 369', () => {
  const source = readFileSync(new URL('../scripts/run-live-classroom-runtime-wiring-current-main-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    'const EXPECTED_CHANGED_FILE_COUNT = 4;',
    'const EXPECTED_NODE_COUNT = 0;',
    'const EXPECTED_PYTHON_COUNT = 8;',
    'const EXPECTED_MIGRATION_COUNT = 369;',
    "selectedSuite: 'live-classroom-runtime-wiring-current-main'",
  ]) assert.equal(source.includes(token), true, token);
});

test('validation profile cannot execute provider, network, database, browser, or deploy actions', () => {
  const text = JSON.stringify(liveClassroomRuntimeWiringCurrentMainCommands).toLowerCase();
  for (const forbidden of ['curl', 'wget', 'ssh', 'tencent', 'createroom', 'loginuser', 'joinclass', 'playwright', 'netlify deploy', 'vercel deploy', 'supabase db', 'psql']) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
});
