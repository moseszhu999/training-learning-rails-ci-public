import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LIVE_CLASSROOM_STACK_EXACT_FILES,
  liveClassroomStackCommands,
  isLiveClassroomStackScope,
  LIVE_CLASSROOM_RUNTIME_WIRING_EXACT_FILES,
  liveClassroomRuntimeWiringCommands,
  isLiveClassroomRuntimeWiringScope,
  isCourseVideoSharedMediaScope,
  COURSE_VIDEO_SHARED_MEDIA_EXACT_FILES,
} from '../scripts/run-saas-milestone-roadmap-profile.mjs';

test('live classroom selector accepts exactly the 21 stacked files', () => {
  assert.equal(LIVE_CLASSROOM_STACK_EXACT_FILES.size, 21);
  assert.equal(isLiveClassroomStackScope(LIVE_CLASSROOM_STACK_EXACT_FILES), true);
  assert.equal(
    isLiveClassroomStackScope([...LIVE_CLASSROOM_STACK_EXACT_FILES, 'apps/training-web/src/not-owned.ts']),
    false,
  );
  const replaced = [...LIVE_CLASSROOM_STACK_EXACT_FILES];
  replaced[0] = 'supabase/migrations/20260807190000_not_allowed.sql';
  assert.equal(isLiveClassroomStackScope(replaced), false);
});

test('runtime wiring selector accepts exactly the four F1 files', () => {
  assert.equal(LIVE_CLASSROOM_RUNTIME_WIRING_EXACT_FILES.size, 4);
  assert.equal(isLiveClassroomRuntimeWiringScope(LIVE_CLASSROOM_RUNTIME_WIRING_EXACT_FILES), true);
  assert.equal(
    isLiveClassroomRuntimeWiringScope([...LIVE_CLASSROOM_RUNTIME_WIRING_EXACT_FILES, 'netlify.toml']),
    false,
  );
  const replaced = [...LIVE_CLASSROOM_RUNTIME_WIRING_EXACT_FILES];
  replaced[0] = 'supabase/migrations/20260807210000_not_allowed.sql';
  assert.equal(isLiveClassroomRuntimeWiringScope(replaced), false);
});

test('course-video selector remains independent from live classroom', () => {
  assert.equal(isCourseVideoSharedMediaScope(COURSE_VIDEO_SHARED_MEDIA_EXACT_FILES), true);
  for (const file of COURSE_VIDEO_SHARED_MEDIA_EXACT_FILES) {
    assert.equal(LIVE_CLASSROOM_STACK_EXACT_FILES.has(file), false, file);
    assert.equal(LIVE_CLASSROOM_RUNTIME_WIRING_EXACT_FILES.has(file), false, file);
  }
});

test('live classroom fixed profile runs bounded deterministic validation only', () => {
  assert.deepEqual(liveClassroomStackCommands.map((item) => item.label), [
    'install',
    'focused-python-contracts',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  const python = liveClassroomStackCommands.find((item) => item.label === 'focused-python-contracts');
  assert.ok(python);
  assert.deepEqual(python.args, [
    '-m', 'unittest', '-v',
    'tests.test_trainingos_live_classroom_contract_v1',
    'tests.test_trainingos_live_classroom_tencent_provider_v1',
    'tests.test_trainingos_live_classroom_teaching_interactions_v1',
    'tests.test_trainingos_live_classroom_postclass_evidence_v1',
    'tests.test_trainingos_live_classroom_runtime_matrix_v1',
  ]);

  const build = liveClassroomStackCommands.find((item) => item.label === 'direct-vite-production-build');
  assert.deepEqual(build, {
    label: 'direct-vite-production-build',
    executable: 'npx',
    args: ['vite', 'build', '--config', 'vite.config.ts'],
    kind: 'status',
  });
  const postbuild = liveClassroomStackCommands.find((item) => item.label === 'postbuild-copy');
  assert.deepEqual(postbuild, {
    label: 'postbuild-copy',
    executable: 'node',
    args: ['scripts/copy-trainingos-marketplace-web.mjs'],
    kind: 'status',
  });
});

test('runtime wiring profile runs eight contracts plus the same real build gates', () => {
  assert.deepEqual(liveClassroomRuntimeWiringCommands.map((item) => item.label), [
    'install',
    'focused-python-contracts',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  const python = liveClassroomRuntimeWiringCommands.find((item) => item.label === 'focused-python-contracts');
  assert.deepEqual(python?.args, [
    '-m', 'unittest', '-v',
    'tests.test_trainingos_live_classroom_runtime_wiring_v1',
  ]);
  const build = liveClassroomRuntimeWiringCommands.find((item) => item.label === 'direct-vite-production-build');
  assert.deepEqual(build?.args, ['vite', 'build', '--config', 'vite.config.ts']);
  const postbuild = liveClassroomRuntimeWiringCommands.find((item) => item.label === 'postbuild-copy');
  assert.deepEqual(postbuild?.args, ['scripts/copy-trainingos-marketplace-web.mjs']);
});

test('profile bypasses inherited npm prebuild but keeps actual Vite and bundle verification', () => {
  for (const commands of [liveClassroomStackCommands, liveClassroomRuntimeWiringCommands]) {
    const text = JSON.stringify(commands);
    assert.equal(text.includes('npm","args":["run","build"'), false);
    assert.equal(text.includes('"vite","build","--config","vite.config.ts"'), true);
    assert.equal(text.includes('copy-trainingos-marketplace-web.mjs'), true);
    assert.equal(text.includes('verify:build'), true);
  }
});

test('live classroom profiles have no deployment, RTC, network, database, or arbitrary shell execution', () => {
  const text = JSON.stringify([liveClassroomStackCommands, liveClassroomRuntimeWiringCommands]).toLowerCase();
  for (const forbidden of [
    'curl', 'wget', 'ssh', 'scp', 'deploy', 'netlify', 'vercel', 'supabase db',
    'psql', 'tencent', 'zoom', 'agora', 'zego', 'playwright', 'bash -c', 'sh -c',
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
});
