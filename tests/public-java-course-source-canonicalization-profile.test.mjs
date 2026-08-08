import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  JAVA_COURSE_CANONICALIZATION_EXACT_FILES,
  javaCourseCanonicalizationCommands,
  isJavaCourseCanonicalizationScope,
} from '../scripts/run-java-course-source-canonicalization-profile.mjs';

test('canonicalization selector accepts exactly the five private proposal files', () => {
  assert.equal(JAVA_COURSE_CANONICALIZATION_EXACT_FILES.size, 5);
  assert.equal(isJavaCourseCanonicalizationScope(JAVA_COURSE_CANONICALIZATION_EXACT_FILES), true);
  assert.equal(isJavaCourseCanonicalizationScope([...JAVA_COURSE_CANONICALIZATION_EXACT_FILES, 'netlify.toml']), false);
  const missing = [...JAVA_COURSE_CANONICALIZATION_EXACT_FILES].slice(1);
  assert.equal(isJavaCourseCanonicalizationScope(missing), false);
  const replaced = [...JAVA_COURSE_CANONICALIZATION_EXACT_FILES];
  replaced[0] = 'supabase/migrations/20260808999999_not_allowed.sql';
  assert.equal(isJavaCourseCanonicalizationScope(replaced), false);
});

test('canonicalization profile runs exact contracts and repository build gates', () => {
  assert.deepEqual(javaCourseCanonicalizationCommands.map((item) => item.label), [
    'install',
    'compiler-syntax',
    'focused-node-contracts',
    'focused-python-contracts',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  assert.deepEqual(javaCourseCanonicalizationCommands.find((item) => item.label === 'focused-node-contracts')?.args,
    ['--test', 'packages/training-industry-role-pack-core/test/course-source-canonicalization-proposal.test.mjs']);
  assert.deepEqual(javaCourseCanonicalizationCommands.find((item) => item.label === 'focused-python-contracts')?.args,
    ['-m', 'unittest', '-v', 'tests.test_trainingos_java_course_source_canonicalization_proposal_v1']);
});

test('canonicalization profile locks 5 files 10 node 7 python and migration metadata 371', () => {
  const source = readFileSync(new URL('../scripts/run-java-course-source-canonicalization-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    'const EXPECTED_CHANGED_FILE_COUNT = 5;',
    'const EXPECTED_NODE_COUNT = 10;',
    'const EXPECTED_PYTHON_COUNT = 7;',
    'const EXPECTED_MIGRATION_COUNT = 371;',
    "selectedSuite: 'java-course-source-canonicalization'",
  ]) assert.equal(source.includes(token), true, token);
});

test('stage15 routes canonicalization after source readiness and before generic fallback', () => {
  const router = readFileSync(new URL('../scripts/run-private-profile-stage15.mjs', import.meta.url), 'utf8');
  assert.equal(router.includes("import { maybeRunJavaCourseCanonicalizationProfile } from './run-java-course-source-canonicalization-profile.mjs';"), true);
  const readiness = router.indexOf('maybeRunJavaPilotCourseSourceReadinessProfile(input)');
  const canonicalization = router.indexOf('maybeRunJavaCourseCanonicalizationProfile(input)');
  const fallback = router.indexOf('runStage14Profile(input)');
  assert.ok(readiness >= 0 && canonicalization > readiness && fallback > canonicalization);
});

test('public canonicalization profile contains no deployment database provider or arbitrary shell primitive', () => {
  const text = JSON.stringify(javaCourseCanonicalizationCommands).toLowerCase();
  for (const forbidden of [
    'curl', 'wget', 'ssh', 'scp', 'netlify deploy', 'vercel deploy', 'supabase db', 'psql',
    'playwright', 'tencent', 'createroom', 'bash -c', 'sh -c',
  ]) assert.equal(text.includes(forbidden), false, forbidden);
});
