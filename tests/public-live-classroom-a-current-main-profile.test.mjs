import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LIVE_CLASSROOM_A_CURRENT_MAIN_EXACT_FILES,
  liveClassroomACurrentMainCommands,
  isLiveClassroomACurrentMainScope,
} from '../scripts/run-live-classroom-a-current-main-profile.mjs';

test('current-main A selector accepts exactly seven owned files', () => {
  assert.equal(LIVE_CLASSROOM_A_CURRENT_MAIN_EXACT_FILES.size, 7);
  assert.equal(isLiveClassroomACurrentMainScope(LIVE_CLASSROOM_A_CURRENT_MAIN_EXACT_FILES), true);
  assert.equal(isLiveClassroomACurrentMainScope([...LIVE_CLASSROOM_A_CURRENT_MAIN_EXACT_FILES, 'netlify.toml']), false);
});

test('profile includes native prebuild and repository build lifecycle', () => {
  assert.deepEqual(liveClassroomACurrentMainCommands.map((item) => item.label), [
    'install',
    'focused-python-contracts',
    'native-classroom-prebuild-validation',
    'typecheck',
    'netlify-build-command',
    'bundle-verification',
  ]);
  const prebuild = liveClassroomACurrentMainCommands.find((item) => item.label === 'native-classroom-prebuild-validation');
  assert.deepEqual(prebuild?.args, ['scripts/run-trainingos-native-classroom-validation.mjs']);
  const build = liveClassroomACurrentMainCommands.find((item) => item.label === 'netlify-build-command');
  assert.deepEqual(build?.args, ['run', 'build']);
});

test('focused contract count stays A-only', () => {
  const python = liveClassroomACurrentMainCommands.find((item) => item.label === 'focused-python-contracts');
  assert.deepEqual(python?.args, [
    '-m', 'unittest', '-v',
    'tests.test_trainingos_live_classroom_contract_v1',
  ]);
  const source = readFileSync(new URL('../scripts/run-live-classroom-a-current-main-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    'const EXPECTED_CHANGED_FILE_COUNT = 7;',
    'const EXPECTED_NODE_COUNT = 0;',
    'const EXPECTED_PYTHON_COUNT = 9;',
    'const EXPECTED_MIGRATION_COUNT = 369;',
  ]) assert.equal(source.includes(token), true, token);
});

test('stage15 invokes current-main A before inherited generic fallback', () => {
  const router = readFileSync(new URL('../scripts/run-private-profile-stage15.mjs', import.meta.url), 'utf8');
  assert.equal(router.includes("import { maybeRunLiveClassroomACurrentMainProfile } from './run-live-classroom-a-current-main-profile.mjs';"), true);
  const currentA = router.indexOf('maybeRunLiveClassroomACurrentMainProfile(input)');
  const fallback = router.indexOf('runStage14Profile(input)');
  assert.ok(currentA >= 0 && fallback > currentA);
});
