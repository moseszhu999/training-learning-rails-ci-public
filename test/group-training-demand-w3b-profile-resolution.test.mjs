import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  GROUP_TRAINING_DEMAND_W3B_EXACT_FILES,
  groupTrainingDemandW3bCommands,
  isGroupTrainingDemandW3bScope,
  maybeRunGroupTrainingDemandW3bProfile,
} from '../scripts/run-course-design-mcp-read-v1-profile.mjs';

const stage15 = readFileSync('scripts/run-private-profile-stage15.mjs', 'utf8');
const stableProfile = readFileSync('scripts/run-course-design-mcp-read-v1-profile.mjs', 'utf8');

const exactFiles = [
  'docs/product/trainingos-group-training-demand-loop-v1.md',
  'src/lib/trainingos-group-training-demand-loop-v1.mjs',
  'tests/trainingos-group-training-demand-loop-v1.test.mjs',
];

test('stage15 resolves W3B through a pre-existing stable profile module', () => {
  assert.doesNotMatch(stage15, /from ['"]\.\/run-group-training-demand-loop-w3b-profile\.mjs['"]/);
  assert.match(stage15, /maybeRunGroupTrainingDemandW3bProfile/);
  assert.match(stage15, /from ['"]\.\/run-course-design-mcp-read-v1-profile\.mjs['"]/);
  assert.match(stableProfile, /export async function maybeRunGroupTrainingDemandW3bProfile/);
  assert.equal(typeof maybeRunGroupTrainingDemandW3bProfile, 'function');
});

test('co-located W3B runner keeps the same exact private scope and fixed command surface', () => {
  assert.deepEqual([...GROUP_TRAINING_DEMAND_W3B_EXACT_FILES].sort(), exactFiles.sort());
  assert.equal(isGroupTrainingDemandW3bScope(exactFiles), true);
  assert.equal(isGroupTrainingDemandW3bScope([...exactFiles, 'supabase/migrations/999.sql']), false);
  assert.deepEqual(groupTrainingDemandW3bCommands.map(({label, executable, args, kind}) => ({
    label, executable, args: [...args], kind,
  })), [
    {label: 'install', executable: 'npm', args: ['ci'], kind: 'status'},
    {label: 'module-syntax', executable: 'node', args: ['--check', 'src/lib/trainingos-group-training-demand-loop-v1.mjs'], kind: 'status'},
    {label: 'focused-node-contracts', executable: 'node', args: ['--test', 'tests/trainingos-group-training-demand-loop-v1.test.mjs'], kind: 'node'},
    {label: 'typecheck', executable: 'npm', args: ['run', 'typecheck'], kind: 'status'},
    {label: 'production-build', executable: 'npm', args: ['run', 'build'], kind: 'status'},
  ]);
});
