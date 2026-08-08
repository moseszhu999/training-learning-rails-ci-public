import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  JAVA_DEVELOPER_NEW_HIRE_PILOT_EXACT_FILES,
  javaDeveloperNewHirePilotCommands,
  isJavaDeveloperNewHirePilotScope,
} from '../scripts/run-java-developer-new-hire-pilot-blueprint-profile.mjs';

test('Java pilot selector accepts exactly the five private pilot files', () => {
  assert.equal(JAVA_DEVELOPER_NEW_HIRE_PILOT_EXACT_FILES.size, 5);
  assert.equal(isJavaDeveloperNewHirePilotScope(JAVA_DEVELOPER_NEW_HIRE_PILOT_EXACT_FILES), true);
  assert.equal(isJavaDeveloperNewHirePilotScope([...JAVA_DEVELOPER_NEW_HIRE_PILOT_EXACT_FILES, 'netlify.toml']), false);
  const missing = [...JAVA_DEVELOPER_NEW_HIRE_PILOT_EXACT_FILES].slice(1);
  assert.equal(isJavaDeveloperNewHirePilotScope(missing), false);
  const replaced = [...JAVA_DEVELOPER_NEW_HIRE_PILOT_EXACT_FILES];
  replaced[0] = 'supabase/migrations/20260808999999_not_allowed.sql';
  assert.equal(isJavaDeveloperNewHirePilotScope(replaced), false);
});

test('Java pilot profile runs focused contracts compile smoke and repository build gates', () => {
  assert.deepEqual(javaDeveloperNewHirePilotCommands.map((item) => item.label), [
    'install',
    'pilot-adapter-syntax',
    'focused-node-contracts',
    'focused-python-contracts',
    'pilot-compile-smoke',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  assert.deepEqual(javaDeveloperNewHirePilotCommands.find((item) => item.label === 'focused-node-contracts')?.args,
    ['--test', 'packages/training-industry-role-pack-core/test/java-developer-new-hire-pilot.test.mjs']);
  assert.deepEqual(javaDeveloperNewHirePilotCommands.find((item) => item.label === 'focused-python-contracts')?.args,
    ['-m', 'unittest', '-v', 'tests.test_trainingos_java_developer_new_hire_pilot_blueprint_v1']);
});

test('Java pilot profile locks 5 files 8 node 7 python zero migration and 369 canonical migrations', () => {
  const source = readFileSync(new URL('../scripts/run-java-developer-new-hire-pilot-blueprint-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    'const EXPECTED_CHANGED_FILE_COUNT = 5;',
    'const EXPECTED_NODE_COUNT = 8;',
    'const EXPECTED_PYTHON_COUNT = 7;',
    'const EXPECTED_MIGRATION_COUNT = 369;',
    "selectedSuite: 'java-developer-new-hire-pilot'",
  ]) assert.equal(source.includes(token), true, token);
});

test('stage15 routes Java pilot after generic TrainingBlueprint compiler and before fallback', () => {
  const router = readFileSync(new URL('../scripts/run-private-profile-stage15.mjs', import.meta.url), 'utf8');
  assert.equal(router.includes("import { maybeRunJavaDeveloperNewHirePilotProfile } from './run-java-developer-new-hire-pilot-blueprint-profile.mjs';"), true);
  const compiler = router.indexOf('maybeRunTrainingBlueprintDraftCompilerProfile(input)');
  const pilot = router.indexOf('maybeRunJavaDeveloperNewHirePilotProfile(input)');
  const fallback = router.indexOf('runStage14Profile(input)');
  assert.ok(compiler >= 0 && pilot > compiler && fallback > pilot);
});

test('public Java pilot profile contains no deployment database provider or arbitrary shell primitive', () => {
  const text = JSON.stringify(javaDeveloperNewHirePilotCommands).toLowerCase();
  for (const forbidden of [
    'curl', 'wget', 'ssh', 'scp', 'netlify deploy', 'vercel deploy', 'supabase db', 'psql',
    'playwright', 'tencent', 'createroom', 'bash -c', 'sh -c',
  ]) assert.equal(text.includes(forbidden), false, forbidden);
});
