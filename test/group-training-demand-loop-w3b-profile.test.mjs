import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  GROUP_TRAINING_DEMAND_W3B_EXACT_FILES,
  groupTrainingDemandW3bCommands,
  isGroupTrainingDemandW3bScope,
} from '../scripts/run-group-training-demand-loop-w3b-profile.mjs';

const expectedFiles = [
  'docs/product/trainingos-group-training-demand-loop-v1.md',
  'src/lib/trainingos-group-training-demand-loop-v1.mjs',
  'tests/trainingos-group-training-demand-loop-v1.test.mjs',
].sort();

test('locks W3B exact private scope to three non-migration files', () => {
  assert.deepEqual([...GROUP_TRAINING_DEMAND_W3B_EXACT_FILES].sort(), expectedFiles);
  assert.equal(isGroupTrainingDemandW3bScope(expectedFiles), true);
  assert.equal(isGroupTrainingDemandW3bScope(expectedFiles.slice(0, 2)), false);
  assert.equal(isGroupTrainingDemandW3bScope([...expectedFiles, 'supabase/migrations/999.sql']), false);
  assert.equal(isGroupTrainingDemandW3bScope([
    expectedFiles[0], expectedFiles[1], 'tests/unrelated.test.mjs',
  ]), false);
});

test('runs only fixed install, syntax, focused node, typecheck and production build commands', () => {
  assert.deepEqual(groupTrainingDemandW3bCommands.map((item) => ({
    label: item.label,
    executable: item.executable,
    args: [...item.args],
    kind: item.kind,
  })), [
    {label: 'install', executable: 'npm', args: ['ci'], kind: 'status'},
    {label: 'module-syntax', executable: 'node', args: ['--check', 'src/lib/trainingos-group-training-demand-loop-v1.mjs'], kind: 'status'},
    {label: 'focused-node-contracts', executable: 'node', args: ['--test', 'tests/trainingos-group-training-demand-loop-v1.test.mjs'], kind: 'node'},
    {label: 'typecheck', executable: 'npm', args: ['run', 'typecheck'], kind: 'status'},
    {label: 'production-build', executable: 'npm', args: ['run', 'build'], kind: 'status'},
  ]);
});

test('stage15 registers W3B profile before falling through to older profile runner', () => {
  const stage15 = readFileSync('scripts/run-private-profile-stage15.mjs', 'utf8');
  assert.match(stage15, /maybeRunGroupTrainingDemandW3bProfile/);
  assert.match(stage15, /run-group-training-demand-loop-w3b-profile\.mjs/);
  assert.ok(stage15.indexOf('maybeRunGroupTrainingDemandW3bProfile,') < stage15.indexOf('maybeRunLiveClassroomBrowserMatrixCurrentMainProfile,'));
});
