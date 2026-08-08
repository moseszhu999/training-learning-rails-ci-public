import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TRAINING_BLUEPRINT_DRAFT_COMPILER_EXACT_FILES,
  trainingBlueprintDraftCompilerCommands,
  isTrainingBlueprintDraftCompilerScope,
} from '../scripts/run-training-blueprint-draft-compiler-profile.mjs';

test('TrainingBlueprint selector accepts exactly the four private owner files', () => {
  assert.equal(TRAINING_BLUEPRINT_DRAFT_COMPILER_EXACT_FILES.size, 4);
  assert.equal(isTrainingBlueprintDraftCompilerScope(TRAINING_BLUEPRINT_DRAFT_COMPILER_EXACT_FILES), true);
  assert.equal(isTrainingBlueprintDraftCompilerScope([...TRAINING_BLUEPRINT_DRAFT_COMPILER_EXACT_FILES, 'netlify.toml']), false);
  const missing = [...TRAINING_BLUEPRINT_DRAFT_COMPILER_EXACT_FILES].slice(1);
  assert.equal(isTrainingBlueprintDraftCompilerScope(missing), false);
  const replaced = [...TRAINING_BLUEPRINT_DRAFT_COMPILER_EXACT_FILES];
  replaced[0] = 'supabase/migrations/20260808999999_not_allowed.sql';
  assert.equal(isTrainingBlueprintDraftCompilerScope(replaced), false);
});

test('TrainingBlueprint profile runs exact focused contracts and repository build gates', () => {
  assert.deepEqual(trainingBlueprintDraftCompilerCommands.map((item) => item.label), [
    'install',
    'compiler-syntax',
    'focused-node-contracts',
    'focused-python-contracts',
    'typecheck',
    'direct-vite-production-build',
    'postbuild-copy',
    'bundle-verification',
  ]);
  assert.deepEqual(trainingBlueprintDraftCompilerCommands.find((item) => item.label === 'focused-node-contracts')?.args,
    ['--test', 'packages/training-industry-role-pack-core/test/training-blueprint.test.mjs']);
  assert.deepEqual(trainingBlueprintDraftCompilerCommands.find((item) => item.label === 'focused-python-contracts')?.args,
    ['-m', 'unittest', '-v', 'tests.test_trainingos_training_blueprint_draft_compiler_v1']);
});

test('TrainingBlueprint profile locks 4 files 10 node 7 python zero migration and 369 canonical migrations', () => {
  const source = readFileSync(new URL('../scripts/run-training-blueprint-draft-compiler-profile.mjs', import.meta.url), 'utf8');
  for (const token of [
    'const EXPECTED_CHANGED_FILE_COUNT = 4;',
    'const EXPECTED_NODE_COUNT = 10;',
    'const EXPECTED_PYTHON_COUNT = 7;',
    'const EXPECTED_MIGRATION_COUNT = 369;',
    "selectedSuite: 'training-blueprint-draft-compiler'",
  ]) assert.equal(source.includes(token), true, token);
});

test('stage15 routes TrainingBlueprint selector after role registry and before generic fallback', () => {
  const router = readFileSync(new URL('../scripts/run-private-profile-stage15.mjs', import.meta.url), 'utf8');
  assert.equal(router.includes("import { maybeRunTrainingBlueprintDraftCompilerProfile } from './run-training-blueprint-draft-compiler-profile.mjs';"), true);
  const registry = router.indexOf('maybeRunIndustryRolePackRegistryProfile(input)');
  const blueprint = router.indexOf('maybeRunTrainingBlueprintDraftCompilerProfile(input)');
  const fallback = router.indexOf('runStage14Profile(input)');
  assert.ok(registry >= 0 && blueprint > registry && fallback > blueprint);
});

test('public TrainingBlueprint profile contains no deployment database provider or arbitrary shell primitive', () => {
  const text = JSON.stringify(trainingBlueprintDraftCompilerCommands).toLowerCase();
  for (const forbidden of [
    'curl', 'wget', 'ssh', 'scp', 'netlify deploy', 'vercel deploy', 'supabase db', 'psql',
    'playwright', 'tencent', 'createroom', 'bash -c', 'sh -c',
  ]) assert.equal(text.includes(forbidden), false, forbidden);
});
