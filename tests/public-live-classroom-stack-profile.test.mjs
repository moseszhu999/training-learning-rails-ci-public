import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LIVE_CLASSROOM_STACK_EXACT_FILES,
  liveClassroomStackCommands,
  isLiveClassroomStackScope,
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

test('course-video selector remains independent from live classroom', () => {
  assert.equal(isCourseVideoSharedMediaScope(COURSE_VIDEO_SHARED_MEDIA_EXACT_FILES), true);
  for (const file of COURSE_VIDEO_SHARED_MEDIA_EXACT_FILES) {
    assert.equal(LIVE_CLASSROOM_STACK_EXACT_FILES.has(file), false, file);
  }
});

test('live classroom fixed profile runs bounded validation only', () => {
  assert.deepEqual(liveClassroomStackCommands.map((item) => item.label), [
    'install',
    'focused-python-contracts',
    'typecheck',
    'production-build',
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
});

test('profile has no deployment, RTC, network, database, or arbitrary shell execution', () => {
  const text = JSON.stringify(liveClassroomStackCommands).toLowerCase();
  for (const forbidden of [
    'curl', 'wget', 'ssh', 'scp', 'deploy', 'netlify', 'vercel', 'supabase db',
    'psql', 'tencent', 'zoom', 'agora', 'zego', 'playwright', 'bash -c', 'sh -c',
  ]) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
});
