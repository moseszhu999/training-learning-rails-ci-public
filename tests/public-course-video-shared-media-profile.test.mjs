import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COURSE_VIDEO_SHARED_MEDIA_EXACT_FILES,
  courseVideoSharedMediaCommands,
  isCourseVideoSharedMediaScope,
  isMarketplaceRealPilotScope,
  MARKETPLACE_REAL_PILOT_EXACT_FILES,
  isSaasMilestoneRoadmapScope,
  SAAS_MILESTONE_ROADMAP_EXACT_FILES,
} from '../scripts/run-saas-milestone-roadmap-profile.mjs';

test('course video shared-media selector accepts exactly six owned files', () => {
  assert.equal(COURSE_VIDEO_SHARED_MEDIA_EXACT_FILES.size, 6);
  assert.equal(isCourseVideoSharedMediaScope(COURSE_VIDEO_SHARED_MEDIA_EXACT_FILES), true);
  assert.equal(isCourseVideoSharedMediaScope([...COURSE_VIDEO_SHARED_MEDIA_EXACT_FILES, 'apps/training-web/src/video.ts']), false);
  assert.equal(isCourseVideoSharedMediaScope(['supabase/migrations/20260807180000_bad.sql', ...[...COURSE_VIDEO_SHARED_MEDIA_EXACT_FILES].slice(1)]), false);
});

test('existing roadmap and pilot selectors remain exact', () => {
  assert.equal(isSaasMilestoneRoadmapScope(SAAS_MILESTONE_ROADMAP_EXACT_FILES), true);
  assert.equal(isMarketplaceRealPilotScope(MARKETPLACE_REAL_PILOT_EXACT_FILES), true);
});

test('fixed command map runs only bounded validation stages', () => {
  assert.deepEqual(courseVideoSharedMediaCommands.map((item) => item.label), [
    'install',
    'package-syntax',
    'focused-node-contracts',
    'focused-python-contracts',
    'declaration-typecheck',
    'typecheck',
    'production-build',
    'bundle-verification',
  ]);
  assert.deepEqual(courseVideoSharedMediaCommands.find((item) => item.label === 'focused-node-contracts').args, [
    '--test', 'packages/training-course-video-shared-media-adapter/test/course-video-adapter.test.mjs',
  ]);
  assert.deepEqual(courseVideoSharedMediaCommands.find((item) => item.label === 'focused-python-contracts').args, [
    'tests/test_trainingos_course_video_shared_media_adapter_v1.py', '-v',
  ]);
});

test('profile contains no network, deployment, render, or arbitrary shell command', () => {
  const text = JSON.stringify(courseVideoSharedMediaCommands).toLowerCase();
  for (const forbidden of ['curl', 'wget', 'ssh', 'scp', 'remotion', '/v1/render', 'deploy', 'supabase db', 'bash -c', 'sh -c']) {
    assert.equal(text.includes(forbidden), false, forbidden);
  }
});
