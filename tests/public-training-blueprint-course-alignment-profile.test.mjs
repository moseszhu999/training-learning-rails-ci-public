import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TRAINING_BLUEPRINT_COURSE_ALIGNMENT_EXACT_FILES,
  trainingBlueprintCourseAlignmentCommands,
  isTrainingBlueprintCourseAlignmentScope,
} from '../scripts/run-training-blueprint-course-alignment-profile.mjs';

test('alignment selector accepts exactly the four private owner files', () => {
  assert.equal(TRAINING_BLUEPRINT_COURSE_ALIGNMENT_EXACT_FILES.size, 4);
  assert.equal(isTrainingBlueprintCourseAlignmentScope(TRAINING_BLUEPRINT_COURSE_ALIGNMENT_EXACT_FILES), true);
  assert.equal(isTrainingBlueprintCourseAlignmentScope([...TRAINING_BLUEPRINT_COURSE_ALIGNMENT_EXACT_FILES, 'netlify.toml']), false);
  const missing = [...TRAINING_BLUEPRINT_COURSE_ALIGNMENT_EXACT_FILES].slice(1);
  assert.equal(isTrainingBlueprintCourseAlignmentScope(missing), false);
  const replaced = [...TRAINING_BLUEPRINT_COURSE_ALIGNMENT_EXACT_FILES];
  replaced[0] = 'supabase/migrations/20260808999999_not_allowed.sql';
  assert.equal(isTrainingBlueprintCourseAlignmentScope(replaced), false);
});

test('alignment profile runs exact focused contracts and repository build gates', () => {
  assert.deepEqual(trainingBlueprintCourseAlignmentCommands.map((item) => item.label), [
    'install',
    'alignment-syntax',
    'focused-node-contracts',
    'focused-python-contracts',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  assert.deepEqual(trainingBlueprintCourseAlignmentCommands.find((item) => item.label === 'focused-node-contracts')?.args,
    ['--test', 'packages/training-industry-role-pack-core/test/course-design-alignment.test.mjs']);
  assert.deepEqual(trainingBlueprintCourseAlignmentCommands.find((item) => item.label === 'focused-python-contracts')?.args,
    ['-m', 'unittest', '-v', 'tests.test_trainingos_training_blueprint_course_alignment_v1']);
});

test('alignment profile locks 4 files 10 node 7 python zero migration and 370 canonical migrations', () => {
  const source = readFileSync(new URL('../scripts/run-training-blueprint-course-alignment-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    'const EXPECTED_CHANGED_FILE_COUNT = 4;',
    'const EXPECTED_NODE_COUNT = 10;',
    'const EXPECTED_PYTHON_COUNT = 7;',
    'const EXPECTED_MIGRATION_COUNT = 370;',
    "selectedSuite: 'training-blueprint-course-alignment'",
  ]) assert.equal(source.includes(token), true, token);
});

test('stage15 routes alignment after Java pilot and before generic fallback', () => {
  const router = readFileSync(new URL('../scripts/run-private-profile-stage15.mjs', import.meta.url), 'utf8');
  assert.equal(router.includes("import { maybeRunTrainingBlueprintCourseAlignmentProfile } from './run-training-blueprint-course-alignment-profile.mjs';"), true);
  const pilot = router.indexOf('maybeRunJavaDeveloperNewHirePilotProfile(input)');
  const alignment = router.indexOf('maybeRunTrainingBlueprintCourseAlignmentProfile(input)');
  const fallback = router.indexOf('runStage14Profile(input)');
  assert.ok(pilot >= 0 && alignment > pilot && fallback > alignment);
});

test('public alignment profile contains no deployment database provider or arbitrary shell primitive', () => {
  const text = JSON.stringify(trainingBlueprintCourseAlignmentCommands).toLowerCase();
  for (const forbidden of [
    'curl', 'wget', 'ssh', 'scp', 'netlify deploy', 'vercel deploy', 'supabase db', 'psql',
    'playwright', 'tencent', 'createroom', 'bash -c', 'sh -c',
  ]) assert.equal(text.includes(forbidden), false, forbidden);
});
