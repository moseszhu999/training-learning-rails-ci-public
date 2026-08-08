import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  JAVA_PILOT_COURSE_SOURCE_READINESS_EXACT_FILES,
  javaPilotCourseSourceReadinessCommands,
  isJavaPilotCourseSourceReadinessScope,
} from '../scripts/run-java-pilot-course-source-readiness-profile.mjs';

test('source readiness selector accepts exactly the five private owner files', () => {
  assert.equal(JAVA_PILOT_COURSE_SOURCE_READINESS_EXACT_FILES.size, 5);
  assert.equal(isJavaPilotCourseSourceReadinessScope(JAVA_PILOT_COURSE_SOURCE_READINESS_EXACT_FILES), true);
  assert.equal(isJavaPilotCourseSourceReadinessScope([...JAVA_PILOT_COURSE_SOURCE_READINESS_EXACT_FILES, 'netlify.toml']), false);
  const missing = [...JAVA_PILOT_COURSE_SOURCE_READINESS_EXACT_FILES].slice(1);
  assert.equal(isJavaPilotCourseSourceReadinessScope(missing), false);
  const replaced = [...JAVA_PILOT_COURSE_SOURCE_READINESS_EXACT_FILES];
  replaced[0] = 'supabase/migrations/20260808999999_not_allowed.sql';
  assert.equal(isJavaPilotCourseSourceReadinessScope(replaced), false);
});

test('source readiness profile runs exact focused contracts and repository build gates', () => {
  assert.deepEqual(javaPilotCourseSourceReadinessCommands.map((item) => item.label), [
    'install',
    'readiness-syntax',
    'focused-node-contracts',
    'focused-python-contracts',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  assert.deepEqual(javaPilotCourseSourceReadinessCommands.find((item) => item.label === 'focused-node-contracts')?.args,
    ['--test', 'packages/training-industry-role-pack-core/test/java-pilot-course-source-readiness.test.mjs']);
  assert.deepEqual(javaPilotCourseSourceReadinessCommands.find((item) => item.label === 'focused-python-contracts')?.args,
    ['-m', 'unittest', '-v', 'tests.test_trainingos_java_pilot_course_source_readiness_v1']);
});

test('source readiness profile locks 5 files 8 node 7 python zero migration and 371 canonical migrations', () => {
  const source = readFileSync(new URL('../scripts/run-java-pilot-course-source-readiness-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    'const EXPECTED_CHANGED_FILE_COUNT = 5;',
    'const EXPECTED_NODE_COUNT = 8;',
    'const EXPECTED_PYTHON_COUNT = 7;',
    'const EXPECTED_MIGRATION_COUNT = 371;',
    "selectedSuite: 'java-pilot-course-source-readiness'",
  ]) assert.equal(source.includes(token), true, token);
});

test('stage15 routes source readiness after alignment and before generic fallback', () => {
  const router = readFileSync(new URL('../scripts/run-private-profile-stage15.mjs', import.meta.url), 'utf8');
  assert.equal(router.includes("import { maybeRunJavaPilotCourseSourceReadinessProfile } from './run-java-pilot-course-source-readiness-profile.mjs';"), true);
  const alignment = router.indexOf('maybeRunTrainingBlueprintCourseAlignmentProfile(input)');
  const readiness = router.indexOf('maybeRunJavaPilotCourseSourceReadinessProfile(input)');
  const fallback = router.indexOf('runStage14Profile(input)');
  assert.ok(alignment >= 0 && readiness > alignment && fallback > readiness);
});

test('public source readiness profile contains no external source database deployment or arbitrary shell primitive', () => {
  const text = JSON.stringify(javaPilotCourseSourceReadinessCommands).toLowerCase();
  for (const forbidden of [
    'curl', 'wget', 'ssh', 'scp', 'netlify deploy', 'vercel deploy', 'supabase db', 'psql',
    'google_drive', 'drive.google', 'playwright', 'tencent', 'bash -c', 'sh -c',
  ]) assert.equal(text.includes(forbidden), false, forbidden);
});
